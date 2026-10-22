import run from '#db'
import { logsOutboxEnabled, logsServiceConfiguration } from './logOutboxConfig.ts'
import type { Organization } from './logOutboxTypes.ts'

type Query = typeof run
type SnapshotRule = Record<string, unknown> & { updated_at: Date | string }

export async function enqueueOrganizationSnapshots(organizations: Organization[], query: Query) {
    if (!organizations.length) return
    const rules = await query(`SELECT id, organization_id, rule_id, version, name, family, severity,
        explanation, definition, source, source_reference, enabled, created_by, created_at, updated_at
        FROM rules WHERE organization_id = ANY($1::text[]) ORDER BY organization_id, rule_id`, [organizations.filter(item => item.status !== 'deleted').map(item => item.id)])
    const rulesByOrganization = new Map<string, SnapshotRule[]>()
    for (const rule of rules.rows as Array<Record<string, unknown> & { organization_id: string; updated_at: Date | string }>) {
        const { organization_id: organizationId, ...value } = rule
        rulesByOrganization.set(organizationId, [...(rulesByOrganization.get(organizationId) || []), {
            ...value, updated_at: rule.updated_at, sourceReference: String(value.source_reference || value.id),
        } as SnapshotRule])
    }

    const organizationPayloads = organizations.map(organization => {
        const storedRules = rulesByOrganization.get(organization.id) || []
        const organizationRules = organization.status === 'active' ? storedRules : storedRules.map(rule => ({ ...rule, enabled: false }))
        const newestRule = organizationRules.reduce<Date | string | null>((latest, rule) => {
            const current = rule.updated_at as Date | string
            return !latest || new Date(current).getTime() > new Date(latest).getTime() ? current : latest
        }, null)
        const sourceUpdatedAt = newestRule && new Date(newestRule).getTime() > new Date(organization.updated_at).getTime()
            ? newestRule : organization.updated_at
        const payload = {
            id: organization.id, name: organization.name, status: organization.status,
            retentionDays: organization.retention_days, auditSafeMetadata: organization.audit_safe_metadata,
            updatedAt: sourceUpdatedAt, rules: organizationRules,
        }
        return { id: organization.id, source_updated_at: sourceUpdatedAt, payload }
    })
    await query(`INSERT INTO log_organization_sync_outbox(organization_id, source_updated_at, payload)
            SELECT item.id, item.source_updated_at, item.payload FROM jsonb_to_recordset($1::jsonb) AS item(
                id text, source_updated_at timestamptz, payload jsonb)
            ON CONFLICT (organization_id) DO UPDATE SET
                source_updated_at=GREATEST(EXCLUDED.source_updated_at, log_organization_sync_outbox.source_updated_at + INTERVAL '1 microsecond'),
                payload=jsonb_set(EXCLUDED.payload, '{updatedAt}', to_jsonb(GREATEST(EXCLUDED.source_updated_at,
                    log_organization_sync_outbox.source_updated_at + INTERVAL '1 microsecond')), FALSE),
                attempts=0, available_at=NOW(), lease_until=NULL, delivered_at=NULL, last_error=NULL
            WHERE log_organization_sync_outbox.source_updated_at < EXCLUDED.source_updated_at
               OR (log_organization_sync_outbox.payload - 'updatedAt') IS DISTINCT FROM (EXCLUDED.payload - 'updatedAt')`, [JSON.stringify(organizationPayloads)])
}

export async function refreshLogsOrganizationSnapshotBatch(query: Query = run) {
    const config = logsServiceConfiguration()
    if (!logsOutboxEnabled() || !config.url || !config.ingestToken || !config.syncToken) return 0
    const result = await query(`WITH cursor AS (
            SELECT COALESCE((SELECT organization_id FROM log_organization_sync_cursor WHERE id=TRUE), '') last_id
        ), selected AS (
            SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
            FROM organizations, cursor WHERE id > last_id ORDER BY id LIMIT 10
        ) SELECT * FROM selected`)
    let organizations = result.rows as Organization[]
    if (!organizations.length) {
        const first = await query(`SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
            FROM organizations ORDER BY id LIMIT 10`)
        organizations = first.rows as Organization[]
    }
    if (!organizations.length) return 0
    await enqueueOrganizationSnapshots(organizations, query)
    await query(`INSERT INTO log_organization_sync_cursor(id, organization_id, updated_at)
        VALUES(TRUE,$1,NOW()) ON CONFLICT(id) DO UPDATE SET organization_id=EXCLUDED.organization_id, updated_at=NOW()`,
    [organizations[organizations.length - 1]!.id])
    return organizations.length
}
