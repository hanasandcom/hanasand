import { createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { queryOnce } from '../../src/utils/db.ts'
import {
    computeOutboundThirdPartyReportChecksum,
    normalizeDwmWebhookDestinationInput,
} from '../../src/utils/dwm/webhooks.ts'

export const database = 'hanasand_reporting_test'
export const ownerId = 'report_pg_owner'
export const adminId = 'report_pg_admin'
export const orgId = 'report_pg_org'
export const destinationId = 'report_pg_destination'
export const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
export const receiverObservationPath = '/tmp/hanasand-reporting-receiver-observation.json'
export const receiverReceivedAt = '2026-07-24T10:00:00.000Z'

export async function seed() {
    await queryOnce(`
        INSERT INTO users (id, name, password, avatar, active)
        VALUES
            ($1, 'Reporting PG owner', 'local-test', '', TRUE),
            ($2, 'Reporting PG admin', 'local-test', '', TRUE)
    `, [ownerId, adminId])
    await queryOnce(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, 'Reporting PG organization', 'reporting-pg-organization', $2)
    `, [orgId, ownerId])
    await queryOnce(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES
            ($1, $2, 'owner', 'active', $2),
            ($1, $3, 'admin', 'active', $2)
    `, [orgId, ownerId, adminId])

    const destination = normalizeDwmWebhookDestinationInput({
        orgId,
        name: 'Instrumented external receiver',
        kind: 'webhook',
        endpointUrl: receiverUrl,
        events: ['dwm.alert.updated'],
    }, ownerId)
    assert.ok(destination.endpointEncrypted && destination.endpointHint && destination.endpointHash)
    await queryOnce(`
        INSERT INTO dwm_webhook_destinations (
            id, owner_id, org_id, name, kind, endpoint_encrypted, endpoint_hint,
            endpoint_hash, status, events, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9::TEXT[], $2)
    `, [
        destinationId,
        ownerId,
        orgId,
        destination.name,
        destination.kind,
        destination.endpointEncrypted,
        destination.endpointHint,
        destination.endpointHash,
        destination.events,
    ])
}

export function deliveryInput(lineage: string, dryRun: boolean) {
    const report = reportFixture(lineage)
    return {
        orgId,
        destinationId,
        eventType: 'dwm.alert.updated' as const,
        dryRun,
        live: true,
        alert: {
            id: `report_pg_alert_${lineage}`,
            organizationId: orgId,
            tenantId: orgId,
            dedupeKey: report.exportChecksum,
            title: 'Evidence-backed report delivery',
            severity: 'medium',
            sourceFamily: 'clear_web',
            evidenceCount: 1,
            provenance: { captureIds: [`capture_${lineage}`], sourceIds: [`source_${lineage}`] },
            firstSeenAt: '2026-07-23T10:00:00.000Z',
            casePath: `/dwm/cases/case_${lineage}`,
            watchlist: { id: `watchlist_${lineage}`, terms: ['example.com'] },
            report,
        },
    }
}

export function reportFixture(lineage: string) {
    const evidenceId = `evidence_${lineage}`
    const draft = {
        schemaVersion: 'analyst.case_export.v1',
        generatedAt: '2026-07-23T10:00:00.000Z',
        evidence: [{ id: evidenceId, contentHash: `hash_${lineage}` }],
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'hanasand-json',
            caseId: `case_${lineage}`,
            alertId: `report_pg_alert_${lineage}`,
            organizationId: orgId,
            evidenceIds: [evidenceId],
            evidenceCount: 1,
        },
    }
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    return { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
}

export async function deliveryRows(alertId: string) {
    return (await queryOnce(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1 AND alert_id = $2
        ORDER BY created_at, id
    `, [orgId, alertId])).rows
}

export async function skippedDeliveryAudit(deliveryId: string) {
    const result = await queryOnce(`
        SELECT metadata
        FROM dwm_webhook_audit_events
        WHERE delivery_id = $1 AND action = 'delivery.skipped'
        ORDER BY created_at DESC
        LIMIT 1
    `, [deliveryId])
    assert.equal(result.rows.length, 1, `Expected one skipped-delivery audit event for ${deliveryId}.`)
    return result.rows[0].metadata as Record<string, unknown>
}

export async function cleanup(phase?: string) {
    await unlink(receiverObservationPath).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_audit_events WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_deliveries WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM dwm_webhook_destinations WHERE org_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organization_members WHERE organization_id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await queryOnce('DELETE FROM tokens WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    await queryOnce('DELETE FROM users WHERE id IN ($1, $2)', [ownerId, adminId]).catch(() => {})
    if (phase === 'cleanup') console.log(JSON.stringify({ phase, database, cleaned: true }, null, 2))
}

export function payloadHash(body: string) {
    return `payload_${createHash('sha256').update(body).digest('hex').slice(0, 32)}`
}
