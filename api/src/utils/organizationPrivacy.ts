import { createHash } from 'node:crypto'
import { queryOnce } from '#db'
import { BATCH_SIZE, items, iso, organizationRetentionRunOutcome, strings, type RetentionRun } from './organizationPrivacyPolicy.ts'
import { claimAndProcessOrganizationRetentionRun } from './organizationPrivacyJobs.ts'
import { purgePublicOrganizationData } from './organizationPrivacyPublicData.ts'
import { saveRetentionItems } from './organizationPrivacyRunItems.ts'
import { beginPrivacyDeletion, completePrivacyDeletion, refreshRun } from './organizationPrivacyLifecycle.ts'
export { queueOrganizationRetentionRun } from './organizationPrivacyJobs.ts'
export { organizationRetentionCutoff, organizationRetentionRunOutcome } from './organizationPrivacyPolicy.ts'
export { organizationPrivacyState, organizationPrivacyStateReadModel } from './organizationPrivacyRead.ts'

export const ORGANIZATION_RETENTION_JOB_ID = 'api-organization-retention'

export function runOrganizationRetentionWorker(runId?: string) {
    return claimAndProcessOrganizationRetentionRun(runId, processRetentionRun)
}

async function processRetentionRun(retentionRun: RetentionRun) {
    const mode = retentionRun.trigger_type === 'privacy_deletion' ? 'deletion' : 'scheduled'
    try {
        if (retentionRun.trigger_type === 'privacy_deletion') await beginPrivacyDeletion(retentionRun)
        const protectedInvites = await queryOnce('SELECT invite_id FROM admin_access_recovery_approvals WHERE organization_id = $1', [retentionRun.organization_id])
        const protectedProgress = await queryOnce(`
            SELECT COUNT(*)::int count
              FROM organization_retention_run_items
             WHERE run_id = $1 AND source_service = 'ti-scraper' AND status = 'protected'
        `, [retentionRun.id])
        const ti = await callTiPrivacy(retentionRun.organization_id, {
            action: 'purge',
            runId: retentionRun.id,
            cutoffAt: iso(retentionRun.cutoff_at),
            mode,
            limit: BATCH_SIZE,
            protectedOffset: Number(protectedProgress.rows[0]?.count ?? 0),
            protectedInviteIds: protectedInvites.rows.map(row => String(row.invite_id)),
        })
        await queryOnce(`
            UPDATE organization_retention_run_items
               SET status = 'retried', reason = 'privacy_runtime_recovered', error = NULL,
                   attempt_count = attempt_count + 1, processed_at = NOW()
             WHERE run_id = $1 AND source_service = 'ti-scraper'
               AND record_type = 'service' AND record_id = 'organization-privacy' AND status = 'failed'
        `, [retentionRun.id])
        const tiItems = [
            ...items(ti.completed),
            ...items(ti.failed),
            ...items(ti.protected),
        ]
        await saveRetentionItems(retentionRun, tiItems)

        const publicResult = await purgePublicOrganizationData(retentionRun, {
            limit: Math.max(0, BATCH_SIZE - Number(ti.processed ?? ti.selected ?? 0)),
            heldAlertIds: strings(ti.heldAlertIds),
            protectedWatchlistIds: strings(ti.protectedWatchlistIds),
        })
        const failed = tiItems.some(item => item.status === 'failed') || publicResult.failed
        const hasMore = Boolean(ti.hasMore) || publicResult.hasMore
        const failureError = tiItems.find(item => item.status === 'failed')?.error || publicResult.error || 'One or more retained records failed.'
        const outcome = organizationRetentionRunOutcome({ failed, hasMore, attemptCount: retentionRun.attempt_count, failureError })
        if (!failed && !hasMore && retentionRun.trigger_type === 'privacy_deletion') {
            await completePrivacyDeletion(retentionRun, {
                heldAlertIds: strings(ti.heldAlertIds),
                protectedWatchlistIds: strings(ti.protectedWatchlistIds),
            })
        }
        await refreshRun(retentionRun, {
            status: outcome.status,
            error: outcome.error,
            result: {
                tenantId: retentionRun.organization_id,
                cutoffAt: iso(retentionRun.cutoff_at),
                mode,
                ti: { remainingEligible: ti.remainingEligible ?? 0, protection: ti.protection ?? {} },
                public: publicResult.summary,
                hasMore,
            },
        })
        return { claimed: true, runId: retentionRun.id, failed, hasMore: outcome.hasMore, deadLetter: outcome.deadLetter }
    } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        await saveRetentionItems(retentionRun, [{
            sourceService: 'ti-scraper', recordType: 'service', recordId: 'organization-privacy',
            action: 'retain', status: 'failed', reason: 'privacy_runtime_unavailable', error: message,
        }])
        const outcome = organizationRetentionRunOutcome({
            failed: true,
            hasMore: true,
            attemptCount: retentionRun.attempt_count,
            failureError: message,
        })
        await refreshRun(retentionRun, {
            status: outcome.status,
            error: outcome.error,
            result: { tenantId: retentionRun.organization_id, retryable: !outcome.deadLetter, deadLetter: outcome.deadLetter },
        })
        return { claimed: true, runId: retentionRun.id, failed: true, hasMore: outcome.hasMore, deadLetter: outcome.deadLetter, error: message }
    }
}

export async function exportOrganizationPrivacyData(organizationId: string) {
    const [publicData, ti] = await Promise.all([
        queryOnce(`
            SELECT to_jsonb(organization) organization,
                   COALESCE((SELECT jsonb_agg(member ORDER BY member.created_at) FROM organization_members member WHERE member.organization_id = organization.id), '[]'::jsonb) members,
                   COALESCE((SELECT jsonb_agg(invite ORDER BY invite.created_at) FROM organization_invites invite WHERE invite.organization_id = organization.id), '[]'::jsonb) invites,
                   COALESCE((SELECT jsonb_agg(watchlist ORDER BY watchlist.created_at) FROM organization_watchlist_items watchlist WHERE watchlist.organization_id = organization.id), '[]'::jsonb) watchlists,
                   COALESCE((SELECT jsonb_agg(jsonb_build_object('id', destination.id, 'name', destination.name, 'kind', destination.kind, 'endpointHint', destination.endpoint_hint, 'status', destination.status, 'events', destination.events, 'createdAt', destination.created_at, 'updatedAt', destination.updated_at) ORDER BY destination.created_at) FROM dwm_webhook_destinations destination WHERE destination.org_id = organization.id), '[]'::jsonb) webhook_destinations,
                   COALESCE((SELECT jsonb_agg(delivery ORDER BY delivery.created_at) FROM dwm_webhook_deliveries delivery WHERE delivery.org_id = organization.id), '[]'::jsonb) webhook_deliveries
                   , COALESCE((SELECT jsonb_agg(request ORDER BY request.requested_at) FROM organization_privacy_requests request WHERE request.organization_id = organization.id), '[]'::jsonb) privacy_requests
                   , COALESCE((SELECT jsonb_agg(run ORDER BY run.created_at) FROM organization_retention_runs run WHERE run.organization_id = organization.id), '[]'::jsonb) retention_runs
                   , COALESCE((SELECT jsonb_agg(item ORDER BY item.processed_at) FROM organization_retention_run_items item WHERE item.organization_id = organization.id), '[]'::jsonb) retention_items
                   , COALESCE((SELECT jsonb_agg(approval ORDER BY approval.created_at) FROM admin_access_recovery_approvals approval WHERE approval.organization_id = organization.id), '[]'::jsonb) access_recovery_evidence
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.created_at) FROM system_events event WHERE event.organization_id = organization.id), '[]'::jsonb) system_events
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.created_at) FROM dwm_webhook_audit_events event WHERE event.org_id = organization.id), '[]'::jsonb) webhook_audit_events
                   , COALESCE((SELECT jsonb_agg(event ORDER BY event.event_timestamp) FROM events event WHERE event.ingestion_id='logs' AND (event.normalized #>> '{metadata,organizationId}' = organization.id OR event.normalized #>> '{metadata,tenantId}' = organization.id)), '[]'::jsonb) events
              FROM organizations organization WHERE organization.id = $1
        `, [organizationId]),
        callTiPrivacy(organizationId),
    ])
    if (!publicData.rows[0]) throw new Error('Organization not found')
    const exportedAt = new Date().toISOString()
    const data = { public: publicData.rows[0], threatIntelligence: ti }
    return {
        schemaVersion: 'organization.privacy_export.v1', organizationId, tenantId: organizationId, exportedAt, data,
        checksum: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    }
}

async function callTiPrivacy(organizationId: string, body?: Record<string, unknown>) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) throw new Error('Threat-intelligence privacy runtime is not configured')
    const response = await fetch(`${base}/v1/organizations/${encodeURIComponent(organizationId)}/privacy`, {
        method: body ? 'POST' : 'GET',
        headers: {
            accept: 'application/json',
            'x-hanasand-service-token': token,
            'x-organization-id': organizationId,
            'x-tenant-id': organizationId,
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => null) as any
    if (!response.ok && !(payload?.schemaVersion === 'organization.privacy_purge.ti.v1' && Array.isArray(payload.failed))) {
        throw new Error(payload?.error?.message || payload?.error || `Threat-intelligence privacy runtime returned ${response.status}`)
    }
    if (!payload) throw new Error('Threat-intelligence privacy runtime returned no data')
    return payload
}
