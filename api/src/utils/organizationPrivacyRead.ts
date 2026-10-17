import { queryOnce } from '#db'

export async function organizationPrivacyState(organizationId: string, page = { itemOffset: 0, itemLimit: 100 }) {
    const [organization, runs, requests, retentionItems, counts] = await Promise.all([
        queryOnce('SELECT id, name, status, retention_days, updated_at FROM organizations WHERE id = $1', [organizationId]),
        queryOnce('SELECT * FROM organization_retention_runs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 20', [organizationId]),
        queryOnce('SELECT * FROM organization_privacy_requests WHERE organization_id = $1 ORDER BY requested_at DESC LIMIT 20', [organizationId]),
        queryOnce(`
            SELECT item.*
              FROM organization_retention_run_items item
              JOIN organization_retention_runs run ON run.id = item.run_id
             WHERE item.organization_id = $1
             ORDER BY run.created_at DESC, item.processed_at DESC
             LIMIT $2 OFFSET $3
        `, [organizationId, page.itemLimit, page.itemOffset]),
        queryOnce(`
            SELECT
              (SELECT COUNT(*)::int FROM organization_retention_run_items WHERE organization_id = $1 AND status = 'protected') protected_events,
              (SELECT COUNT(*)::int FROM organization_retention_run_items WHERE organization_id = $1) total_retention_items,
              (SELECT COUNT(*)::int FROM admin_access_recovery_approvals WHERE organization_id = $1) access_recovery_holds,
              (SELECT COUNT(*)::int FROM system_events WHERE organization_id = $1) immutable_system_events,
              (SELECT COUNT(*)::int FROM dwm_webhook_audit_events WHERE org_id = $1) immutable_webhook_audit_events,
              (SELECT COUNT(*)::int FROM events WHERE ingestion_id='logs' AND (normalized #>> '{metadata,organizationId}' = $1 OR normalized #>> '{metadata,tenantId}' = $1)) immutable_log_events
        `, [organizationId]),
    ])
    return organizationPrivacyStateReadModel({
        organization: organization.rows[0],
        runs: runs.rows,
        requests: requests.rows,
        items: retentionItems.rows,
        page,
        totalRetentionItems: counts.rows[0]?.total_retention_items,
        protection: counts.rows[0],
    })
}

export function organizationPrivacyStateReadModel<TOrganization, TRun, TRequest, TItem, TProtection extends object>(input: {
    organization: TOrganization
    runs: TRun[]
    requests: TRequest[]
    items: TItem[]
    page: { itemOffset: number, itemLimit: number }
    totalRetentionItems: number | string | undefined
    protection: TProtection | undefined
}) {
    const nextOffset = input.page.itemOffset + input.items.length
    return {
        schemaVersion: 'organization.privacy_state.v1',
        organization: input.organization,
        runs: input.runs,
        requests: input.requests,
        items: input.items,
        itemPage: {
            offset: input.page.itemOffset,
            limit: input.page.itemLimit,
            nextOffset: nextOffset < Number(input.totalRetentionItems ?? 0)
                ? nextOffset
                : null,
        },
        protection: {
            ...input.protection,
            explanation: 'Legal holds and access-recovery evidence remain protected. Immutable audit references are retained; non-held customer configuration, payloads, identifiers, notes, owners, and event content are deleted or privacy-redacted.',
        },
    }
}
