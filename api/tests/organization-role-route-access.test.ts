import { beforeEach, expect, test } from 'bun:test'
import { app, resetOrganizationRolePermissionsFixture, state } from './fixtures/organization-role-permissions-harness.ts'

beforeEach(resetOrganizationRolePermissionsFixture)

test('Editor can remove a delivery target; Reader and legacy roles cannot', async () => {
    for (const viewerRole of ['reader', 'member', 'viewer'] as const) {
        state.role = viewerRole
        expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(403)
        expect(state.archived).toBe(false)
    }
    state.role = 'editor'
    const response = await app.inject({ method: 'DELETE', url: '/targets/target' })
    expect(response.statusCode).toBe(200)
    expect(state.archived).toBe(true)
    expect(response.json().destination.status).toBe('archived')
})
test('Reader cannot create watchlists, even with a direct request', async () => {
    expect((await app.inject({ method: 'POST', url: '/org/org/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(403)
    expect(state.writes).toHaveLength(0)
})
test('organization owners can create multiple active organization API keys', async () => {
    state.role = 'owner'
    const first = await app.inject({ method: 'POST', url: '/org/org/api-keys', payload: { name: 'Production integration' } })
    const second = await app.inject({ method: 'POST', url: '/org/org/api-keys', payload: { name: 'Development integration' } })
    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    expect(first.json().apiKey.organizationId).toBe('org')
    expect(second.json().apiKey.organizationId).toBe('org')
    expect(state.apiKeys.filter(key => key.organization_id === 'org' && key.enabled)).toHaveLength(2)
})
test('organization admins cannot transfer ownership', async () => {
    state.role = 'admin'
    const response = await app.inject({
        method: 'POST',
        url: '/org/org/ownership-transfer',
        payload: { targetUserId: 'teammate', reason: 'Transfer to the teammate.' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('Only organization owners can transfer ownership.')
    expect(state.writes).toHaveLength(0)
})
test('invite revoke reports accepted-invite conflict when acceptance wins the update race', async () => {
    state.role = 'owner'
    state.inviteAcceptanceWinsRace = true
    const response = await app.inject({
        method: 'POST',
        url: '/org/org/invites/invite-1/actions',
        payload: { action: 'revoke', reason: 'Revoke after acceptance race.', requestId: 'invite-race-1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toBe('Accepted invites cannot be revoked or resent; manage the member instead.')
    expect(response.json().inviteActionDenial).toMatchObject({
        schemaVersion: 'organization.invite_action_denial.v1',
        inviteId: 'invite-1',
        inviteStatus: 'accepted',
        action: 'revoke',
        blockerCode: 'invite_already_accepted',
        requestId: 'invite-race-1',
    })
    expect(state.writes).toHaveLength(1)
    expect(state.serviceLogs.map(entry => entry.message)).toEqual(['organization_invite_action_denied'])
    expect(state.systemEvents).toHaveLength(0)
})
test('Editor and Reader are denied administrative mutations without domain writes', async () => {
    for (const actorRole of ['reader', 'editor'] as const) {
        state.role = actorRole
        const requests = [
            { method: 'PUT', url: '/org/org/settings', payload: { name: 'Changed' } },
            { method: 'POST', url: '/org/org/invites', payload: { email: 'person@example.com', role: 'admin' } },
            { method: 'POST', url: '/org/org/api-keys', payload: { name: 'Key' } },
            { method: 'POST', url: '/org/org/cleanup', payload: { itemIds: ['watch'] } },
            { method: 'PATCH', url: '/org/org/members/teammate/role', payload: { role: 'admin', reason: 'Attempt privilege change' } },
            { method: 'DELETE', url: '/org/org/members/teammate' },
        ] as const
        for (const request of requests) expect((await app.inject(request)).statusCode).toBe(403)
        expect(state.writes).toHaveLength(0)
    }
})
test('removed Editors and cross-organization requests are denied', async () => {
    state.role = 'editor'; state.active = false
    expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(404)
    expect(state.archived).toBe(false)
    state.active = true
    expect((await app.inject({ method: 'POST', url: '/org/other/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(404)
    expect(state.writes).toHaveLength(0)
})
test('organization member context preserves route-specific authentication errors before loading organization data', async () => {
    state.authenticated = false

    const response = await app.inject({ method: 'GET', url: '/org/org' })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized.' })
    const apiKeyResponses = await Promise.all([
        app.inject({ method: 'GET', url: '/org/org/api-keys' }),
        app.inject({ method: 'POST', url: '/org/org/api-keys', payload: { name: 'Key' } }),
        app.inject({ method: 'DELETE', url: '/org/org/api-keys/key-1' }),
    ])
    expect(apiKeyResponses.map(apiKeyResponse => [apiKeyResponse.statusCode, apiKeyResponse.json()])).toEqual([
        [401, { error: { code: 'authentication_required', message: 'Sign in to manage organization API keys.' } }],
        [401, { error: { code: 'authentication_required', message: 'Sign in to create an organization API key.' } }],
        [401, { error: { code: 'authentication_required', message: 'Sign in to revoke an organization API key.' } }],
    ])
    expect(state.queryCalls).toBe(0)
})
