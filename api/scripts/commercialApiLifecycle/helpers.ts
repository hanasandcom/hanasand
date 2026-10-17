import assert from 'node:assert/strict'
import Fastify from 'fastify'
import pg from 'pg'
import publicTiApi from '../../src/handlers/ti/publicApi.ts'
import deleteSelf from '../../src/handlers/user/deleteSelf.ts'
import { deleteOrganizationMember, patchOrganizationMemberRole, postOrganizationApiKey, postOrganizationOwnershipTransfer, putOrganizationSettings } from '../../src/handlers/organizations.ts'
import rateLimitPlugin from '../../src/plugins/rateLimit.ts'
import { queryOnce } from '../../src/utils/db.ts'

export async function raceAfterOrganizationSnapshot<T>(
    organizationId: string,
    request: () => Promise<T>,
    mutate: (client: pg.Client) => Promise<unknown>,
) {
    const client = new pg.Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST,
        database: process.env.DB,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
    })
    await client.connect()
    let committed = false
    try {
        await client.query('BEGIN')
        await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organizationId])
        const pending = request()
        await waitForBlockedOrganizationTransaction()
        await mutate(client)
        await client.query('COMMIT')
        committed = true
        return await pending
    } finally {
        if (!committed) await client.query('ROLLBACK')
        await client.end()
    }
}

async function waitForBlockedOrganizationTransaction() {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const waiting = await queryOnce(`
            SELECT COUNT(*)::int AS waiting
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock'
              AND query ILIKE '%FROM organizations%FOR UPDATE%'
        `)
        if (Number(waiting.rows[0]?.waiting ?? 0) > 0) return
        await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error('Timed out waiting for the organization mutation to block on its transaction lock.')
}

export async function insertConcurrentOwnerFixture(prefix: string, displayNamePrefix = prefix) {
    await queryOnce(`
        INSERT INTO users (id, name, password, avatar)
        VALUES
            ($1, $2, 'test', ''),
            ($3, $4, 'test', '')
    `, [`${prefix}-owner-a`, `${displayNamePrefix} Owner A`, `${prefix}-owner-b`, `${displayNamePrefix} Owner B`])
    await queryOnce(`
        INSERT INTO tokens (id, token, ip, user_agent)
        VALUES
            ($1, $2, '127.0.0.1', 'Commercial smoke'),
            ($3, $4, '127.0.0.1', 'Commercial smoke')
    `, [
        `${prefix}-owner-a`,
        `${prefix}-owner-a-token`,
        `${prefix}-owner-b`,
        `${prefix}-owner-b-token`,
    ])
    await queryOnce(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, $2, $3, $4)
    `, [`${prefix}-org`, `${displayNamePrefix} Organization`, `${prefix}-organization`, `${prefix}-owner-a`])
    await queryOnce(`
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES
            ($1, $2, 'owner'),
            ($1, $3, 'owner')
    `, [`${prefix}-org`, `${prefix}-owner-a`, `${prefix}-owner-b`])
}

export async function assertOneViableOwner(organizationId: string) {
    assert.equal(Number((await queryOnce(`
        SELECT COUNT(*) count
        FROM organization_members membership
        JOIN users owner
          ON owner.id = membership.user_id
         AND owner.active IS TRUE
         AND owner.deletion_scheduled_at IS NULL
        WHERE membership.organization_id = $1
          AND membership.role = 'owner'
          AND membership.status = 'active'
    `, [organizationId])).rows[0].count), 1)
}

export async function commercialApp() {
    const instance = Fastify()
    await instance.register(rateLimitPlugin)
    await instance.register(publicTiApi, {
        prefix: '/api/v1',
        searchImpl: async ({ query }: { query: string }) => ({
            query,
            generatedAt: new Date().toISOString(),
            mode: 'scraper',
            status: 'ready',
            summary: `Public evidence for ${query}.`,
            confidence: 0.9,
            aliases: [],
            recentActivity: [],
            targets: [],
            ttps: [],
            datasets: [],
            sources: [],
            notes: [],
        }),
    })
    instance.delete('/user/self', deleteSelf)
    instance.post('/api/organizations/:id/api-keys', postOrganizationApiKey)
    instance.put('/api/organizations/:id/settings', putOrganizationSettings)
    instance.patch('/api/organizations/:id/members/:userId/role', patchOrganizationMemberRole)
    instance.delete('/api/organizations/:id/members/:userId', deleteOrganizationMember)
    instance.post('/api/organizations/:id/ownership-transfer', postOrganizationOwnershipTransfer)
    await instance.ready()
    return instance
}
