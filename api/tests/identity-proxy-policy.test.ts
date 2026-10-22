import { describe, expect, test } from 'bun:test'
import type { FastifyRequest } from 'fastify'
import {
    delegatesAuthenticationToIdentity,
    identityProxyProofHeaders,
    identityProxyRouteConfig
} from '../src/utils/identityProxyPolicy.ts'

const request = (overrides: Record<string, unknown> = {}) =>
    ({
        method: 'GET',
        url: '/api/organizations?scope=all',
        raw: { url: '/api/organizations?scope=all' },
        protocol: 'https',
        host: 'api.hanasand.com',
        headers: { dpop: 'synthetic-proof' },
        routeOptions: { url: '/api/organizations', config: identityProxyRouteConfig },
        ...overrides
    }) as unknown as FastifyRequest

describe('Identity-owned organization proxy boundary', () => {
    test('delegates only explicitly registered Identity routes and leaves API-owned organization routes authenticated', () => {
        expect(delegatesAuthenticationToIdentity(request())).toBe(true)
        for (const url of ['/api/auth/login-form.js', '/api/management/organizations'])
            expect(
                delegatesAuthenticationToIdentity(
                    request({ routeOptions: { url, config: identityProxyRouteConfig } })
                )
            ).toBe(true)
        for (const url of [
            '/api/organizations/org/api-keys',
            '/api/organizations/:id',
            '/api/organizations/:id/watchlists'
        ])
            expect(
                delegatesAuthenticationToIdentity(
                    request({ routeOptions: { url, config: identityProxyRouteConfig } })
                )
            ).toBe(false)
        expect(delegatesAuthenticationToIdentity(request({ method: 'POST' }))).toBe(false)
        expect(
            delegatesAuthenticationToIdentity(
                request({
                    routeOptions: { url: '/api/organizations', config: {} },
                    headers: { 'authentication-owner': 'identity', 'x-hanasand-session-validated': '1' }
                })
            )
        ).toBe(false)
    })
    test('forwards the original canonical proof target without consuming or replacing proof', () => {
        expect(identityProxyProofHeaders(request())).toEqual({
            DPoP: 'synthetic-proof',
            'x-device-proof-method': 'GET',
            'x-device-proof-url': 'https://api.hanasand.com/api/organizations'
        })
        expect(
            identityProxyProofHeaders(
                request({
                    headers: {
                        dpop: 'synthetic-proof',
                        'x-device-proof-url': 'https://hanasand.com/api/organizations',
                        'x-device-proof-method': 'GET'
                    }
                })
            )['x-device-proof-url']
        ).toBe('https://hanasand.com/api/organizations')
        expect(identityProxyProofHeaders(request({ headers: {} }))).toEqual({})
    })
    test('rejects arbitrary asserted target, method, route, insecure origin and credentials', () => {
        for (const url of [
            'https://attacker.invalid/api/organizations',
            'https://api.hanasand.com/api/user',
            'http://api.hanasand.com/api/organizations',
            'https://user:password@api.hanasand.com/api/organizations'
        ])
            expect(() =>
                identityProxyProofHeaders(
                    request({ headers: { dpop: 'synthetic-proof', 'x-device-proof-url': url } })
                )
            ).toThrow()
        expect(() =>
            identityProxyProofHeaders(
                request({ headers: { dpop: 'synthetic-proof', 'x-device-proof-method': 'POST' } })
            )
        ).toThrow()
        expect(() => identityProxyProofHeaders(request({ host: 'attacker.invalid' }))).toThrow()
        expect(() => identityProxyProofHeaders(request({ raw: { url: '/api/user' } }))).toThrow()
    })
})
