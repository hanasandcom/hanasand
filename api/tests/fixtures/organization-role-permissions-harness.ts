import { mock } from 'bun:test'
import Fastify from 'fastify'
import type { OrganizationRole } from '../../src/utils/organizationRoles.ts'
import * as webhooks from '../../src/utils/dwm/webhooks.ts'

export const state = {
    role: 'reader' as OrganizationRole,
    changeActorRoleAfterMemberLock: false,
    active: true,
    actorMembershipStatus: 'active' as 'active' | 'removed',
    authenticated: true,
    archived: false,
    queryCalls: 0,
    inviteAcceptanceWinsRace: false,
    inviteReads: 0,
    removeActorMembershipAfterMemberLock: false,
    writes: [] as string[],
    statements: [] as Array<{ sql: string, params: unknown[] }>,
    serviceLogs: [] as Record<string, any>[],
    systemEvents: [] as Record<string, any>[],
    apiKeys: [] as Record<string, any>[],
    apiKeyScopes: [] as Record<string, any>[],
}

const raceInvite = {
    id: 'invite-1', organization_id: 'org', email: 'member@example.test', role: 'reader',
    invited_by: 'owner', created_at: '2026-10-01T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z',
    accepted_at: null, accepted_by: null, revoked_at: null,
}
const destination = { id: 'target', orgId: 'org', ownerId: 'owner', name: 'Delivery target', kind: 'webhook', status: 'active', endpointHint: 'example.com/…', endpointHash: 'hash', events: ['dwm.alert.created'] }

const query = async (sql: string, params: unknown[] = []) => {
    state.queryCalls++
    const statement = sql.replace(/\s+/g, ' ').trim()
    state.statements.push({ sql: statement, params })
    if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) state.writes.push(sql)
    if (state.removeActorMembershipAfterMemberLock && statement.startsWith('SELECT id FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE')) {
        state.actorMembershipStatus = 'removed'
        state.removeActorMembershipAfterMemberLock = false
    }
    if (state.changeActorRoleAfterMemberLock && statement.startsWith('SELECT id FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE')) {
        state.role = 'member'
        state.changeActorRoleAfterMemberLock = false
    }
    if (statement.includes('COUNT(*)::int AS owner_count')) return { rows: [{ owner_count: 1 }] }
    if (statement.startsWith('SELECT * FROM organization_invites')) {
        state.inviteReads++
        const accepted = state.inviteAcceptanceWinsRace && state.inviteReads > 1
        return { rows: [{ ...raceInvite, status: accepted ? 'accepted' : 'pending', accepted_at: accepted ? '2026-10-15T12:00:00.000Z' : null, accepted_by: accepted ? 'member' : null }] }
    }
    if (statement.startsWith('UPDATE organization_invites SET status = CASE WHEN $3')) return { rows: [], rowCount: 0 }
    if (statement.startsWith('INSERT INTO api_keys')) {
        const now = new Date().toISOString()
        const row = { id: params[0], owner_id: params[1], organization_id: params[2], name: params[3], tier: params[4], description: params[5], enabled: params[6], key_prefix: params[7], secret_hash: params[8], expires_at: params[9], last_used_at: null, created_at: now, updated_at: now }
        state.apiKeys.push(row)
        return { rows: [row], rowCount: 1 }
    }
    if (statement.startsWith('DELETE FROM api_key_scopes')) {
        const before = state.apiKeyScopes.length
        for (let i = state.apiKeyScopes.length - 1; i >= 0; i--) if (state.apiKeyScopes[i]?.api_key_id === params[0]) state.apiKeyScopes.splice(i, 1)
        return { rows: [], rowCount: before - state.apiKeyScopes.length }
    }
    if (statement.startsWith('INSERT INTO api_key_scopes')) {
        state.apiKeyScopes.push({ id: params[0], api_key_id: params[1], method: params[2], route: params[3], enabled: params[4], per_second: params[5], per_minute: params[6], per_hour: params[7], per_day: params[8] })
        return { rows: [], rowCount: 1 }
    }
    if (statement.includes('FROM api_key_scopes') && statement.includes('WHERE api_key_id = $1')) return { rows: state.apiKeyScopes.filter(scope => scope.api_key_id === params[0]) }
    if (statement.includes('FROM api_keys') && statement.includes('WHERE organization_id = $1') && statement.includes('ORDER BY created_at DESC')) return { rows: state.apiKeys.filter(key => key.organization_id === params[0]) }
    if (sql.includes('FROM dwm_webhook_destinations')) return { rows: [{ id: 'target', org_id: 'org' }] }
    if (sql.includes('FROM organizations o')) return { rows: params[0] === 'org' && state.active && state.actorMembershipStatus === 'active' ? [{ id: 'org', name: 'Organization', slug: 'org', status: 'active', role: state.role, owner_count: 1 }] : [] }
    if (sql.includes('FROM organization_members member')) return { rows: state.active ? [{ role: state.role, organization_status: 'active' }] : [] }
    if (statement.startsWith('UPDATE organization_members')) {
        const now = new Date().toISOString()
        return { rows: [{ organization_id: params[0], user_id: params[1], name: 'Teammate', avatar: '', role: params[2], status: 'active', joined_at: now, created_at: now }], rowCount: 1 }
    }
    if (sql.includes('FROM organization_members')) return { rows: [{ user_id: 'teammate', role: 'reader', status: 'active' }] }
    return { rows: [] }
}

mock.module('#db', () => ({ default: query, withTransaction: async (work: (runQuery: typeof query) => unknown) => work(query), withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work() }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: state.authenticated, id: 'actor' }) }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async (entry: Record<string, any>) => { state.serviceLogs.push(entry) } }))
const systemEventUtils = await import('../../src/utils/systemEvent.ts')
mock.module('#utils/systemEvent.ts', () => ({ ...systemEventUtils, recordSystemEvent: async (entry: Record<string, any>) => { state.systemEvents.push(entry) } }))
mock.module('#utils/dwm/webhooks.ts', () => ({
    ...webhooks,
    listDwmWebhookDestinations: async () => [destination],
    listDwmWebhookDeliveries: async () => [],
    listDwmWebhookAuditEvents: async () => [],
    archiveDwmWebhookDestination: async () => { state.archived = true; return { ...destination, status: 'archived' } },
}))

const org = await import('../../src/handlers/organizations.ts')
const { deleteDwmWebhookDestination } = await import('../../src/handlers/dwm/webhooks.ts')
export const app = Fastify()
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

export function resetOrganizationRolePermissionsFixture() {
    Object.assign(state, {
        role: 'reader', active: true, actorMembershipStatus: 'active', authenticated: true,
        changeActorRoleAfterMemberLock: false,
        archived: false, queryCalls: 0, inviteAcceptanceWinsRace: false, inviteReads: 0,
        removeActorMembershipAfterMemberLock: false,
    })
    state.writes.length = 0
    state.statements.length = 0
    state.serviceLogs.length = 0
    state.systemEvents.length = 0
    state.apiKeys.length = 0
    state.apiKeyScopes.length = 0
}
