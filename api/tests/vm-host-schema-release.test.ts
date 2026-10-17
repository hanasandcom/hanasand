import { expect, test } from 'bun:test'
import { applyTrackedSchemaRelease, vmHostMigrationReleaseMarker } from '../src/utils/db/schemaReleasePolicy.ts'
import { backfillVmHostAssignments, inspurVmHostBackfillSql } from '../src/utils/db/vmHostBackfill.ts'

function releaseDatabase() {
    const releases = new Set<string>()
    const queues = new Map<string, Promise<void>>()
    const query = async (sql: string, params?: Array<string | number | null | boolean | string[] | Date>) => {
        if (sql.startsWith('SELECT 1 FROM app_schema_releases')) return { rowCount: releases.has(String(params?.[0])) ? 1 : 0 }
        if (sql.startsWith('INSERT INTO app_schema_releases')) releases.add(String(params?.[0]))
        return { rowCount: 0 }
    }
    const withAdvisoryLock = async <T>(key: string, work: (query: typeof query) => Promise<T>) => {
        const previous = queues.get(key) || Promise.resolve()
        let unlock = () => {}
        const next = new Promise<void>(resolve => { unlock = resolve })
        queues.set(key, next)
        await previous
        try { return await work(query) } finally { unlock() }
    }
    return { releases, withAdvisoryLock }
}

test('Inspur VM host backfill uses a distinct marker from the global schema release', () => {
    const release = '0ba5340e00000000000000000000000000000000'

    expect(vmHostMigrationReleaseMarker(release, 'inspur')).toBe(`${release}:vm-host-backfill:inspur`)
    expect(vmHostMigrationReleaseMarker(release, 'ovhcloud')).toBeNull()
    expect(vmHostMigrationReleaseMarker(undefined, 'inspur')).toBeNull()
})

test('the same release applies global schema and the Inspur host migration once each', async () => {
    const database = releaseDatabase()
    const release = '0ba5340e00000000000000000000000000000000'
    let fullSchemaRuns = 0
    let hostMigrationRuns = 0
    const apply = (host: string) => applyTrackedSchemaRelease(
        release,
        vmHostMigrationReleaseMarker(release, host),
        database.withAdvisoryLock,
        async () => { fullSchemaRuns++ },
        async () => {
            hostMigrationRuns++
            await backfillVmHostAssignments(host, async () => ({ rowCount: 0 }))
        },
    )

    expect(await apply('ovhcloud')).toBe('schema-applied')
    expect(await apply('inspur')).toBe('host-migration-applied')
    expect(await apply('inspur')).toBe('already-applied')
    expect(fullSchemaRuns).toBe(1)
    expect(hostMigrationRuns).toBe(1)
})

test('concurrent Inspur startup runs one host migration under the release lock', async () => {
    const database = releaseDatabase()
    const release = '0ba5340e00000000000000000000000000000000'
    database.releases.add(release)
    let migrationRuns = 0
    const apply = () => applyTrackedSchemaRelease(
        release,
        vmHostMigrationReleaseMarker(release, 'inspur'),
        database.withAdvisoryLock,
        async () => {},
        async () => { migrationRuns++; await new Promise(resolve => setTimeout(resolve, 5)) },
    )

    expect((await Promise.all([apply(), apply()])).sort()).toEqual(['already-applied', 'host-migration-applied'])
    expect(migrationRuns).toBe(1)
})

test('a failed host migration leaves no marker and retries safely', async () => {
    const database = releaseDatabase()
    const release = '0ba5340e00000000000000000000000000000000'
    database.releases.add(release)
    const marker = vmHostMigrationReleaseMarker(release, 'inspur')!
    let attempts = 0
    const apply = (fail: boolean) => applyTrackedSchemaRelease(
        release, marker, database.withAdvisoryLock, async () => {}, async () => {
            attempts++
            if (fail) throw new Error('backfill failed')
        },
    )

    await expect(apply(true)).rejects.toThrow('backfill failed')
    expect(database.releases.has(marker)).toBe(false)
    expect(await apply(false)).toBe('host-migration-applied')
    expect(await apply(false)).toBe('already-applied')
    expect(attempts).toBe(2)
})

test('Inspur backfill skips other hosts and limits updates to rows with vm_details', async () => {
    const statements: string[] = []
    const query = async (sql: string) => { statements.push(sql); return { rowCount: 0 } }

    expect(await backfillVmHostAssignments('ovhcloud', query)).toBe(false)
    expect(statements).toEqual([])
    expect(await backfillVmHostAssignments('inspur', query)).toBe(true)
    expect(statements).toEqual([inspurVmHostBackfillSql])
    expect(inspurVmHostBackfillSql).toContain('LOWER(COALESCE(v.primary_host, \'\')) = \'ovhcloud\'')
    expect(inspurVmHostBackfillSql).toMatch(/AND EXISTS \(SELECT 1 FROM vm_details d WHERE LOWER\(d\.name\) = LOWER\(v\.name\)\)/)
})
