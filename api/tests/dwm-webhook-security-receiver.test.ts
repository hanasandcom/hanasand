import { describe, expect, test } from 'bun:test'
import { buildDwmAlertDeliveryPayload, signDwmWebhookDeliveryBody, validateDwmWebhookReceiverEnvelope } from '../src/utils/dwm/webhooks.ts'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'
import { validateOutboundThirdPartyReport } from '../src/utils/dwm/thirdPartyReport.ts'
import { reportFixture, restoreEnv, withReportChecksum } from './fixtures/dwm-webhook-report.ts'

describe('DWM webhook receiver contract security', () => {
    test('binds a receiver receipt contract to the exact report payload and delivery lineage', () => {
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
        const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'receiver-signature-test'
        process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl
        const report = reportFixture()
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_report', kind: 'webhook', name: 'External receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.updated',
            deliveryId: 'delivery_report',
            alert: {
                id: 'alert_1',
                tenantId: 'org_1',
                dedupeKey: report.exportChecksum,
                title: 'Evidence-backed case report',
                firstSeenAt: '2026-07-23T10:00:00.000Z',
                report,
            },
        })
        const envelopeFor = (candidate: Record<string, unknown>) => ({
            eventId: 'receiver_event_1',
            receivedAt: '2026-07-24T10:00:00.000Z',
            payload: candidate,
            signature: signDwmWebhookDeliveryBody(canonicalJson(candidate), receiverUrl),
        })
        try {
            const envelope = envelopeFor(payload)
            const first = validateDwmWebhookReceiverEnvelope(envelope)
            const replay = validateDwmWebhookReceiverEnvelope(envelope)
            expect(first).toMatchObject({
                valid: true,
                receipt: {
                    orgId: 'org_1',
                    destinationId: 'destination_report',
                    deliveryId: 'delivery_report',
                    reportValidation: 'valid',
                    reportCaseId: 'case_1',
                    reportAlertId: 'alert_1',
                    reportExportChecksum: report.exportChecksum,
                },
            })
            expect(replay).toEqual(first)
            const payloadBody = JSON.stringify(payload, null, 2)
            expect(validateDwmWebhookReceiverEnvelope({
                ...envelope,
                payloadBody,
                deliveryId: 'delivery_report',
                idempotencyKey: payload.idempotencyKey,
                signature: signDwmWebhookDeliveryBody(payloadBody, receiverUrl),
            })).toMatchObject({ valid: true })
            expect(validateDwmWebhookReceiverEnvelope({
                ...envelope,
                payloadBody: JSON.stringify({ ...payload, eventType: 'dwm.alert.created' }),
            })).toMatchObject({
                valid: false,
                error: 'Receiver serialized payload does not match its parsed payload.',
            })
            expect(validateDwmWebhookReceiverEnvelope({ ...envelope, signature: 'sha256=forged' })).toMatchObject({
                valid: false,
                error: 'Receiver payload signature is invalid.',
            })
            expect(validateDwmWebhookReceiverEnvelope({
                ...envelope,
                signature: signDwmWebhookDeliveryBody(canonicalJson(payload), 'https://external.example/report'),
            })).toMatchObject({
                valid: false,
                error: 'Receiver payload signature is invalid.',
            })

            const wrongScope = {
                ...payload,
                org: { ...payload.org, id: 'org_other', tenantId: 'org_other' },
            }
            expect(validateDwmWebhookReceiverEnvelope(envelopeFor(wrongScope))).toMatchObject({
                valid: false,
                error: 'report organization does not match delivery scope.',
            })
            expect(validateDwmWebhookReceiverEnvelope(envelopeFor({
                ...payload,
                report: { ...report, body: 'raw evidence' },
            }))).toMatchObject({ valid: false })
            const legacy = {
                eventType: 'organization.webhook.test',
                organizationId: 'org_1',
                tenantId: 'org_1',
                webhookDestinationId: 'destination_report',
                deliveryId: 'legacy_delivery',
                idempotencyKey: 'legacy_delivery',
            }
            expect(validateDwmWebhookReceiverEnvelope(envelopeFor(legacy))).toMatchObject({
                valid: false,
                error: 'Receiver accepts only the canonical DWM webhook contract.',
            })
        } finally {
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
            restoreEnv('DWM_CONTROLLED_RECEIVER_URLS', previousReceiverUrls)
        }
    })

    test('keeps idempotency stable per event while allowing created, updated, and replayed delivery', () => {
        const destination = { id: 'destination_1', kind: 'webhook' as const, name: 'External receiver', org_id: 'org_1' }
        const alert = {
            id: 'alert_1',
            tenantId: 'org_1',
            dedupeKey: 'same_report_checksum',
            title: 'Evidence-backed case report',
            firstSeenAt: '2026-07-23T10:00:00.000Z',
        }
        const created = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.created' }) as any
        const duplicateCreated = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.created' }) as any
        const updated = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.updated' }) as any
        const replayed = buildDwmAlertDeliveryPayload({ destination, alert, eventType: 'dwm.alert.replayed' }) as any

        expect(created.idempotencyKey).toBe(duplicateCreated.idempotencyKey)
        expect(new Set([created.idempotencyKey, updated.idempotencyKey, replayed.idempotencyKey]).size).toBe(3)
        expect(created.idempotencyKey).toContain('dwm.alert.created')
        expect(updated.idempotencyKey).toContain('dwm.alert.updated')
        expect(replayed.idempotencyKey).toContain('dwm.alert.replayed')
    })

    test('rejects duplicate and non-canonical evidence selection before checksum delivery', () => {
        const report = reportFixture('json')
        const duplicate = withReportChecksum({
            ...report,
            evidence: [{ id: 'evidence_1' }, { id: 'evidence_1' }],
            reportPolicy: { ...report.reportPolicy, evidenceIds: ['evidence_1', 'evidence_1'], evidenceCount: 2 },
        })
        expect(validateOutboundThirdPartyReport(duplicate)).toMatchObject({ valid: false })

        const unordered = withReportChecksum({
            ...report,
            evidence: [{ id: 'evidence_2' }, { id: 'evidence_1' }],
            reportPolicy: { ...report.reportPolicy, evidenceIds: ['evidence_2', 'evidence_1'], evidenceCount: 2 },
        })
        expect(validateOutboundThirdPartyReport(unordered)).toMatchObject({ valid: false, error: 'report evidenceIds must use canonical order.' })
    })

})
