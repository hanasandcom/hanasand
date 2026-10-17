import type { DwmWebhookDeliveryRow, DwmWebhookDestinationRow } from '../../webhookDestinationTypes.ts'
import { clean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { canonicalJson } from '../../customerOutputSafety.ts'
import { validateOutboundThirdPartyReport } from '../../thirdPartyReport.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'

export function validatePersistedDwmWebhookRetryPayload(
    prior: DwmWebhookDeliveryRow,
    destination: DwmWebhookDestinationRow,
    orgId: string,
) {
    const payloadBody = canonicalJson(prior.payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    if (payloadHash !== prior.payload_hash) {
        return {
            ok: false as const,
            code: 'persisted_payload_invalid',
            error: 'The persisted delivery payload does not match its stored hash.',
        }
    }

    const persistedReport = reportFromPersistedPayload(prior.payload)
    if (persistedReport) {
        const checksum = clean(persistedReport.exportChecksum)
        const validation = validateOutboundThirdPartyReport(persistedReport, {
            organizationId: orgId,
            alertId: prior.alert_id,
            dedupeKey: checksum,
        })
        const expectedIdempotencyKey = buildIdempotencyKey(prior.event_type, orgId, destination.id, checksum)
        if (!validation.valid || prior.idempotency_key !== expectedIdempotencyKey) {
            return {
                ok: false as const,
                code: 'persisted_report_invalid',
                error: validation.error || 'The persisted report idempotency lineage is invalid.',
            }
        }
    }

    return { ok: true as const, payloadBody, payloadHash, persistedReport }
}

export function reportFromPersistedPayload(payload: unknown) {
    const root = recordOrEmpty(payload)
    const direct = root.report
    const nested = recordOrEmpty(root._hanasand).report
    const report = direct ?? nested
    return report && typeof report === 'object' && !Array.isArray(report) ? report as Record<string, unknown> : undefined
}
