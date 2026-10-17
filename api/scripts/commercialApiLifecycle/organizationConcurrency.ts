import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { createApiKey, organizationPublicApiScopes, validateApiKey } from '../../src/utils/auth/apiKeys.ts'
import { queryOnce } from '../../src/utils/db.ts'
import { assertOneViableOwner, insertConcurrentOwnerFixture, raceAfterOrganizationSnapshot } from './helpers.ts'

export async function verifyOrganizationConcurrency(app: FastifyInstance) {
    await queryOnce(`
    INSERT INTO users (id, name, password, avatar)
    VALUES
        ('stale-key-owner', 'Stale Key Owner', 'test', ''),
        ('stale-key-admin', 'Stale Key Admin', 'test', ''),
        ('stale-transfer-owner', 'Stale Transfer Owner', 'test', ''),
        ('stale-transfer-target', 'Stale Transfer Target', 'test', '')
`)
    await queryOnce(`
    INSERT INTO tokens (id, token, ip, user_agent)
    VALUES
        ('stale-key-admin', 'stale-key-admin-token', '127.0.0.1', 'Commercial smoke'),
        ('stale-transfer-owner', 'stale-transfer-owner-token', '127.0.0.1', 'Commercial smoke')
`)
    await queryOnce(`
    INSERT INTO organizations (id, name, slug, created_by)
    VALUES
        ('stale-key-org', 'Stale Key Organization', 'stale-key-organization', 'stale-key-owner'),
        ('stale-transfer-org', 'Stale Transfer Organization', 'stale-transfer-organization', 'stale-transfer-owner')
`)
    await queryOnce(`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES
        ('stale-key-org', 'stale-key-owner', 'owner'),
        ('stale-key-org', 'stale-key-admin', 'admin'),
        ('stale-transfer-org', 'stale-transfer-owner', 'owner'),
        ('stale-transfer-org', 'stale-transfer-target', 'admin')
`)

    const staleKeyCreation = await raceAfterOrganizationSnapshot('stale-key-org', () => app.inject({
        method: 'POST',
        url: '/api/organizations/stale-key-org/api-keys',
        headers: { authorization: 'Bearer stale-key-admin-token', id: 'stale-key-admin' },
        payload: { name: 'Stale admin key' },
    }), client => client.query(`
    UPDATE organization_members
    SET role = 'member'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`))
    assert.equal(staleKeyCreation.statusCode, 403, staleKeyCreation.body)
    assert.equal(staleKeyCreation.json().error.code, 'organization_role_forbidden')
    assert.equal(Number((await queryOnce('SELECT COUNT(*) count FROM api_keys WHERE organization_id = \'stale-key-org\'')).rows[0].count), 0)

    await queryOnce(`
    UPDATE organization_members
    SET role = 'admin'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`)
    await queryOnce('UPDATE organizations SET status = \'archived\' WHERE id = \'stale-key-org\'')
    const staleReactivation = await raceAfterOrganizationSnapshot('stale-key-org', () => app.inject({
        method: 'PUT',
        url: '/api/organizations/stale-key-org/settings',
        headers: { authorization: 'Bearer stale-key-admin-token', id: 'stale-key-admin' },
        payload: { lifecycleStatus: 'active' },
    }), client => client.query(`
    UPDATE organization_members
    SET role = 'member'
    WHERE organization_id = 'stale-key-org'
      AND user_id = 'stale-key-admin'
`))
    assert.equal(staleReactivation.statusCode, 403, staleReactivation.body)
    assert.equal((await queryOnce('SELECT status FROM organizations WHERE id = \'stale-key-org\'')).rows[0].status, 'archived')

    const staleTransfer = await raceAfterOrganizationSnapshot('stale-transfer-org', () => app.inject({
        method: 'POST',
        url: '/api/organizations/stale-transfer-org/ownership-transfer',
        headers: { authorization: 'Bearer stale-transfer-owner-token', id: 'stale-transfer-owner' },
        payload: { targetUserId: 'stale-transfer-target', reason: 'Concurrent stale-owner proof.' },
    }), client => client.query(`
    UPDATE organization_members
    SET role = 'admin'
    WHERE organization_id = 'stale-transfer-org'
      AND user_id = 'stale-transfer-owner'
`))
    assert.equal(staleTransfer.statusCode, 403, staleTransfer.body)
    assert.deepEqual((await queryOnce(`
    SELECT user_id, role
    FROM organization_members
    WHERE organization_id = 'stale-transfer-org'
    ORDER BY user_id
`)).rows, [
        { user_id: 'stale-transfer-owner', role: 'admin' },
        { user_id: 'stale-transfer-target', role: 'admin' },
    ])

    await insertConcurrentOwnerFixture('concurrent-demotion')
    const concurrentDemotions = await Promise.all(['a', 'b'].map(owner => app.inject({
        method: 'PATCH',
        url: `/api/organizations/concurrent-demotion-org/members/concurrent-demotion-owner-${owner}/role`,
        headers: {
            authorization: `Bearer concurrent-demotion-owner-${owner}-token`,
            id: `concurrent-demotion-owner-${owner}`,
        },
        payload: { role: 'admin', reason: 'Concurrent owner demotion proof.' },
    })))
    assert.deepEqual(concurrentDemotions.map(response => response.statusCode).sort(), [200, 409], concurrentDemotions.map(response => response.body))
    await assertOneViableOwner('concurrent-demotion-org')

    await insertConcurrentOwnerFixture('concurrent-removal')
    const concurrentRemovals = await Promise.all(['a', 'b'].map(owner => app.inject({
        method: 'DELETE',
        url: `/api/organizations/concurrent-removal-org/members/concurrent-removal-owner-${owner}`,
        headers: {
            authorization: `Bearer concurrent-removal-owner-${owner}-token`,
            id: `concurrent-removal-owner-${owner}`,
        },
    })))
    assert.deepEqual(concurrentRemovals.map(response => response.statusCode).sort(), [200, 409])
    await assertOneViableOwner('concurrent-removal-org')

    await insertConcurrentOwnerFixture('delete-remove')
    const deleteSelfVsRemoval = await Promise.all([
        app.inject({
            method: 'DELETE',
            url: '/user/self',
            headers: {
                authorization: 'Bearer delete-remove-owner-a-token',
                id: 'delete-remove-owner-a',
            },
        }),
        app.inject({
            method: 'DELETE',
            url: '/api/organizations/delete-remove-org/members/delete-remove-owner-b',
            headers: {
                authorization: 'Bearer delete-remove-owner-a-token',
                id: 'delete-remove-owner-a',
            },
        }),
    ])
    assert.equal(deleteSelfVsRemoval.filter(response => response.statusCode === 200).length, 1)
    assert.equal(deleteSelfVsRemoval.filter(response => response.statusCode !== 200).length, 1)
    await assertOneViableOwner('delete-remove-org')

    await insertConcurrentOwnerFixture('concurrent', 'Concurrent')
    const concurrentOrganizationKey = await createApiKey({
        ownerId: 'concurrent-owner-a',
        organizationId: 'concurrent-org',
        name: 'Concurrent lifecycle API',
        tier: 'starter',
        expiresAt: '2027-01-01T00:00:00.000Z',
        scopes: organizationPublicApiScopes(),
    })
    const concurrentDeletionResponses = await Promise.all(['a', 'b'].map(owner => app.inject({
        method: 'DELETE',
        url: '/user/self',
        headers: {
            authorization: `Bearer concurrent-owner-${owner}-token`,
            id: `concurrent-owner-${owner}`,
        },
    })))
    assert.deepEqual(concurrentDeletionResponses.map(response => response.statusCode).sort(), [200, 409], concurrentDeletionResponses.map(response => response.body))
    assert.equal(Number((await queryOnce(`
    SELECT COUNT(*) count
    FROM users
    WHERE id IN ('concurrent-owner-a', 'concurrent-owner-b')
      AND deletion_scheduled_at IS NOT NULL
`)).rows[0].count), 1)
    await assertOneViableOwner('concurrent-org')
    assert.equal((await validateApiKey(concurrentOrganizationKey.secret))?.organizationId, 'concurrent-org')
    const concurrentViableOwnerId = (await queryOnce(`
    SELECT id
    FROM users
    WHERE id IN ('concurrent-owner-a', 'concurrent-owner-b')
      AND deletion_scheduled_at IS NULL
`)).rows[0].id as string
    await queryOnce('UPDATE users SET deletion_scheduled_at = NOW() + INTERVAL \'30 days\' WHERE id = $1', [concurrentViableOwnerId])
    assert.equal(await validateApiKey(concurrentOrganizationKey.secret), null, 'a scheduled-for-deletion owner is not viable key authority')
    await queryOnce('UPDATE users SET deletion_scheduled_at = NULL WHERE id = $1', [concurrentViableOwnerId])
    assert.equal((await validateApiKey(concurrentOrganizationKey.secret))?.organizationId, 'concurrent-org')

}
