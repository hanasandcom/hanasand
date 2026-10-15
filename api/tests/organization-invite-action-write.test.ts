import { expect, test } from 'bun:test'
import { updateOrganizationInviteAction, type IdentityQuery } from '../src/utils/db/identityDataWrites.ts'

test('invite actions share an atomic transition that cannot overwrite acceptance', async () => {
    let sql = ''
    let values: unknown[] = []
    const query: IdentityQuery = async (statement, params = []) => {
        sql = statement
        values = params
        return { rows: [], rowCount: 0 }
    }

    const updated = await updateOrganizationInviteAction({
        organizationId: 'org-1',
        inviteId: 'invite-1',
        action: 'resend',
        expiresAt: '2026-11-01T00:00:00.000Z',
    }, query)

    expect(updated).toBeNull()
    expect(sql).toContain('AND status <> \'accepted\'')
    expect(sql).toContain('CASE WHEN $3 = \'resend\' THEN \'pending\' ELSE \'revoked\' END')
    expect(values).toEqual(['invite-1', 'org-1', 'resend', '2026-11-01T00:00:00.000Z'])
})

test('revoking an invite leaves its expiry unchanged', async () => {
    let values: unknown[] = []
    const query: IdentityQuery = async (_statement, params = []) => {
        values = params
        return { rows: [{ id: 'invite-1', status: 'revoked' }], rowCount: 1 }
    }

    const updated = await updateOrganizationInviteAction({
        organizationId: 'org-1',
        inviteId: 'invite-1',
        action: 'revoke',
    }, query)

    expect(updated).toEqual({ id: 'invite-1', status: 'revoked' })
    expect(values).toEqual(['invite-1', 'org-1', 'revoke', null])
})
