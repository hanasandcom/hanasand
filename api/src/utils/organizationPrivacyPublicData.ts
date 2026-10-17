import { queryOnce } from '#db'
import { iso, type RetentionItem, type RetentionRun } from './organizationPrivacyPolicy.ts'
import { mutateAndRecord, saveRetentionItems } from './organizationPrivacyRunItems.ts'

export async function purgePublicOrganizationData(retentionRun: RetentionRun, input: { limit: number, heldAlertIds: string[], protectedWatchlistIds: string[] }) {
    const deletion = retentionRun.trigger_type === 'privacy_deletion'
    const candidates = await publicCandidates(retentionRun, input, input.limit)
    let failed = false
    let firstError: string | undefined
    for (const candidate of candidates.rows as Array<{ record_type: string, record_id: string, action: 'delete' | 'redact' | 'retain', reason: string }>) {
        try {
            const item: RetentionItem = {
                sourceService: 'hanasand-api', recordType: candidate.record_type, recordId: candidate.record_id,
                action: candidate.action, status: candidate.action === 'retain' ? 'protected' : candidate.action === 'delete' ? 'deleted' : 'redacted',
                reason: candidate.reason,
            }
            if (candidate.action === 'retain') await saveRetentionItems(retentionRun, [item])
            else await mutateAndRecordPublicCandidate(retentionRun, candidate, input, item)
        } catch (caught) {
            failed = true
            firstError ??= caught instanceof Error ? caught.message : String(caught)
            await saveRetentionItems(retentionRun, [{
                sourceService: 'hanasand-api', recordType: candidate.record_type, recordId: candidate.record_id,
                action: candidate.action, status: 'failed', reason: candidate.reason,
                error: caught instanceof Error ? caught.message : String(caught),
            }])
        }
    }
    const remaining = await publicCandidates(retentionRun, input, 1)
    return {
        failed,
        error: firstError,
        hasMore: Number(remaining.rowCount) > 0,
        summary: { selected: Number(candidates.rowCount), deletion, remainingEligible: Number(remaining.rowCount) > 0 ? 'at_least_one' : 0 },
    }
}

function publicCandidates(retentionRun: RetentionRun, input: { heldAlertIds: string[], protectedWatchlistIds: string[] }, limit: number) {
    const deletion = retentionRun.trigger_type === 'privacy_deletion'
    return queryOnce(`
        WITH candidates AS (
            SELECT 'organization_invite' record_type, invite.id record_id, 'retain' action,
                   'access_recovery_evidence' reason, COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at, invite.created_at) occurred_at
              FROM organization_invites invite
             WHERE invite.organization_id = $1
               AND ($2::boolean OR ((invite.status IN ('accepted', 'revoked') OR (invite.status = 'pending' AND invite.expires_at <= $3)) AND COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at) <= $3))
               AND EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            UNION ALL
            SELECT 'organization_invite', invite.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at, invite.created_at)
              FROM organization_invites invite
             WHERE invite.organization_id = $1
               AND ($2::boolean OR ((invite.status IN ('accepted', 'revoked') OR (invite.status = 'pending' AND invite.expires_at <= $3)) AND COALESCE(invite.revoked_at, invite.accepted_at, invite.expires_at) <= $3))
               AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            UNION ALL
            SELECT 'organization_member', member.user_id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   member.removed_at
              FROM organization_members member
             WHERE member.organization_id = $1 AND member.status = 'removed'
               AND ($2::boolean OR member.removed_at <= $3)
            UNION ALL
            SELECT 'organization_watchlist_item', watchlist.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   watchlist.updated_at
              FROM organization_watchlist_items watchlist
             WHERE watchlist.organization_id = $1
               AND ($2::boolean OR (watchlist.status = 'archived' AND watchlist.archived_at <= $3))
               AND NOT (watchlist.id = ANY($4::text[]) OR ('org_' || watchlist.id) = ANY($4::text[]))
            UNION ALL
            SELECT 'dwm_webhook_destination', destination.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   destination.updated_at
              FROM dwm_webhook_destinations destination
             WHERE destination.org_id = $1
               AND ($2::boolean OR (destination.status = 'archived' AND destination.updated_at <= $3))
            UNION ALL
            SELECT 'dwm_webhook_delivery', delivery.id, 'redact',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'delivery_payload_retention_expired' END,
                   delivery.created_at
              FROM dwm_webhook_deliveries delivery
             WHERE delivery.org_id = $1 AND ($2::boolean OR delivery.created_at <= $3)
               AND NOT (delivery.alert_id = ANY($5::text[]))
               AND (delivery.payload <> '{}'::jsonb OR delivery.response_body IS NOT NULL OR delivery.error IS NOT NULL
                    OR delivery.endpoint_hint <> '' OR delivery.watchlist_name IS NOT NULL OR delivery.route IS NOT NULL OR delivery.case_path IS NOT NULL)
            UNION ALL
            SELECT 'event_event', event.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   event.event_timestamp
              FROM events event
             WHERE event.organization_id = $1
               AND ($2::boolean OR event.event_timestamp <= $3)
            UNION ALL
            SELECT 'event_finding', finding.id, 'delete',
                   CASE WHEN $2::boolean THEN 'organization_privacy_deletion' ELSE 'organization_retention_expired' END,
                   finding.last_observed
              FROM findings finding
             WHERE finding.organization_id = $1
               AND ($2::boolean OR finding.last_observed <= $3)
        )
        SELECT candidate.record_type, candidate.record_id, candidate.action, candidate.reason
          FROM candidates candidate
         WHERE NOT EXISTS (
            SELECT 1 FROM organization_retention_run_items item
             WHERE item.run_id = $6 AND item.source_service = 'hanasand-api'
               AND item.record_type = candidate.record_type AND item.record_id = candidate.record_id
               AND item.status <> 'failed'
         )
         ORDER BY candidate.occurred_at, candidate.record_type, candidate.record_id
         LIMIT $7
    `, [retentionRun.organization_id, deletion, iso(retentionRun.cutoff_at), input.protectedWatchlistIds, input.heldAlertIds, retentionRun.id, limit])
}

async function mutateAndRecordPublicCandidate(retentionRun: RetentionRun, candidate: { record_type: string, record_id: string, action: string, reason: string }, input: { heldAlertIds: string[], protectedWatchlistIds: string[] }, item: RetentionItem) {
    const params = [retentionRun.organization_id, candidate.record_id]
    if (candidate.record_type === 'organization_invite') {
        await mutateAndRecord('DELETE FROM organization_invites WHERE organization_id = $1 AND id = $2 AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals WHERE invite_id = $2) RETURNING id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'organization_watchlist_item') {
        await mutateAndRecord('DELETE FROM organization_watchlist_items WHERE organization_id = $1 AND id = $2 AND NOT (id = ANY($3::text[]) OR (\'org_\' || id) = ANY($3::text[])) RETURNING id', [...params, input.protectedWatchlistIds], retentionRun, item)
        return
    }
    if (candidate.record_type === 'organization_member') {
        await mutateAndRecord('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = \'removed\' RETURNING user_id AS id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'dwm_webhook_destination') {
        await mutateAndRecord('DELETE FROM dwm_webhook_destinations WHERE org_id = $1 AND id = $2 RETURNING id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'dwm_webhook_delivery') {
        await mutateAndRecord(`
            UPDATE dwm_webhook_deliveries
               SET endpoint_hint = '', endpoint_hash = '', payload = '{}'::jsonb,
                   response_body = NULL, error = NULL, error_class = NULL,
                   idempotency_key = 'privacy:' || id, watchlist_name = NULL,
                   route = NULL, case_path = NULL, next_retry_at = NULL, updated_at = NOW()
             WHERE org_id = $1 AND id = $2 AND NOT (alert_id = ANY($3::text[]))
             RETURNING id
        `, [...params, input.heldAlertIds], retentionRun, item)
        return
    }
    if (candidate.record_type === 'event_event') {
        await mutateAndRecord('DELETE FROM events WHERE organization_id = $1 AND id = $2 RETURNING id', params, retentionRun, item)
        return
    }
    if (candidate.record_type === 'event_finding') {
        await mutateAndRecord('DELETE FROM findings WHERE organization_id = $1 AND id = $2 RETURNING id', params, retentionRun, item)
        return
    }
    throw new Error(`Unsupported organization retention record type: ${candidate.record_type}`)
}
