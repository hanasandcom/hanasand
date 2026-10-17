import { describe, expect, test } from 'bun:test'
import { matchApiKeyScope, organizationPublicApiScopes } from '../src/utils/auth/apiKeys.ts'
import { credentialPeriodLimits } from '../src/plugins/rateLimit.ts'
import { testApp } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('findings scopes preserve existing keys and quotas without widening access', () => {
        const scope = organizationPublicApiScopes().find(scope => scope.route === '/api/v1/findings')!
        expect(scope).toBeDefined()
        const expectedLimits = { perSecond: 2, perMinute: 60, perHour: 1_000, perDay: 10_000 }
        for (const savedRoute of ['/api/v1/claims', '/api/v1/findings']) {
            const saved = { ...scope, route: savedRoute }
            for (const route of ['/api/v1/claims', '/api/v1/findings']) {
                const matchedScope = matchApiKeyScope([saved], 'GET', route)
                expect(matchedScope).toBe(saved)
                expect(credentialPeriodLimits({ actorIdentifier: 'api_key:key', apiKeyScope: matchedScope, method: 'GET', route })).toEqual(expectedLimits)
                expect(matchApiKeyScope([saved], 'POST', route)).toBeNull()
                expect(matchApiKeyScope([{ ...saved, enabled: false }], 'GET', route)).toBeNull()
            }
            expect(matchApiKeyScope([saved], 'GET', '/api/v1/sources')).toBeNull()
        }
    })

    test('protects global collections and returns typed numbered pages without accepting caller tenant scope', async () => {
        let requestedUrl = ''
        let serviceToken = ''
        const previousServiceToken = process.env.TI_SCRAPER_SERVICE_TOKEN
        process.env.TI_SCRAPER_SERVICE_TOKEN = 'service-secret'
        const app = await testApp(async (input, init) => {
            requestedUrl = String(input)
            serviceToken = new Headers(init?.headers).get('x-hanasand-service-token') ?? ''
            return Response.json({ actorProfiles: [{ id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'], privateField: 'must-not-leak' }], total: 1 })
        })
        try {
            const anonymous = await app.inject({ method: 'GET', url: '/api/v1/actors' })
            expect(anonymous.statusCode).toBe(401)
            expect(anonymous.json().error.code).toBe('authentication_required')

            const response = await app.inject({ method: 'GET', url: '/api/v1/actors?q=%20apt%20&limit=10&page=1', headers: { 'x-api-key': 'valid' } })
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ data: [{ id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'] }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1, nextPage: null, nextCursor: null }, meta: { requestId: response.headers['x-request-id'], organizationId: 'org-customer' } })
            expect(requestedUrl).toContain('/v1/intel/actor-profiles?')
            expect(new URL(requestedUrl).searchParams.get('q')).toBe('apt')
            expect(requestedUrl).not.toContain('tenant')
            expect(serviceToken).toBe('service-secret')

            const invalid = await app.inject({ method: 'GET', url: '/api/v1/actors?limit=101', headers: { 'x-api-key': 'valid' } })
            expect(invalid.statusCode).toBe(400)
            expect(invalid.json().error.code).toBe('invalid_pagination')
        } finally {
            if (previousServiceToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
            else process.env.TI_SCRAPER_SERVICE_TOKEN = previousServiceToken
        }
    })

    test('drops malformed collection rows while retaining valid projected records', async () => {
        const validActor = { id: 'actor-1', canonicalName: 'APT29', aliases: ['Cozy Bear'], confidence: 0.9, sourceIds: ['src-1'], captureIds: ['cap-1'] }
        const app = await testApp(async () => Response.json({ actorProfiles: [null, 'unexpected', { id: 42, canonicalName: 'Invalid actor' }, validActor], total: 4 }))

        const response = await app.inject({ method: 'GET', url: '/api/v1/actors', headers: { 'x-api-key': 'valid' } })

        expect(response.statusCode).toBe(200)
        expect(response.json().data).toEqual([validActor])
        expect(response.json().pagination.total).toBe(4)
    })

    test('derives alert tenant scope from the API key and ignores caller-selected tenant headers', async () => {
        let tenantHeader = ''
        const app = await testApp(async (_input, init) => {
            tenantHeader = new Headers(init?.headers).get('x-tenant-id') ?? ''
            return Response.json({ alerts: [{ id: 'alert-1', assertionKind: 'observed', reviewState: 'unreviewed', evidence: { captureIds: [], sourceIds: [], evidenceCount: 0, sourceCount: 0, metadataOnly: true } }], total: 1 })
        })

        const unbound = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: { 'x-api-key': 'global', 'x-tenant-id': 'other-org' } })
        expect(unbound.statusCode).toBe(403)
        expect(unbound.json().error.code).toBe('organization_scope_required')

        const response = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: { 'x-api-key': 'valid', 'x-tenant-id': 'other-org' } })
        expect(response.statusCode).toBe(200)
        expect(tenantHeader).toBe('org-customer')
        expect(response.json().meta.organizationId).toBe('org-customer')
    })

    test('does not re-expose restricted source locators through the public collection API', async () => {
        const app = await testApp(async () => Response.json({
            sources: [
                { id: 'source-clear', name: 'Publisher feed', url: 'https://publisher.example/feed.xml', locatorRedacted: false, operatingMode: { metadataOnly: false, accessMethod: 'public_http' } },
                { id: 'source-redacted', name: 'Restricted feed', url: 'https://secret.example/private', locatorRedacted: true, operatingMode: { metadataOnly: true, accessMethod: 'metadata_only_proxy' } },
                { id: 'source-metadata-flag-only', name: 'Metadata-only feed', url: 'https://secret.example/another', operatingMode: { metadataOnly: true, accessMethod: 'public_http' } },
                { id: 'source-legacy-metadata', name: 'Legacy metadata feed', type: 'darkweb_metadata', url: 'https://secret.example/legacy' },
            ],
            total: 3,
        }))

        const response = await app.inject({ method: 'GET', url: '/api/v1/sources', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(200)
        const rows = response.json().data
        expect(rows[0].url).toBe('https://publisher.example/feed.xml')
        expect(rows[1]).not.toHaveProperty('url')
        expect(rows[2]).not.toHaveProperty('url')
        expect(rows[3]).not.toHaveProperty('url')
        expect(JSON.stringify(response.json())).not.toContain('secret.example')
    })
})
