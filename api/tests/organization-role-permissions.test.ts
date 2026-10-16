import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { normalizeInviteInput, normalizeMemberRoleInput, organizationAlertCaseRoleActions, organizationMemberAccessContract, organizationMemberMutationDenial, organizationVisibilityDecision } from '../src/utils/organizations.ts'
import { roleCanEditOrganization, roleCanManageOrganization, type OrganizationRole } from '../src/utils/organizationRoles.ts'
import * as webhooks from '../src/utils/dwm/webhooks.ts'

let role: OrganizationRole = 'reader'
let active = true
let actorMembershipStatus: 'active' | 'removed' = 'active'
let authenticated = true
let archived = false
let queryCalls = 0
let inviteAcceptanceWinsRace = false
let inviteReads = 0
let removeActorMembershipAfterMemberLock = false
const writes: string[] = []
const statements: Array<{ sql: string, params: unknown[] }> = []
const serviceLogs: Record<string, any>[] = []
const systemEvents: Record<string, any>[] = []
const apiKeys: Record<string, any>[] = []
const apiKeyScopes: Record<string, any>[] = []
const raceInvite = {
    id: 'invite-1', organization_id: 'org', email: 'member@example.test', role: 'reader',
    invited_by: 'owner', created_at: '2026-10-01T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z',
    accepted_at: null, accepted_by: null, revoked_at: null,
}
const destination = { id: 'target', orgId: 'org', ownerId: 'owner', name: 'Delivery target', kind: 'webhook', status: 'active', endpointHint: 'example.com/…', endpointHash: 'hash', events: ['dwm.alert.created'] }
const query = async (sql: string, params: unknown[] = []) => {
    queryCalls++
    const statement = sql.replace(/\s+/g, ' ').trim()
    statements.push({ sql: statement, params })
    if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) writes.push(sql)
    if (removeActorMembershipAfterMemberLock && statement.startsWith('SELECT id FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE')) {
        actorMembershipStatus = 'removed'
        removeActorMembershipAfterMemberLock = false
    }
    if (statement.includes('COUNT(*)::int AS owner_count')) return { rows: [{ owner_count: 1 }] }
    if (statement.startsWith('SELECT * FROM organization_invites')) {
        inviteReads++
        const accepted = inviteAcceptanceWinsRace && inviteReads > 1
        return { rows: [{ ...raceInvite, status: accepted ? 'accepted' : 'pending', accepted_at: accepted ? '2026-10-15T12:00:00.000Z' : null, accepted_by: accepted ? 'member' : null }] }
    }
    if (statement.startsWith('UPDATE organization_invites SET status = CASE WHEN $3')) return { rows: [], rowCount: 0 }
    if (statement.startsWith('INSERT INTO api_keys')) {
        const now = new Date().toISOString()
        const row = { id: params[0], owner_id: params[1], organization_id: params[2], name: params[3], tier: params[4], description: params[5], enabled: params[6], key_prefix: params[7], secret_hash: params[8], expires_at: params[9], last_used_at: null, created_at: now, updated_at: now }
        apiKeys.push(row)
        return { rows: [row], rowCount: 1 }
    }
    if (statement.startsWith('DELETE FROM api_key_scopes')) {
        const before = apiKeyScopes.length
        for (let i = apiKeyScopes.length - 1; i >= 0; i--) if (apiKeyScopes[i]?.api_key_id === params[0]) apiKeyScopes.splice(i, 1)
        return { rows: [], rowCount: before - apiKeyScopes.length }
    }
    if (statement.startsWith('INSERT INTO api_key_scopes')) {
        apiKeyScopes.push({ id: params[0], api_key_id: params[1], method: params[2], route: params[3], enabled: params[4], per_second: params[5], per_minute: params[6], per_hour: params[7], per_day: params[8] })
        return { rows: [], rowCount: 1 }
    }
    if (statement.includes('FROM api_key_scopes') && statement.includes('WHERE api_key_id = $1')) return { rows: apiKeyScopes.filter(scope => scope.api_key_id === params[0]) }
    if (statement.includes('FROM api_keys') && statement.includes('WHERE organization_id = $1') && statement.includes('ORDER BY created_at DESC')) return { rows: apiKeys.filter(key => key.organization_id === params[0]) }
    if (sql.includes('FROM dwm_webhook_destinations')) return { rows: [{ id: 'target', org_id: 'org' }] }
    if (sql.includes('FROM organizations o')) return { rows: params[0] === 'org' && active && actorMembershipStatus === 'active' ? [{ id: 'org', name: 'Organization', slug: 'org', status: 'active', role, owner_count: 1 }] : [] }
    if (sql.includes('FROM organization_members member')) return { rows: active ? [{ role, organization_status: 'active' }] : [] }
    if (statement.startsWith('UPDATE organization_members')) {
        const now = new Date().toISOString()
        return { rows: [{ organization_id: params[0], user_id: params[1], name: 'Teammate', avatar: '', role: params[2], status: 'active', joined_at: now, created_at: now }], rowCount: 1 }
    }
    if (sql.includes('FROM organization_members')) return { rows: [{ user_id: 'teammate', role: 'reader', status: 'active' }] }
    return { rows: [] }
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: (runQuery: typeof query) => unknown) => work(query), withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work() }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: 'actor' }) }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async (entry: Record<string, any>) => { serviceLogs.push(entry) } }))
const systemEventUtils = await import('../src/utils/systemEvent.ts')
mock.module('#utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    recordSystemEvent: async (entry: Record<string, any>) => { systemEvents.push(entry) },
}))
mock.module('#utils/dwm/webhooks.ts', () => ({
    ...webhooks,
    listDwmWebhookDestinations: async () => [destination],
    listDwmWebhookDeliveries: async () => [],
    listDwmWebhookAuditEvents: async () => [],
    archiveDwmWebhookDestination: async () => { archived = true; return { ...destination, status: 'archived' } },
}))
const org = await import('../src/handlers/organizations.ts')
const { deleteDwmWebhookDestination } = await import('../src/handlers/dwm/webhooks.ts')
const app = Fastify()
app.delete('/targets/:id', deleteDwmWebhookDestination)
app.get('/org/:id', org.getOrganization)
app.get('/org/:id/api-keys', org.getOrganizationApiKeys)
app.post('/org/:id/api-keys', org.postOrganizationApiKey)
app.delete('/org/:id/api-keys/:keyId', org.deleteOrganizationApiKey)
app.put('/org/:id/settings', org.putOrganizationSettings)
app.post('/org/:id/ownership-transfer', org.postOrganizationOwnershipTransfer)
app.post('/org/:id/invites', org.postOrganizationInvites)
app.post('/org/:id/invites/:inviteId/actions', org.postOrganizationInviteAction)
app.post('/org/:id/cleanup', org.postOrganizationWatchlistCleanup)
app.post('/org/:id/watchlists', org.postOrganizationWatchlist)
app.patch('/org/:id/members/:userId/role', org.patchOrganizationMemberRole)
app.delete('/org/:id/members/:userId', org.deleteOrganizationMember)

beforeEach(() => { role = 'reader'; active = true; actorMembershipStatus = 'active'; authenticated = true; archived = false; queryCalls = 0; inviteAcceptanceWinsRace = false; inviteReads = 0; removeActorMembershipAfterMemberLock = false; writes.length = 0; statements.length = 0; serviceLogs.length = 0; systemEvents.length = 0; apiKeys.length = 0; apiKeyScopes.length = 0 })

test('legacy roles and invitations become Reader without gaining permissions', () => {
    for (const legacy of ['member', 'viewer']) {
        expect(normalizeInviteInput({ email: 'person@example.com', role: legacy }).role).toBe('reader')
        expect(normalizeMemberRoleInput({ role: legacy, reason: 'Migrate existing access' }).role).toBe('reader')
        expect(roleCanEditOrganization(legacy)).toBe(false)
        expect(organizationAlertCaseRoleActions(legacy as OrganizationRole)).toEqual([])
    }
    expect(normalizeInviteInput({ email: 'person@example.com' }).role).toBe('reader')
    expect(normalizeInviteInput({ email: 'person@example.com', role: 'editor' }).role).toBe('editor')
})

test('organization roles grant only their documented case and management actions', () => {
    const allManagementActions = [
        'create_watchlist', 'edit_watchlist_terms', 'archive_watchlist', 'restore_watchlist',
        'acknowledge_alert', 'assign_case', 'link_case', 'manage_invites',
    ]
    const editorActions = allManagementActions.filter(action => action !== 'manage_invites')
    const analystActions = ['acknowledge_alert', 'assign_case', 'link_case']

    for (const role of ['owner', 'admin'] as const) {
        expect(roleCanManageOrganization(role)).toBe(true)
        expect(roleCanEditOrganization(role)).toBe(true)
        expect(organizationAlertCaseRoleActions(role)).toEqual(allManagementActions)
    }
    expect(roleCanManageOrganization('editor')).toBe(false)
    expect(roleCanEditOrganization('editor')).toBe(true)
    expect(organizationAlertCaseRoleActions('editor')).toEqual(editorActions)
    expect(organizationAlertCaseRoleActions('analyst')).toEqual(analystActions)

    for (const role of ['reader', 'member', 'viewer'] as const) {
        expect(roleCanManageOrganization(role)).toBe(false)
        expect(roleCanEditOrganization(role)).toBe(false)
        expect(organizationAlertCaseRoleActions(role)).toEqual([])
    }
    expect(roleCanEditOrganization('unexpected')).toBe(false)
})

test('member role targets stay aligned across validation and access contracts', () => {
    const roleTargets = ['admin', 'editor', 'reader']
    const access = organizationMemberAccessContract({
        id: 'org',
        role: 'owner',
        status: 'active',
        alert_visibility_policy: 'members',
    }, [])
    const deniedRoleChanges = (['remove_member', 'change_member_role'] as const).map(action => organizationMemberMutationDenial({
        organizationId: 'org',
        actorId: 'owner',
        actorRole: 'owner',
        targetUserId: 'member',
        targetRole: 'editor',
        action,
        message: 'Member role change is not allowed.',
    }))

    expect(roleTargets.map(role => normalizeMemberRoleInput({ role, reason: 'Update access.' }).role)).toEqual(roleTargets)
    expect(access.memberLifecycle.roleTargets).toEqual(roleTargets)
    expect(access.memberLifecycle.roleChange.ownerCanAssign).toEqual(roleTargets)
    expect(access.memberLifecycle.roleTargets).not.toBe(access.memberLifecycle.roleChange.ownerCanAssign)
    expect(deniedRoleChanges.map(denial => denial.allowedTargetRoles)).toEqual([roleTargets, roleTargets])
})

test('alert visibility policies allow only the roles named by each policy', () => {
    const policies = [
        { policy: 'members', allowed: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] },
        { policy: 'admins', allowed: ['owner', 'admin'] },
        { policy: 'owners', allowed: ['owner'] },
    ] as const

    for (const { policy, allowed } of policies) {
        for (const candidate of ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] as const) {
            const decision = organizationVisibilityDecision({
                role: candidate,
                status: 'active',
                userActive: true,
                alertVisibilityPolicy: policy,
            })
            expect(decision.allowed).toBe(allowed.includes(candidate))
            expect(decision.reason).toBe(allowed.includes(candidate) ? null : 'role_not_allowed')
            expect(decision.allowedRoles).toEqual(allowed)
        }
    }

    expect(organizationVisibilityDecision({ role: 'editor', status: 'removed', userActive: true }).reason).toBe('member_removed')
    expect(organizationVisibilityDecision({ role: 'editor', status: 'active', userActive: false }).reason).toBe('member_deactivated')
    expect(organizationVisibilityDecision({ status: 'active', userActive: true }).reason).toBe('not_member')
})

test('member role receipt uses the watchlist handler policy for readers and editors', async () => {
    role = 'owner'
    const response = await app.inject({
        method: 'PATCH',
        url: '/org/org/members/teammate/role',
        payload: { role: 'editor', reason: 'Grant watchlist access.' },
    })

    expect(response.statusCode).toBe(200)
    const receipt = response.json().roleChange.consumerVisibilityReceipt
    expect(receipt.before).toEqual({
        role: 'reader',
        canReadSharedWatchlists: true,
        canExportAlertTerms: false,
        canMutateSharedWatchlists: false,
        canAssignCases: false,
        canDryRunWebhookDelivery: false,
        canReadWebhookDeliverySummary: true,
    })
    expect(receipt.after).toEqual({
        role: 'editor',
        canReadSharedWatchlists: true,
        canExportAlertTerms: false,
        canMutateSharedWatchlists: true,
        canAssignCases: false,
        canDryRunWebhookDelivery: false,
        canReadWebhookDeliverySummary: true,
    })
    expect(receipt.downstreamReadinessReceipt.before).toEqual({
        sharedWatchlistReadReady: true,
        alertGenerationExportReady: false,
        watchlistMutationReady: false,
        caseAssignmentReady: false,
        webhookDeliveryReady: false,
        deliverySummaryReady: true,
    })
    expect(receipt.downstreamReadinessReceipt.after).toEqual({
        sharedWatchlistReadReady: true,
        alertGenerationExportReady: false,
        watchlistMutationReady: true,
        caseAssignmentReady: false,
        webhookDeliveryReady: false,
        deliverySummaryReady: true,
    })
    expect(receipt.downstreamReadinessReceipt.roleGates.mutateWatchlists).toEqual(['owner', 'admin', 'editor'])
})

test('member mutations lock user rows in stable order before the organization row', async () => {
    role = 'owner'
    const responses = [
        await app.inject({ method: 'PATCH', url: '/org/org/members/a-target/role', payload: { role: 'editor', reason: 'Grant access.' } }),
        await app.inject({ method: 'DELETE', url: '/org/org/members/a-target' }),
        await app.inject({ method: 'POST', url: '/org/org/ownership-transfer', payload: { targetUserId: 'a-target', reason: 'Transfer ownership.' } }),
    ]

    expect(responses.map(response => response.statusCode)).toEqual([200, 200, 200])
    expect(responses[0].json().roleChange).toMatchObject({ previousRole: 'reader', newRole: 'editor' })
    expect(responses[1].json().memberRemovalCleanup).toMatchObject({
        targetUserId: 'a-target',
        noOrphanedInviteTokens: true,
        consumerAccessRevocation: { blockerCode: 'member_revoked' },
    })
    expect(responses[2].json().transfer).toEqual({
        organizationId: 'org',
        previousOwnerId: 'actor',
        newOwnerId: 'a-target',
        reason: 'Transfer ownership.',
    })
    const userLocks = statements.flatMap((statement, index) => statement.sql.includes('FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE') ? [index] : [])
    const organizationLocks = statements.flatMap((statement, index) => statement.sql === 'SELECT id FROM organizations WHERE id = $1 FOR UPDATE' ? [index] : [])

    expect(userLocks).toHaveLength(3)
    expect(organizationLocks).toHaveLength(3)
    userLocks.forEach((userLock, index) => {
        expect(organizationLocks[index]).toBe(userLock + 1)
        expect(statements[userLock].params).toEqual([['a-target', 'actor']])
        expect(statements[organizationLocks[index]].params).toEqual(['org'])
    })
})

test('member role changes revalidate the actor membership after locking', async () => {
    role = 'owner'
    removeActorMembershipAfterMemberLock = true

    const response = await app.inject({
        method: 'PATCH',
        url: '/org/org/members/a-target/role',
        payload: { role: 'editor', reason: 'Grant access.' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Organization not found.' })
    expect(actorMembershipStatus).toBe('removed')
    expect(statements.some(statement => statement.sql.startsWith('SELECT id FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE'))).toBe(true)
    expect(writes).toHaveLength(0)
})

test('Editor can remove a delivery target; Reader and legacy roles cannot', async () => {
    for (const viewerRole of ['reader', 'member', 'viewer'] as const) {
        role = viewerRole
        expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(403)
        expect(archived).toBe(false)
    }
    role = 'editor'
    const response = await app.inject({ method: 'DELETE', url: '/targets/target' })
    expect(response.statusCode).toBe(200)
    expect(archived).toBe(true)
    expect(response.json().destination.status).toBe('archived')
})


test('Reader cannot create watchlists, even with a direct request', async () => {
    expect((await app.inject({ method: 'POST', url: '/org/org/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(403)
    expect(writes).toHaveLength(0)
})

test('organization owners can create multiple active organization API keys', async () => {
    role = 'owner'
    const first = await app.inject({ method: 'POST', url: '/org/org/api-keys', payload: { name: 'Production integration' } })
    const second = await app.inject({ method: 'POST', url: '/org/org/api-keys', payload: { name: 'Development integration' } })
    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    expect(first.json().apiKey.organizationId).toBe('org')
    expect(second.json().apiKey.organizationId).toBe('org')
    expect(apiKeys.filter(key => key.organization_id === 'org' && key.enabled)).toHaveLength(2)
})

test('organization admins cannot transfer ownership', async () => {
    role = 'admin'
    const response = await app.inject({
        method: 'POST',
        url: '/org/org/ownership-transfer',
        payload: { targetUserId: 'teammate', reason: 'Transfer to the teammate.' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json().error).toBe('Only organization owners can transfer ownership.')
    expect(writes).toHaveLength(0)
})

test('invite revoke reports accepted-invite conflict when acceptance wins the update race', async () => {
    role = 'owner'
    inviteAcceptanceWinsRace = true
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
    expect(writes).toHaveLength(1)
    expect(serviceLogs.map(entry => entry.message)).toEqual(['organization_invite_action_denied'])
    expect(systemEvents).toHaveLength(0)
})

test('Editor and Reader are denied administrative mutations without domain writes', async () => {
    for (const actorRole of ['reader', 'editor'] as const) {
        role = actorRole
        const requests = [
            { method: 'PUT', url: '/org/org/settings', payload: { name: 'Changed' } },
            { method: 'POST', url: '/org/org/invites', payload: { email: 'person@example.com', role: 'admin' } },
            { method: 'POST', url: '/org/org/api-keys', payload: { name: 'Key' } },
            { method: 'POST', url: '/org/org/cleanup', payload: { itemIds: ['watch'] } },
            { method: 'PATCH', url: '/org/org/members/teammate/role', payload: { role: 'admin', reason: 'Attempt privilege change' } },
            { method: 'DELETE', url: '/org/org/members/teammate' },
        ] as const
        for (const request of requests) expect((await app.inject(request)).statusCode).toBe(403)
        expect(writes).toHaveLength(0)
    }
})

test('removed Editors and cross-organization requests are denied', async () => {
    role = 'editor'; active = false
    expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(404)
    expect(archived).toBe(false)
    active = true
    expect((await app.inject({ method: 'POST', url: '/org/other/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(404)
    expect(writes).toHaveLength(0)
})

test('organization member context preserves route-specific authentication errors before loading organization data', async () => {
    authenticated = false

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
    expect(queryCalls).toBe(0)
})
