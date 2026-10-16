import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'bun:test'
import { classifyUnitTest, getPostgresFilterPortError, getPostgresFilterRunNotice, isTaskEnabledByDefault, postgresFilterTestIds } from '../scripts/test-runner-policy.ts'

const postgresFilterSuites = [
    'analysis-policy-migration.test.ts',
    'analyze-cdn-delivery-database.test.ts',
    'analyze-cdn-delivery-reprocess.test.ts',
    'analyze-cdn-refresh-database.test.ts',
    'analyze-ingestion-database.test.ts',
    'analyze-model-discovery-database.test.ts',
    'analyze-postgres-database.test.ts',
    'analyze-routine-groups-postgres.test.ts',
    'builtin-reprocess-postgres.test.ts',
    'existing-schema.test.ts',
    'readiness-audit-database.test.ts',
    'self-ingestion-proof-postgres.test.ts',
    'ssh-transport-postgres.test.ts',
    'verified-probe-activation-postgres.test.ts',
]

test('PostgreSQL-filter suites are classified as database tasks requiring the disposable filter port', () => {
    expect(postgresFilterSuites).toHaveLength(14)
    for (const file of postgresFilterSuites) {
        expect(classifyUnitTest(file)).toEqual({ requiresDatabase: true, requiresPostgresFilterPort: true })
    }
})

test('unit suites stay in the safe default runner while database suites remain opt-in', () => {
    expect(classifyUnitTest('analyze-cdn-refresh-ingest.test.ts')).toEqual({
        requiresDatabase: false,
        requiresPostgresFilterPort: false,
    })
    expect(isTaskEnabledByDefault(undefined, {})).toBe(true)
    expect(isTaskEnabledByDefault('database', {})).toBe(false)
    expect(isTaskEnabledByDefault('database', { RUN_DB_TESTS: '1' })).toBe(true)
})

test('default runner notice names excluded suites and gives the exact opt-in command', () => {
    const tasks = postgresFilterTestIds.map(id => ({ id, requiresPostgresFilterPort: true }))
    const notice = getPostgresFilterRunNotice(tasks, false)

    expect(notice).toContain('Excluded PostgreSQL-filter suites (14; not run in this default run)')
    expect(notice).toContain('Set POSTGRES_FILTER_TEST_PORT to the port of a disposable local PostgreSQL instance with a postgres_filter_test database')
    expect(notice).toContain('then run bun run test:postgres-filter (the script sets RUN_DB_TESTS=1)')
    for (const id of postgresFilterTestIds) expect(notice).toContain(id)
    expect(getPostgresFilterRunNotice(tasks, true)).toBeNull()
})

test('package script selects exactly the canonical PostgreSQL-filter suite IDs', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(packageJson.scripts['test:postgres-filter']).toBe(
        `RUN_DB_TESTS=1 bun scripts/index.ts --only=${postgresFilterTestIds.join(',')}`,
    )
})

test('selected filter tasks require a valid local PostgreSQL port', () => {
    const tasks = [{ id: 'analysis-policy-migration', requiresPostgresFilterPort: true }]
    expect(getPostgresFilterPortError(tasks, undefined)).toContain('POSTGRES_FILTER_TEST_PORT')
    expect(getPostgresFilterPortError(tasks, '')).toContain('POSTGRES_FILTER_TEST_PORT')
    expect(getPostgresFilterPortError(tasks, '1023')).toContain('1024-65535')
    expect(getPostgresFilterPortError(tasks, '65536')).toContain('1024-65535')
    expect(getPostgresFilterPortError(tasks, 'not-a-port')).toContain('1024-65535')
    expect(getPostgresFilterPortError(tasks, '5432')).toBeNull()
    expect(getPostgresFilterPortError([{ id: 'ordinary-unit' }], undefined)).toBeNull()
})

test('package script preflight rejects missing port before starting any selected test', () => {
    const environment = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key !== 'POSTGRES_FILTER_TEST_PORT'),
    ) as Record<string, string>
    delete environment.RUN_DB_TESTS

    const result = spawnSync(process.execPath, ['run', 'test:postgres-filter'], {
        cwd: process.cwd(),
        env: environment,
        encoding: 'utf8',
    })

    expect(result.status).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain('PostgreSQL-filter test tasks selected:')
    expect(`${result.stdout}\n${result.stderr}`).toContain('POSTGRES_FILTER_TEST_PORT')
    expect(`${result.stdout}\n${result.stderr}`).toContain('disposable local PostgreSQL instance with a postgres_filter_test database')
    expect(`${result.stdout}\n${result.stderr}`).toContain('it does not connect to PostgreSQL')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('[api:test] API behavior:')
    for (const id of postgresFilterTestIds) expect(`${result.stdout}\n${result.stderr}`).toContain(id)
})
