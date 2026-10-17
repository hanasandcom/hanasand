import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { expect, test } from 'bun:test'
import { classifiedUnitTestFiles, classifyUnitTest, getDatabaseRunNotice, getPostgresFilterPortError, isTaskEnabledByDefault, postgresFilterTestIds } from '../scripts/test-runner-policy.ts'
import { discoverTestTasks, parseSelectedTaskIds } from '../scripts/test-runner-tasks.ts'

const postgresFilterSuites = [
    'account-deletion-purge-postgres.test.ts',
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
    expect(postgresFilterSuites).toHaveLength(15)
    for (const file of postgresFilterSuites) {
        expect(classifyUnitTest(file)).toEqual({ requiresDatabase: true, requiresPostgresFilterPort: true })
    }
})

test('every discovered test suite has an explicit runner category', () => {
    const discoveredSuites = readdirSync('tests')
        .filter(file => /\.test\.(ts|mjs)$/.test(file))
        .sort()

    expect([...classifiedUnitTestFiles].sort()).toEqual(discoveredSuites)
    expect(() => classifyUnitTest('new-database-suite.test.ts')).toThrow('has no runner category')
})

test('runner catalog preserves AI readiness registration and explicit selection', async () => {
    const tasks = await discoverTestTasks()
    const readiness = tasks.find(task => task.id === 'ai-metrics-readiness')

    expect(readiness).toEqual({
        id: 'ai-metrics-readiness',
        title: 'AI metrics readiness contract',
        command: [process.execPath, 'scripts/smoke-ai-metrics-readiness.ts'],
    })
    expect(parseSelectedTaskIds(['--only=ai-metrics-readiness,notes', '--other=value']))
        .toEqual(new Set(['ai-metrics-readiness', 'notes']))
})

test('unit suites stay in the safe default runner while database suites remain opt-in', () => {
    expect(classifyUnitTest('analyze-cdn-refresh-ingest.test.ts')).toEqual({
        requiresDatabase: false,
        requiresPostgresFilterPort: false,
    })
    expect(isTaskEnabledByDefault(undefined, {})).toBe(true)
    expect(isTaskEnabledByDefault('database', {})).toBe(false)
    expect(isTaskEnabledByDefault('database', { RUN_DB_TESTS: '1' })).toBe(true)
    expect(classifyUnitTest('account-deletion-postgres.test.ts')).toEqual({
        requiresDatabase: true,
        requiresPostgresFilterPort: false,
    })
    expect(classifyUnitTest('account-deletion-purge-postgres.test.ts')).toEqual({
        requiresDatabase: true,
        requiresPostgresFilterPort: true,
    })
    expect(classifyUnitTest('log-phrase-search-postgres.test.ts')).toEqual({
        requiresDatabase: true,
        requiresPostgresFilterPort: false,
    })
})

test('default runner notice names all excluded database suites and explains PostgreSQL setup', () => {
    const tasks = [
        { id: 'account-deletion-postgres', requiresDatabase: true },
        ...postgresFilterTestIds.map(id => ({ id, requiresDatabase: true, requiresPostgresFilterPort: true })),
    ]
    const notice = getDatabaseRunNotice(tasks, false)

    expect(notice).toContain('Excluded database-required suites (16; not run in this default run)')
    expect(notice).toContain('Set RUN_DB_TESTS=1 to include database-required suites.')
    expect(notice).toContain('also require POSTGRES_FILTER_TEST_PORT to point to a disposable local PostgreSQL instance with a postgres_filter_test database')
    expect(notice).toContain('run bun run test:postgres-filter for that group')
    for (const id of postgresFilterTestIds) expect(notice).toContain(id)
    expect(notice).toContain('account-deletion-postgres')
    expect(getDatabaseRunNotice(tasks, true)).toBeNull()
    expect(getDatabaseRunNotice([{ id: 'unit-test' }], false)).toBeNull()
})

test('package script selects exactly the canonical PostgreSQL-filter suite IDs', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(packageJson.scripts['test:postgres-filter']).toBe(
        `RUN_DB_TESTS=1 bun scripts/index.ts --only=${postgresFilterTestIds.join(',')}`,
    )
})

test('phrase-search PostgreSQL coverage has a narrow opt-in runner command without DB defaults', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(packageJson.scripts['test:log-phrase-search-postgres']).toBe(
        'RUN_DB_TESTS=1 LOG_PIPELINE_TEST_DATABASE=1 bun scripts/index.ts --only=log-phrase-search-postgres',
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
