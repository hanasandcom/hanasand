import { describe, expect, test } from 'bun:test'
import { canonicalThirdPartyReportForDelivery } from '../src/handlers/dwm/webhooks.ts'
import { reportFixture, restoreEnv, withReportChecksum } from './fixtures/dwm-webhook-report.ts'

describe('DWM webhook canonical TI report verification', () => {
    test('accepts and returns the canonical report with scoped verification context', async () => {
        const canonical = reportFixture()
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        try {
            let request: Request | undefined
            const result = await canonicalThirdPartyReportForDelivery({
                submittedReport: reportFixture(),
                organizationId: 'org_1',
                alertId: 'alert_1',
                dedupeKey: canonical.exportChecksum,
                actorId: 'user_1',
                authorization: 'Bearer session',
            }, async (input, init) => {
                request = new Request(input, init)
                return Response.json(canonical)
            })

            expect(result).toMatchObject({ status: 200, report: canonical })
            expect(request?.url).toContain('/v1/cases/case_1/export?')
            expect(request?.url).toContain('organizationId=org_1')
            expect(request?.url).toContain('alertId=alert_1')
            expect(request?.url).toContain('evidenceId=evidence_1')
            expect(request?.headers.get('x-hanasand-service-token')).toBe('service-secret')
            expect(request?.headers.get('x-organization-id')).toBe('org_1')
            expect(request?.headers.get('id')).toBe('user_1')
            expect(request?.headers.get('authorization')).toBe('Bearer session')
            expect(request?.cache).toBe('no-store')
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })

    test('rejects a self-consistent caller-forged report when canonical TI checksum differs', async () => {
        const canonical = reportFixture()
        const forged = withReportChecksum({
            ...canonical,
            bundle: {
                ...canonical.bundle,
                objects: canonical.bundle.objects.map(item => item.type === 'report' ? { ...item, name: 'Caller-forged conclusion' } : item),
            },
        })
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        try {
            const requests: Request[] = []
            const result = await canonicalThirdPartyReportForDelivery({
                submittedReport: forged,
                organizationId: 'org_1',
                alertId: 'alert_1',
                dedupeKey: forged.exportChecksum,
                actorId: 'user_1',
                authorization: 'Bearer session',
            }, async (input, init) => {
                requests.push(new Request(input, init))
                return Response.json(canonical)
            })
            expect(result).toMatchObject({ status: 409, code: 'third_party_report_checksum_mismatch' })
            expect(requests).toHaveLength(1)
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })

    test('rejects a canonical TI response whose payload no longer matches its checksum', async () => {
        const submitted = reportFixture()
        const changedCanonical = {
            ...submitted,
            bundle: {
                ...submitted.bundle,
                objects: submitted.bundle.objects.map(item => item.type === 'report' ? { ...item, name: 'Changed after checksum' } : item),
            },
        }
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        try {
            const result = await canonicalThirdPartyReportForDelivery({
                submittedReport: submitted,
                organizationId: 'org_1',
                alertId: 'alert_1',
                dedupeKey: submitted.exportChecksum,
                actorId: 'user_1',
            }, async () => Response.json(changedCanonical))
            expect(result).toMatchObject({ status: 502, code: 'canonical_third_party_report_invalid' })
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })

    test('bounds canonical TI transport and payload failures without reflecting network detail', async () => {
        const submitted = reportFixture()
        const previousBase = process.env.TI_SCRAPER_API_BASE
        const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_API_BASE = 'https://ti.internal.test'
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        const verify = (fetcher: typeof fetch) => canonicalThirdPartyReportForDelivery({
            submittedReport: submitted,
            organizationId: 'org_1',
            alertId: 'alert_1',
            dedupeKey: submitted.exportChecksum,
            actorId: 'user_1',
        }, fetcher)
        try {
            const unavailable = await verify(async () => {
                throw new Error('connect ECONNREFUSED private-ti.internal:9443')
            })
            expect(unavailable).toMatchObject({ status: 503, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(unavailable)).not.toContain('private-ti.internal')

            const nonJson = await verify(async () => new Response('<h1>proxy secret</h1>', { status: 200 }))
            expect(nonJson).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(nonJson)).not.toContain('proxy secret')

            const invalidJson = await verify(async () => Response.json(null))
            expect(invalidJson).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })

            const upstreamFailure = await verify(async () => Response.json({ error: 'database host pg-secret.internal' }, { status: 503 }))
            expect(upstreamFailure).toMatchObject({ status: 502, code: 'third_party_report_verification_unavailable' })
            expect(JSON.stringify(upstreamFailure)).not.toContain('pg-secret.internal')
        } finally {
            restoreEnv('TI_SCRAPER_API_BASE', previousBase)
            restoreEnv('TI_SCRAPER_SERVICE_TOKEN', previousToken)
        }
    })
})
