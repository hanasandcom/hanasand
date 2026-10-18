import { afterAll, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'

let membership: 'active' | 'denied' | 'unavailable' = 'active'
let sessionResponse: Response | undefined

mock.module('../src/utils/proxy/requireApiSession', () => ({
    default: async () => sessionResponse
        ? { response: sessionResponse }
        : { identity: { id: 'member-id', token: 'member-token' } },
}))
mock.module('../src/utils/organizations/hanasandMembership', () => ({
    isHanasandOrganizationMember: async () => {
        if (membership === 'unavailable') throw new Error('Organization lookup failed.')
        return membership === 'active'
    },
}))

const requirePromptPortalSession = (await import('../src/utils/promptPortal/sessionAccess')).default

afterAll(() => {
    mock.restore()
})

function request() {
    return new NextRequest('https://hanasand.com/api/prompt')
}

test('prompt portal permits an authenticated active Hanasand member', async() => {
    membership = 'active'
    const access = await requirePromptPortalSession(request())

    expect('identity' in access && access.identity).toEqual({ id: 'member-id', token: 'member-token' })
})

test('prompt portal denies an authenticated nonmember before exposing state', async() => {
    membership = 'denied'
    const access = await requirePromptPortalSession(request())

    expect('response' in access && access.response.status).toBe(403)
})

test('prompt portal fails closed when organization membership cannot be checked', async() => {
    membership = 'unavailable'
    const access = await requirePromptPortalSession(request())

    expect('response' in access && access.response.status).toBe(503)
})

test('prompt portal preserves the shared authentication response', async() => {
    sessionResponse = Response.json({ ok: false }, { status: 401 })
    const access = await requirePromptPortalSession(request())

    expect('response' in access && access.response.status).toBe(401)
    sessionResponse = undefined
})
