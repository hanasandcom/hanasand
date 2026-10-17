import { queryOnce } from '#db'
import type { RetentionRun } from './organizationPrivacyPolicy.ts'

export async function refreshRun(retentionRun: RetentionRun, input: { status: 'queued' | 'failed' | 'dead_letter' | 'completed', error: string | null, result: Record<string, unknown> }) {
    const retry = input.status === 'failed'
    const retryDelaySeconds = retry ? Math.min(3_600, 60 * 2 ** Math.max(0, retentionRun.attempt_count - 1)) : 0
    await queryOnce(`
        UPDATE organization_retention_runs run
           SET status = $2, error = $3, result = $4::jsonb,
               selected_count = counts.selected_count,
               protected_count = counts.protected_count,
               deleted_count = counts.deleted_count,
               redacted_count = counts.redacted_count,
               failed_count = counts.failed_count,
               retried_count = counts.retried_count,
               attempt_count = CASE WHEN $2 = 'queued' THEN 0 ELSE attempt_count END,
               next_retry_at = CASE WHEN $5::boolean THEN NOW() + ($6::int * INTERVAL '1 second') WHEN $2 = 'queued' THEN NOW() ELSE NULL END,
               completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
               updated_at = NOW()
          FROM (
            SELECT COUNT(*)::int selected_count,
                   COUNT(*) FILTER (WHERE status = 'protected')::int protected_count,
                   COUNT(*) FILTER (WHERE status = 'deleted')::int deleted_count,
                   COUNT(*) FILTER (WHERE status = 'redacted')::int redacted_count,
                   COUNT(*) FILTER (WHERE status = 'failed')::int failed_count,
                   COUNT(*) FILTER (WHERE status = 'retried')::int retried_count
              FROM organization_retention_run_items WHERE run_id = $1
          ) counts
         WHERE run.id = $1
    `, [retentionRun.id, input.status, input.error, JSON.stringify(input.result), retry, retryDelaySeconds])
    if (retentionRun.privacy_request_id) {
        await queryOnce(`
            UPDATE organization_privacy_requests
               SET status = CASE WHEN $2 = 'completed' THEN 'completed' WHEN $2 IN ('failed', 'dead_letter') THEN 'failed' ELSE 'running' END,
                   error = $3, result = $4::jsonb,
                   started_at = COALESCE(started_at, NOW()),
                   completed_at = CASE WHEN $2 IN ('completed', 'dead_letter') THEN NOW() ELSE NULL END,
                   retry_count = CASE WHEN $2 IN ('failed', 'dead_letter') THEN retry_count + 1 ELSE retry_count END,
                   updated_at = NOW()
             WHERE id = $1
        `, [retentionRun.privacy_request_id, input.status, input.error, JSON.stringify(input.result)])
    }
}

export async function beginPrivacyDeletion(retentionRun: RetentionRun) {
    const locked = await queryOnce(`
        UPDATE organizations
           SET status = 'archived',
               audit_safe_metadata = audit_safe_metadata || jsonb_build_object(
                   'privacyDeletionRunId', $2::text,
                   'privacyDeletionPendingAt', COALESCE(audit_safe_metadata->'privacyDeletionPendingAt', to_jsonb(NOW()))
               ),
               updated_at = NOW()
         WHERE id = $1 AND status <> 'deleted'
           AND (NOT (audit_safe_metadata ? 'privacyDeletionRunId') OR audit_safe_metadata->>'privacyDeletionRunId' = $2)
         RETURNING id
    `, [retentionRun.organization_id, retentionRun.id])
    if (!locked.rows[0]) throw new Error('Organization is deleted or locked by another privacy deletion run.')
}

export async function completePrivacyDeletion(retentionRun: RetentionRun, protection: { heldAlertIds: string[], protectedWatchlistIds: string[] }) {
    const completed = await queryOnce(`
        WITH locked_organization AS MATERIALIZED (
            SELECT id FROM organizations WHERE id = $1 FOR UPDATE
        ), deleted_members AS (
            DELETE FROM organization_members
             WHERE organization_id IN (SELECT id FROM locked_organization)
            RETURNING user_id
        ), deleted_invites AS (
            DELETE FROM organization_invites invite
             WHERE invite.organization_id IN (SELECT id FROM locked_organization)
               AND NOT EXISTS (SELECT 1 FROM admin_access_recovery_approvals approval WHERE approval.invite_id = invite.id)
            RETURNING id
        ), deleted_watchlists AS (
            DELETE FROM organization_watchlist_items watchlist
             WHERE watchlist.organization_id IN (SELECT id FROM locked_organization)
               AND NOT (watchlist.id = ANY($3::text[]) OR ('org_' || watchlist.id) = ANY($3::text[]))
            RETURNING id
        ), deleted_destinations AS (
            DELETE FROM dwm_webhook_destinations destination
             WHERE destination.org_id IN (SELECT id FROM locked_organization)
            RETURNING id
        ), redacted_deliveries AS (
            UPDATE dwm_webhook_deliveries delivery
               SET endpoint_hint = '', endpoint_hash = '', payload = '{}'::jsonb,
                   response_body = NULL, error = NULL, error_class = NULL,
                   idempotency_key = 'privacy:' || delivery.id, watchlist_name = NULL,
                   route = NULL, case_path = NULL, next_retry_at = NULL, updated_at = NOW()
             WHERE delivery.org_id IN (SELECT id FROM locked_organization)
               AND NOT (delivery.alert_id = ANY($4::text[]))
               AND (delivery.payload <> '{}'::jsonb OR delivery.response_body IS NOT NULL OR delivery.error IS NOT NULL
                    OR delivery.endpoint_hint <> '' OR delivery.watchlist_name IS NOT NULL OR delivery.route IS NOT NULL OR delivery.case_path IS NOT NULL)
            RETURNING id
        ), redacted_system_event AS (
            UPDATE system_events event
               SET actor_id = NULL, object_id = NULL, subject_id = NULL, request_id = NULL,
                   reason = '', context = jsonb_build_object('privacyDeletionRunId', $2::text),
                   ip = '', user_agent = ''
             WHERE event.organization_id IN (SELECT id FROM locked_organization)
               AND (event.actor_id IS NOT NULL OR event.object_id IS NOT NULL OR event.subject_id IS NOT NULL
                    OR event.request_id IS NOT NULL OR event.reason <> '' OR event.context <> '{}'::jsonb
                    OR event.ip <> '' OR event.user_agent <> '')
            RETURNING id::text id
        ), redacted_webhook_audit AS (
            UPDATE dwm_webhook_audit_events event
               SET owner_id = NULL, actor_id = NULL,
                   metadata = jsonb_build_object('privacyDeletionRunId', $2::text)
             WHERE event.org_id IN (SELECT id FROM locked_organization)
               AND (event.owner_id IS NOT NULL OR event.actor_id IS NOT NULL
                    OR event.metadata <> jsonb_build_object('privacyDeletionRunId', $2::text))
            RETURNING id
        ), redacted_log_events AS (
            UPDATE events event
               SET event_type='application', action=COALESCE(NULLIF(event.normalized #>> '{metadata,action}', ''), 'post_delete_event'),
                   outcome='recorded', user_id=NULL, user_email=NULL, source_ip=NULL, source_country=NULL, source_city=NULL, device_id=NULL,
                   normalized=jsonb_build_object('schema_version','logs.v1','source_vendor','Hanasand','source_product','Logs',
                       'timestamp',event.event_timestamp,'event_type','application','action',COALESCE(NULLIF(event.normalized #>> '{metadata,action}', ''),'post_delete_event'),
                       'outcome','recorded','level','info','service','hanasand-api','host','',
                       'message',COALESCE(NULLIF(event.normalized #>> '{metadata,action}', ''),'organization_event'),
                       'metadata',jsonb_strip_nulls(jsonb_build_object(
                           'category',event.normalized #>> '{metadata,category}','action',event.normalized #>> '{metadata,action}',
                           'organizationId',$1::text,'tenantId',$1::text,'outcome','recorded','privacyDeletionRunId',$2::text))),
                   original=event.original-'service_log_id'-'references'
             WHERE event.ingestion_id='logs' AND (event.normalized #>> '{metadata,organizationId}' = $1
                OR event.normalized #>> '{metadata,tenantId}' = $1)
            RETURNING id::text id
        ), affected AS (
            SELECT 'organization_member' record_type, user_id record_id, 'delete' action, 'deleted' status FROM deleted_members
            UNION ALL SELECT 'organization_invite', id, 'delete', 'deleted' FROM deleted_invites
            UNION ALL SELECT 'organization_watchlist_item', id, 'delete', 'deleted' FROM deleted_watchlists
            UNION ALL SELECT 'dwm_webhook_destination', id, 'delete', 'deleted' FROM deleted_destinations
            UNION ALL SELECT 'dwm_webhook_delivery', id, 'redact', 'redacted' FROM redacted_deliveries
            UNION ALL SELECT 'system_event_event', id, 'redact', 'redacted' FROM redacted_system_event
            UNION ALL SELECT 'dwm_webhook_audit_event', id, 'redact', 'redacted' FROM redacted_webhook_audit
            UNION ALL SELECT 'event', id, 'redact', 'redacted' FROM redacted_log_events
        ), recorded AS (
            INSERT INTO organization_retention_run_items (
                run_id, organization_id, source_service, record_type, record_id,
                action, status, reason
            )
            SELECT $2, $1, 'hanasand-api', record_type, record_id,
                   action, status, 'organization_privacy_deletion'
              FROM affected
            ON CONFLICT (run_id, source_service, record_type, record_id)
            DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                          reason = EXCLUDED.reason, error = NULL,
                          attempt_count = organization_retention_run_items.attempt_count + 1,
                          processed_at = NOW()
        )
        UPDATE organizations
           SET name = 'Deleted organization', slug = 'deleted-' || id,
               created_by = NULL, status = 'deleted',
               default_webhook_policy = 'disabled', alert_visibility_policy = 'owners',
               retention_days = 30,
               audit_safe_metadata = jsonb_build_object(
                   'privacyDeletedAt', NOW(),
                   'privacyDeletionRunId', $2::text
               ),
               updated_at = NOW()
         WHERE id IN (SELECT id FROM locked_organization)
         RETURNING id
    `, [retentionRun.organization_id, retentionRun.id, protection.protectedWatchlistIds, protection.heldAlertIds])
    if (!completed.rows[0]) throw new Error('Organization disappeared before privacy deletion could be finalized.')
}
