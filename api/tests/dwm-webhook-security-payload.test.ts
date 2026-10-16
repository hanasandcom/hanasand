import { describe, expect, test } from 'bun:test'
import { buildDwmAlertDeliveryPayload, computeOutboundThirdPartyReportChecksum as checksumFromWebhookModule, validateOutboundThirdPartyReport as validateFromWebhookModule } from '../src/utils/dwm/webhooks.ts'
import { computeOutboundThirdPartyReportChecksum, validateOutboundThirdPartyReport } from '../src/utils/dwm/thirdPartyReport.ts'
import { containsUnsafeCustomerOutboundText, sanitizeCustomerOutboundText } from '../src/utils/dwm/customerOutputSafety.ts'
import { reportFixture, withReportChecksum } from './fixtures/dwm-webhook-report.ts'

describe('DWM webhook payload and outbound report security', () => {
    test('matches the fixed canonical report checksum vector', () => {
        const report = {
            schemaVersion: 'vector.v1',
            title: 'Historical checksum vector',
            exportChecksum: 'excluded-root-value',
            reportPolicy: {
                direction: 'outbound_third_party',
                format: 'hanasand-json',
                caseId: 'case_vector_1',
                alertId: 'alert_vector_1',
                organizationId: 'org_vector_1',
                evidenceIds: ['evidence_vector_1'],
                evidenceCount: 1,
                exportChecksum: 'excluded-policy-value',
            },
        }

        expect(computeOutboundThirdPartyReportChecksum(report)).toBe(
            'case_report_5cde01c6dee815a260fa226b89a88a85f2aff1a4b8ad2eaf3ba57b06b1a5e622',
        )
    })
    test('preserves scraper evidence excerpts and observation timestamps', () => {
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_1', kind: 'webhook', name: 'Customer receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.created',
            deliveryId: 'delivery_1',
            alert: {
                id: 'alert_1',
                title: 'APT29 source mention',
                severity: 'low',
                matchedTerm: { value: 'APT29', kind: 'actor' },
                firstSeenAt: '2026-07-21T07:15:42.826Z',
                evidence: [{
                    sourceName: 'Public threat report',
                    excerpt: 'Public reporting attributes the activity to APT29.',
                    observedAt: '2026-07-21T07:15:42.826Z',
                }],
            },
        }) as any

        expect(payload.alert.evidence).toEqual([{
            label: 'Evidence',
            detail: 'Public reporting attributes the activity to APT29.',
            source: 'Public threat report',
            capturedAt: '2026-07-21T07:15:42.826Z',
        }])
        expect(payload.alert.evidenceTimestamp).toBe('2026-07-21T07:15:42.826Z')
    })

    test('does not invent current timestamps for an undated alert payload', () => {
        const payload = buildDwmAlertDeliveryPayload({
            destination: { id: 'destination_1', kind: 'webhook', name: 'Customer receiver', org_id: 'org_1' },
            eventType: 'dwm.alert.created',
            deliveryId: 'delivery_undated',
            alert: { id: 'alert_undated', title: 'Undated alert', severity: 'low' },
        }) as any

        expect(String(payload.occurredAt || '')).not.toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(String(payload.alert.eventTimestamp || '')).not.toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(String(payload.alert.evidenceTimestamp || '')).not.toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('preserves one bounded validated report and keys delivery idempotency to its checksum', () => {
        const report = reportFixture()
        expect(checksumFromWebhookModule).toBe(computeOutboundThirdPartyReportChecksum)
        expect(validateFromWebhookModule).toBe(validateOutboundThirdPartyReport)
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_1', dedupeKey: report.exportChecksum })).toMatchObject({ valid: true, report })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_other', alertId: 'alert_1', dedupeKey: report.exportChecksum })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_other', dedupeKey: report.exportChecksum })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport(report, { organizationId: 'org_1', alertId: 'alert_1', dedupeKey: 'other_checksum' })).toMatchObject({ valid: false })
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
        }) as any
        expect(payload.report).toEqual(report)
        expect(payload.idempotencyKey).toContain(report.exportChecksum)
        const missingPublished = withReportChecksum({
            ...report,
            bundle: {
                ...(report.bundle as Record<string, unknown>),
                objects: (report.bundle as { objects: Array<Record<string, unknown>> }).objects.map(object => object.type === 'report'
                    ? Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'published'))
                    : object),
            },
        })
        expect(validateOutboundThirdPartyReport(missingPublished)).toMatchObject({ valid: false, error: 'STIX report published must be a valid timestamp.' })
        expect(validateOutboundThirdPartyReport({ ...report, body: 'raw evidence' })).toMatchObject({ valid: false })
        expect(validateOutboundThirdPartyReport({ ...report, reportPolicy: { ...report.reportPolicy, evidenceCount: 26 } })).toMatchObject({ valid: false })
        for (const unsafe of [
            'hiddenservice.onion/path',
            'hiddenservice.i2p/path',
            'https://t.me/source_contact',
            'operator@criminal.example',
            '@operator_handle',
            'telegram: attacker_handle',
            'token=secret-value',
            '+47 912 34 567',
            '1:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678901:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '12345678901234567890123456789012:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            '1234567890123456789012345678901234567890:BOTTOKENSECRETABCDEFGHIJKLMNOP',
            'https://telegram.dog/source_contact',
            'api_key=APIKEYSECRET123',
            'key=KEYSECRET123456',
            'access_token=ACCESSSECRET123',
            'refresh_token=REFRESHSECRET123',
            'client_secret=CLIENTSECRET123',
            'private_key=PRIVATEKEYSECRET123',
            'password=PASSWORDSECRET123',
            'passwd=PASSWDSECRET123',
            'session_string=SESSIONSECRET123',
            'authorization=AUTHSECRET123',
            'cookie=COOKIESECRET123',
            'Bearer BEARERSECRET123',
            'Basic BASICSECRET123',
            'sk_CREDENTIALSECRET123456789',
        ]) {
            const sanitized = sanitizeCustomerOutboundText(unsafe)
            expect(sanitized).not.toContain(unsafe)
            expect(containsUnsafeCustomerOutboundText(sanitized)).toBe(false)

            for (const format of ['stix', 'json'] as const) {
                const changed = withReportChecksum({ ...reportFixture(format), note: unsafe })
                expect(validateOutboundThirdPartyReport(changed)).toMatchObject({ valid: false })
                expect(validateOutboundThirdPartyReport(withReportChecksum({ ...reportFixture(format), note: sanitized }))).toMatchObject({ valid: true })
            }
        }
    })
})
