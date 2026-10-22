import { expect, mock, test } from 'bun:test'
import type { FastifyRequest } from 'fastify'
mock.module('#db', () => ({
    default: async () => ({ rows: [] }),
    withReadDatabase: async (work: () => Promise<unknown>) => work()
}))
mock.module('#utils/auth/apiKeys.ts', () => ({ validateApiKey: async () => null }))
mock.module('#utils/auth/session.ts', () => ({ validateSession: async () => null }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({
    HANASAND_ORGANIZATION_ID: 'synthetic-org',
    hasHanasandInternalPageAccess: async () => false
}))
mock.module('#utils/auth/deviceProofRequest.ts', () => ({
    deviceProofFromRequest: () => ({
        proof: 'synthetic-proof',
        method: 'GET',
        url: 'https://api.hanasand.com/api/organizations'
    }),
    hasTrustedServerSession: () => false
}))
const { resolveRateLimitActor } = await import('../src/plugins/rateLimitActor.ts')
const request = (config: unknown, url = '/api/organizations') =>
    ({
        ip: '127.0.0.1',
        method: 'GET',
        url,
        routeOptions: { url, config },
        headers: {
            authorization: 'Bearer synthetic-token',
            id: 'synthetic-user',
            'authentication-owner': 'identity'
        }
    }) as unknown as FastifyRequest

test('only registered Identity proxies use bounded IP actor without consuming proof', async () => {
    let checks = 0
    const validate = async () => {
        checks++
        return null
    }
    expect(
        await resolveRateLimitActor(request({ authenticationOwner: 'identity' }), async () => null, validate)
    ).toEqual({ scope: 'anonymous', identifier: 'ip:127.0.0.1' })
    expect(checks).toBe(0)
    expect((await resolveRateLimitActor(request({}), async () => null, validate)).invalidSession).toBe(true)
    expect(
        (
            await resolveRateLimitActor(
                request({ authenticationOwner: 'identity' }, '/api/organizations/org/api-keys'),
                async () => null,
                validate
            )
        ).invalidSession
    ).toBe(true)
    expect(checks).toBe(2)
})
