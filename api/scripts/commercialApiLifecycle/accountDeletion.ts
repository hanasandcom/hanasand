import assert from 'node:assert/strict'
import pg from 'pg'
import type { createApiKey } from '../../src/utils/auth/apiKeys.ts'
import { revokeOrganizationApiKey, validateApiKey } from '../../src/utils/auth/apiKeys.ts'
import { resolveRateLimitActor } from '../../src/plugins/rateLimit.ts'
import purgeDeletedAccounts from '../../src/utils/auth/purgeDeletedAccounts.ts'
import { queryOnce } from '../../src/utils/db.ts'
import type { FastifyInstance } from 'fastify'

type OrganizationKey = Awaited<ReturnType<typeof createApiKey>>

export async function verifyAccountDeletion(app: FastifyInstance, organizationKey: OrganizationKey, legacyUnboundKey: OrganizationKey) {
    const deleteRequest = {
        method: 'DELETE' as const,
        url: '/user/self',
        headers: {
            authorization: 'Bearer commercial-session-token',
            id: 'commercial-creator',
        },
    }

    const soleOwnerDeletion = await app.inject(deleteRequest)
    assert.equal(soleOwnerDeletion.statusCode, 409)
    assert.equal(soleOwnerDeletion.json().code, 'organization_ownership_transfer_required')
    assert.equal(soleOwnerDeletion.json().organization_id, 'commercial-org')
    assert.equal(soleOwnerDeletion.json().active_api_key, true)
    assert.equal((await queryOnce('SELECT deletion_scheduled_at FROM users WHERE id = $1', ['commercial-creator'])).rows[0].deletion_scheduled_at, null)
    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')

    await queryOnce(`
    UPDATE organization_members
    SET role = CASE WHEN user_id = 'commercial-admin' THEN 'owner' ELSE 'admin' END
    WHERE organization_id = 'commercial-org'
      AND user_id IN ('commercial-creator', 'commercial-admin')
`)
    const transferredDeletion = await app.inject(deleteRequest)
    assert.equal(transferredDeletion.statusCode, 200)
    assert.equal(transferredDeletion.json().pending_deletion, true)
    assert.ok((await queryOnce('SELECT deletion_scheduled_at FROM users WHERE id = $1', ['commercial-creator'])).rows[0].deletion_scheduled_at)
    assert.ok((await queryOnce('SELECT revoked_at FROM tokens WHERE id = $1', ['commercial-creator'])).rows[0].revoked_at)
    assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')

    await queryOnce('UPDATE users SET deletion_scheduled_at = NOW() - INTERVAL \'1 minute\' WHERE id = \'commercial-creator\'')
    await purgeDeletedAccounts()
    await queryOnce('CHECKPOINT')
    await app.close()

    const reopened = new pg.Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST,
        database: process.env.DB,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
    })
    await reopened.connect()
    try {
        assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM users WHERE id = $1', ['commercial-creator'])).rows[0].count), 0)
        assert.deepEqual((await reopened.query('SELECT created_by, status FROM organizations WHERE id = $1', ['commercial-org'])).rows[0], {
            created_by: null,
            status: 'active',
        })
        assert.deepEqual((await reopened.query('SELECT user_id, role, status FROM organization_members WHERE organization_id = $1 ORDER BY user_id', ['commercial-org'])).rows, [
            { user_id: 'commercial-admin', role: 'owner', status: 'active' },
        ])
        assert.deepEqual((await reopened.query('SELECT owner_id, organization_id, enabled FROM api_keys WHERE id = $1', [organizationKey.apiKey.id])).rows[0], {
            owner_id: null,
            organization_id: 'commercial-org',
            enabled: true,
        })
        assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM api_keys WHERE id = $1', [legacyUnboundKey.apiKey.id])).rows[0].count), 0)
        assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM article_ownership WHERE owner_id = $1', ['commercial-creator'])).rows[0].count), 0)
        assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM attempts WHERE id = $1', ['commercial-creator'])).rows[0].count), 0)
        assert.equal(Number((await reopened.query('SELECT COUNT(*) count FROM login_events WHERE user_id = $1', ['commercial-creator'])).rows[0].count), 0)
        assert.deepEqual((await reopened.query('SELECT actor_id, object_type, object_id, subject_id, request_id, ip, user_agent, context FROM system_events')).rows[0], {
            actor_id: null,
            object_type: 'user',
            object_id: null,
            subject_id: null,
            request_id: '',
            ip: '',
            user_agent: '',
            context: {},
        })
        assert.deepEqual((await reopened.query('SELECT owner_id FROM case_repositories ORDER BY id')).rows, [{ owner_id: null }, { owner_id: 'commercial-admin' }])
        assert.equal((await reopened.query('SELECT is_nullable FROM information_schema.columns WHERE table_name = \'case_repositories\' AND column_name = \'owner_id\'')).rows[0].is_nullable, 'YES')
        assert.deepEqual((await reopened.query(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
          AND column_name = 'created_by'
    `)).rows[0], { column_name: 'created_by', is_nullable: 'YES' })
        assert.equal((await reopened.query(`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname = 'organizations_created_by_fkey'
    `)).rows[0].confdeltype, 'n')

        assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
        await reopened.query('UPDATE organization_members SET status = \'removed\' WHERE organization_id = \'commercial-org\' AND user_id = \'commercial-admin\'')
        assert.equal(await validateApiKey(organizationKey.secret), null, 'an organization key without an active owner must not authenticate')
        await reopened.query('UPDATE organization_members SET status = \'active\' WHERE organization_id = \'commercial-org\' AND user_id = \'commercial-admin\'')
        assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
        await reopened.query('UPDATE organizations SET status = \'archived\' WHERE id = \'commercial-org\'')
        assert.equal(await validateApiKey(organizationKey.secret), null)
        await reopened.query('UPDATE organizations SET status = \'active\' WHERE id = \'commercial-org\'')
        assert.equal((await validateApiKey(organizationKey.secret))?.organizationId, 'commercial-org')
    } finally {
        await reopened.end()
    }

    assert.equal((await revokeOrganizationApiKey('commercial-org', organizationKey.apiKey.id))?.enabled, false)
    assert.equal(await validateApiKey(organizationKey.secret), null)
    assert.equal(await validateApiKey(legacyUnboundKey.secret), null)
    const revokedActor = await resolveRateLimitActor({
        ip: '127.0.0.1',
        headers: { 'x-api-key': organizationKey.secret },
    } as unknown as FastifyRequest)
    assert.equal(revokedActor.invalidApiKey, true, 'revoked keys must reach the invalid_api_key boundary')

}
