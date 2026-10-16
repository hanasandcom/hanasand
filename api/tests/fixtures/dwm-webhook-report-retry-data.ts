import { createHash } from 'node:crypto'
import { canonicalJson } from '../../src/utils/dwm/customerOutputSafety.ts'

export function deliveryInput(dedupeKey: string, dryRun: boolean) {
    return {
        orgId: 'org_1', destinationId: 'destination_1', eventType: 'dwm.alert.updated', dryRun, live: true,
        alert: {
            id: 'alert_1', organizationId: 'org_1', tenantId: 'org_1', dedupeKey,
            title: 'Evidence-backed report delivery', severity: 'medium', sourceFamily: 'clear_web',
            evidenceCount: 1, provenance: { captureIds: ['capture_1'], sourceIds: ['source_1'] },
            firstSeenAt: '2026-07-23T10:00:00.000Z', casePath: '/dwm?alert=alert_1',
            watchlist: { id: 'watch_1', terms: ['example.com'] },
        },
    }
}

export function reportDeliveryPayload() {
    const draft = reportDraft('2026-07-24T10:00:00.000Z')
    const exportChecksum = `case_report_${createHash('sha256').update(canonicalJson(draft)).digest('hex')}`
    const report = { ...draft, exportChecksum, reportPolicy: { ...draft.reportPolicy, exportChecksum } }
    return {
        schemaVersion: 'dwm.webhook.v1', eventType: 'dwm.alert.updated', occurredAt: '2026-07-24T10:00:00.000Z',
        idempotencyKey: `dwm.alert.updated:org_1:destination_1:${exportChecksum}`,
        org: { id: 'org_1', tenantId: 'org_1' }, destination: { id: 'destination_1', kind: 'webhook' }, report,
        alert: { id: 'alert_1' }, delivery: { id: 'delivery_receiver_1', eventType: 'dwm.alert.updated' },
    }
}

export function reportDraft(published: string) {
    return {
        bundle: {
            type: 'bundle', id: 'bundle--11111111-1111-4111-8111-111111111111',
            objects: [
                { type: 'identity', spec_version: '2.1', id: 'identity--11111111-1111-4111-8111-111111111111' },
                { type: 'x-ti-evidence', spec_version: '2.1', id: 'x-ti-evidence--11111111-1111-4111-8111-111111111111', x_ti_capture_id: 'capture_1', x_ti_source_id: 'source_1', x_ti_content_hash: 'hash_1' },
                { type: 'report', spec_version: '2.1', id: 'report--11111111-1111-4111-8111-111111111111', published, object_refs: ['x-ti-evidence--11111111-1111-4111-8111-111111111111'] },
            ],
        },
        reportPolicy: { direction: 'outbound_third_party', format: 'stix-2.1', caseId: 'case_1', alertId: 'alert_1', organizationId: 'org_1', evidenceIds: ['evidence_1'], evidenceCount: 1 },
        standardsValidation: { standard: 'STIX 2.1', valid: true, issues: [] },
    }
}

export function failedDeliveryFixture(nextRetryAt: string) {
    const payload = { schemaVersion: 'dwm.webhook.v1', alert: { id: 'alert_1', title: 'Persisted delivery' }, delivery: { dedupeKey: 'retry_fixture' } }
    return {
        id: 'failed_delivery_fixture', destination_id: 'destination_1', owner_id: 'owner_1', org_id: 'org_1',
        alert_id: 'alert_1', event_type: 'dwm.alert.updated', status: 'failed', dry_run: false,
        endpoint_hint: 'receiver.example/...', endpoint_hash: 'endpoint_hash', payload_hash: payloadHash(canonicalJson(payload)), payload,
        response_status: 503, response_body: 'retry later', error: 'Webhook returned HTTP 503.', error_class: 'upstream_5xx',
        attempt_count: 1, next_retry_at: nextRetryAt, idempotency_key: 'dwm.alert.updated:org_1:destination_1:retry_fixture',
        watchlist_id: null, watchlist_name: null, route: 'customer_webhook', case_path: '/dwm/cases/case_1',
        attempted_at: '2020-07-23T10:00:00.000Z', completed_at: '2020-07-23T10:00:01.000Z', delivered_at: null,
        created_at: '2020-07-23T10:00:00.000Z',
    }
}

export function payloadHash(body: string) {
    return `payload_${createHash('sha256').update(body).digest('hex').slice(0, 32)}`
}

export function endpointHash(url: string) {
    return `endpoint_${createHash('sha256').update(new URL(url).toString()).digest('hex').slice(0, 32)}`
}
