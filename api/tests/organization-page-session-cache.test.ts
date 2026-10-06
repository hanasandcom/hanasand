import { expect, test } from 'bun:test'
import type { FastifyRequest } from 'fastify'

process.env.DB_PASSWORD ||= 'test'
process.env.DB_HOST ||= 'localhost'
process.env.VM_API_TOKEN ||= 'test'
const { default: hasHanasandInternalRouteAccess } = await import('../src/utils/auth/organizationPageAccess.ts')
const { HANASAND_ORGANIZATION_ID } = await import('../src/utils/auth/organizationPagePolicy.ts')

function request(method: string, role: string, membershipStatus = 'active') {
    return {
        method,
        url: '/api/logs/tuning',
        routeOptions: { url: '/api/logs/tuning' },
        headers: { id: 'member' },
        rateLimitSession: {
            user: { id: 'member' },
            organizationMembership: {
                organizationId: HANASAND_ORGANIZATION_ID,
                organizationStatus: 'active',
                membershipStatus,
                role,
            },
        },
    } as unknown as FastifyRequest
}

test('tuning route reuses the membership checked with the session and keeps method/role rules', async () => {
    expect(await hasHanasandInternalRouteAccess(request('GET', 'viewer'))).toEqual({ valid: true })
    expect(await hasHanasandInternalRouteAccess(request('POST', 'viewer'))).toEqual({ valid: false })
    expect(await hasHanasandInternalRouteAccess(request('POST', 'editor'))).toEqual({ valid: true })
    expect(await hasHanasandInternalRouteAccess(request('GET', 'editor', 'removed'))).toEqual({ valid: false })
})
