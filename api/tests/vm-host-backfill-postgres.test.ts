import { afterAll, beforeAll, expect, test } from 'bun:test'
import pg, { type PoolClient } from 'pg'
import type { SchemaReleaseQuery } from '../src/utils/db/schemaReleasePolicy.ts'
import { applyTrackedSchemaRelease, vmHostMigrationReleaseMarker } from '../src/utils/db/schemaReleasePolicy.ts'
import { backfillVmHostAssignments } from '../src/utils/db/vmHostBackfill.ts'

if (process.env.DB !== 'vm_host_backfill_test' || process.env.DB_HOST !== '127.0.0.1') {
    throw Error('Requires the disposable local vm_host_backfill_test database')
}

const schema = `vm_host_backfill_acceptance_${process.pid}`
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB })

async function withSchemaClient<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect()
    try {
        await client.query(`SET search_path TO ${schema}`)
        return await work(client)
    } finally {
        client.release()
    }
}

const query: SchemaReleaseQuery = async (sql, params) => withSchemaClient(async client => {
    const result = await client.query(sql, params)
    return { rowCount: result.rowCount }
})

const queryWithLockTimeout: SchemaReleaseQuery = async (sql, params) => withSchemaClient(async client => {
    await client.query('BEGIN')
    try {
        await client.query('SET LOCAL lock_timeout = \'100ms\'')
        const result = await client.query(sql, params)
        await client.query('COMMIT')
        return { rowCount: result.rowCount }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    }
})

async function withAdvisoryLock<T>(key: string, work: (query: SchemaReleaseQuery) => Promise<T>) {
    const client = await pool.connect()
    await client.query(`SET search_path TO ${schema}`)
    await client.query('BEGIN')
    try {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key])
        const queryInTransaction: SchemaReleaseQuery = async (sql, params) => {
            const result = await client.query(sql, params)
            return { rowCount: result.rowCount }
        }
        const result = await work(queryInTransaction)
        await client.query('COMMIT')
        return result
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

async function applyHostRelease(release: string, lockTimeout = false) {
    const marker = vmHostMigrationReleaseMarker(release, 'inspur')
    return applyTrackedSchemaRelease(release, marker,
        withAdvisoryLock,
        async () => { throw Error('The existing global schema marker should skip full schema setup') },
        async () => { await backfillVmHostAssignments('inspur', lockTimeout ? queryWithLockTimeout : query) })
}

beforeAll(async () => {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`)
    await withSchemaClient(async client => {
        await client.query('DROP TABLE IF EXISTS app_schema_releases, vm_details, vms CASCADE')
        await client.query('CREATE TABLE app_schema_releases (release TEXT PRIMARY KEY)')
        await client.query('CREATE TABLE vms (name TEXT PRIMARY KEY, primary_host TEXT)')
        await client.query('CREATE TABLE vm_details (name TEXT PRIMARY KEY)')
        await client.query('INSERT INTO app_schema_releases VALUES (\'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\')')
        await client.query('INSERT INTO vms VALUES (\'cashflow\', \'OVHCLOUD\'), (\'without-details\', \'ovhcloud\'), (\'already-inspur\', \'inspur\')')
        await client.query('INSERT INTO vm_details VALUES (\'CASHFLOW\'), (\'already-inspur\')')
    })
})

afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await pool.end()
})

test('Inspur host backfill updates only matching VM rows and marks the release after success', async () => {
    const release = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    expect(await applyHostRelease(release)).toBe('host-migration-applied')
    const rows = await withSchemaClient(async client => (await client.query('SELECT name, primary_host FROM vms ORDER BY name')).rows)
    expect(rows).toEqual([
        { name: 'already-inspur', primary_host: 'inspur' },
        { name: 'cashflow', primary_host: 'inspur' },
        { name: 'without-details', primary_host: 'ovhcloud' },
    ])
    expect(await query('SELECT 1 FROM app_schema_releases WHERE release = $1', [`${release}:vm-host-backfill:inspur`])).toMatchObject({ rowCount: 1 })
    expect(await applyHostRelease(release)).toBe('already-applied')
    expect(await applyTrackedSchemaRelease(release, vmHostMigrationReleaseMarker(release, 'ovhcloud'),
        withAdvisoryLock, async () => {}, async () => { throw Error('other host must not backfill') })).toBe('already-applied')
})

test('a PostgreSQL table lock leaves the host marker absent and a later startup retries', async () => {
    const release = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    await query('INSERT INTO app_schema_releases (release) VALUES ($1)', [release])
    const blocker = await pool.connect()
    await blocker.query(`SET search_path TO ${schema}`)
    await blocker.query('BEGIN; LOCK TABLE vms IN ACCESS EXCLUSIVE MODE')
    try {
        const failure = await applyHostRelease(release, true).then(() => null, error => error)
        expect((failure as { code?: string })?.code).toBe('55P03')
        expect(await query('SELECT 1 FROM app_schema_releases WHERE release = $1', [`${release}:vm-host-backfill:inspur`])).toMatchObject({ rowCount: 0 })
    } finally {
        await blocker.query('ROLLBACK')
        blocker.release()
    }
    expect(await applyHostRelease(release)).toBe('host-migration-applied')
    expect(await query('SELECT 1 FROM vms WHERE name = \'cashflow\' AND primary_host = \'inspur\'')).toMatchObject({ rowCount: 1 })
})
