import { describe, expect, test } from 'bun:test'
import Fastify from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { isAllowedApiOrigin, verifiedClientIp } from '#utils/http/publicBoundary.ts'
import { credentialPeriodLimits, resolveRateLimitActor } from '#plugins/rateLimit.ts'
import { organizationPublicApiScopes } from '#utils/auth/apiKeys.ts'
import { getTiEnrichment, postTiEnrichmentRun } from '../src/handlers/ti/enrichment.ts'
import IndexHandler from '../src/handlers/index.ts'
import { TRUSTED_API_PROXIES } from '../src/utils/http/publicBoundary.ts'
import { readFile } from 'node:fs/promises'
import { createPublicApiReply } from './fixtures/publicApiReply.ts'

describe('public TI API boundary', () => {
    test('does not serve a generated empty actor-enrichment success response', async () => {
        const result = await getTiEnrichment({} as FastifyRequest, createPublicApiReply() as unknown as FastifyReply) as any
        expect(result.statusCode).toBe(410)
        expect(result.payload).toEqual({
            ok: false,
            error: 'api_ti_enrichment_retired',
            message: 'API-owned actor enrichment is retired. Read canonical evidence through the TI scraper.',
            canonicalRoute: '/v1/intel/search',
        })
        const runResult = await postTiEnrichmentRun({} as FastifyRequest, createPublicApiReply() as unknown as FastifyReply) as any
        expect(runResult.statusCode).toBe(409)
        expect(runResult.headers['cache-control']).toBe('no-store, max-age=0')
        expect(runResult.payload).toEqual({
            ok: false,
            error: 'api_ti_enrichment_retired',
            message: 'API-owned actor enrichment is retired. Run collection through the canonical TI scraper.',
            canonicalRoute: '/v1/intel/search',
        })
    })
    test('uses Fastify verified client IP instead of a caller-supplied forwarding header', () => {
        const request = { ip: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } } as unknown as FastifyRequest
        expect(verifiedClientIp(request)).toBe('203.0.113.10')
    })

    test('does not expose the internal route inventory at public API roots', async () => {
        const target = createPublicApiReply()
        const request = { server: { printRoutes: () => { throw new Error('route inventory must remain private') } } } as unknown as FastifyRequest
        const result = await IndexHandler(request, target as unknown as FastifyReply) as any
        expect(result.statusCode).toBe(200)
        expect(result.headers['cache-control']).toBe('no-store, max-age=0')
        expect(result.payload).toEqual({
            service: 'hanasand-api',
            documentation: 'https://hanasand.com/developers',
            openapi: '/api/v1/openapi.json',
        })
    })

    test('trusts forwarding only from explicitly configured proxy hops', async () => {
        const app = Fastify({ trustProxy: TRUSTED_API_PROXIES })
        app.get('/client-ip', request => ({ ip: request.ip }))

        const spoofed = await app.inject({ method: 'GET', url: '/client-ip', remoteAddress: '203.0.113.10', headers: { 'x-forwarded-for': '127.0.0.1' } })
        expect(spoofed.json()).toEqual({ ip: '203.0.113.10' })

        const proxied = await app.inject({ method: 'GET', url: '/client-ip', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '127.0.0.1, 198.51.100.7' } })
        expect(proxied.json()).toEqual({ ip: '198.51.100.7' })
        await app.close()
    })

    test('does not grant internal limits to unauthenticated private proxy addresses', async () => {
        const request = { ip: '172.20.0.1', headers: {} } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request)).toEqual({ scope: 'anonymous', identifier: 'ip:172.20.0.1' })
    })

    test('marks an invalid presented API key instead of silently treating it as anonymous', async () => {
        const request = { ip: '203.0.113.10', headers: { 'x-api-key': 'hsk_invalid' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(request, async () => null)).toEqual({ scope: 'anonymous', identifier: 'ip:203.0.113.10', invalidApiKey: true })
    })

    test('rejects malformed keys and expired sessions instead of downgrading them to anonymous', async () => {
        const malformedKey = { ip: '203.0.113.10', headers: { 'x-api-key': 'not-a-hanasand-key' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(malformedKey, async () => null)).toMatchObject({ invalidApiKey: true })

        const expiredSession = { ip: '203.0.113.10', url: '/', headers: { authorization: 'Bearer expired', id: 'session-id' } } as unknown as FastifyRequest
        expect(await resolveRateLimitActor(expiredSession, async () => null, async () => null)).toEqual({ scope: 'anonymous', identifier: 'ip:203.0.113.10', invalidSession: true })
    })

    test('requires the internal tier and Hanasand organization scope for internal limits', async () => {
        const request = { ip: '203.0.113.10', headers: { 'x-api-key': 'hsk_test' } } as unknown as FastifyRequest
        const externalKey = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'business' } }) as any)
        expect(externalKey.scope).toBe('authenticated')

        const externalInternal = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'internal' }, organizationId: 'external-org' }) as any)
        expect(externalInternal.scope).toBe('authenticated')

        const internalOrganizationKey = await resolveRateLimitActor(request, async () => ({ apiKey: { id: 'key', tier: 'internal' }, organizationId: '3e735e7b-4d7f-444d-9806-231fa26cfcec' }) as any)
        expect(internalOrganizationKey.scope).toBe('internal')
    })

    test('applies the documented durable batch budget equally to sessions and API keys', () => {
        const apiKeyScope = organizationPublicApiScopes().find(scope => scope.route === '/api/v1/ti/search/batch')!
        const request = { method: 'POST', route: '/api/v1/ti/search/batch' }
        expect(credentialPeriodLimits({ actorIdentifier: 'user:customer', apiKeyScope: null, ...request })).toEqual(apiKeyScope.limits)
        expect(credentialPeriodLimits({ actorIdentifier: 'api_key:key', apiKeyScope, ...request })).toEqual(apiKeyScope.limits)
        expect(credentialPeriodLimits({ actorIdentifier: 'user:customer', apiKeyScope: null, method: 'GET', route: '/api/v1/actors' })).toBeNull()
    })

    test('allows only configured browser origins', () => {
        expect(isAllowedApiOrigin(undefined)).toBe(true)
        expect(isAllowedApiOrigin('https://hanasand.com')).toBe(true)
        expect(isAllowedApiOrigin('https://mail.hanasand.com')).toBe(true)
        expect(isAllowedApiOrigin('https://untrusted.hanasand.com')).toBe(false)
        expect(isAllowedApiOrigin('https://customer.example', 'https://customer.example')).toBe(true)
        expect(isAllowedApiOrigin('https://attacker.example')).toBe(false)
    })

    test('never shared-caches API responses or upstream failures in Varnish', async () => {
        const vcl = await readFile(new URL('../default.vcl', import.meta.url), 'utf8')
        expect(vcl).toContain('if (req.url ~ "^/api/")')
        expect(vcl).toContain('bereq.url ~ "^/api/" || beresp.status >= 400')
        expect(vcl).toContain('set beresp.http.Cache-Control = "no-store, max-age=0"')
        expect(vcl).not.toContain('set req.http.X-Forwarded-For')
    })

})
