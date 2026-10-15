import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let inviteReadCount = 0
const serviceLogs: Record<string, any>[] = []
const systemEvents: Record<string, any>[] = []
let inviteActionWrites = 0

const pendingInvite = {
    id: 'invite-1',
    organization_id: 'org-1',
    email: 'member@example.test',
    role: 'reader',
    invited_by: 'owner-1',
    status: 'pending',
    created_at: '2026-10-01T00:00:00.000Z',
    expires_at: '2026-11-01T00:00:00.000Z',
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
}
const acceptedInvite = {
    ...pendingInvite,
    status: 'accepted',
    accepted_at: '2026-10-15T12:00:00.000Z',
    accepted_by: 'member-1',
}

const query = async (sql: string) => {
    const statement = sql.replace(/\s+/g, ' ').trim()
    if (statement.includes('FROM organizations o') && statement.includes('JOIN organization_members om')) {
        return { rows: [{ id: 'org-1', name: 'Organization', slug: 'organization', status: 'active', audit_safe_metadata: null, role: 'owner' }] }
    }
    if (statement.startsWith('SELECT * FROM organization_invites')) {
        inviteReadCount++
        return { rows: [inviteReadCount === 1 ? pendingInvite : acceptedInvite] }
    }
    if (statement.startsWith('UPDATE organization_invites SET status = CASE WHEN $3')) {
        inviteActionWrites++
        return { rows: [], rowCount: 0 }
    }
    return { rows: [] }
}

mock.module('#db', () => ({ default: query, withTransaction: async (work: (runQuery: typeof query) => unknown) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner-1' }) }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async (entry: Record<string, any>) => { serviceLogs.push(entry) } }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async (entry: Record<string, any>) => { systemEvents.push(entry) } }))

const { postOrganizationInviteAction } = await import('../src/handlers/organizations.ts')
const app = Fastify()
app.post('/org/:id/invites/:inviteId/actions', postOrganizationInviteAction)

test('invite revoke reports accepted-invite conflict when acceptance wins the update race', async () => {
    inviteReadCount = 0
    serviceLogs.length = 0
    systemEvents.length = 0
    inviteActionWrites = 0

    const response = await app.inject({
        method: 'POST',
        url: '/org/org-1/invites/invite-1/actions',
        payload: { action: 'revoke', reason: 'Revoke after acceptance race.', requestId: 'invite-race-1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
        error: 'Accepted invites cannot be revoked or resent; manage the member instead.',
        inviteActionDenial: {
            schemaVersion: 'organization.invite_action_denial.v1',
            inviteId: 'invite-1',
            inviteStatus: 'accepted',
            action: 'revoke',
            blockerCode: 'invite_already_accepted',
            requestId: 'invite-race-1',
        },
    })
    expect(inviteActionWrites).toBe(1)
    expect(serviceLogs.map(entry => entry.message)).toEqual(['organization_invite_action_denied'])
    expect(serviceLogs[0].metadata).toMatchObject({ action: 'revoke', blockerCode: 'invite_already_accepted', requestId: 'invite-race-1' })
    expect(systemEvents).toHaveLength(0)
})
