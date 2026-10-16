const databaseTestFiles = new Set([
    'support-chat.test.ts',
    'support-store.test.ts',
    'signup-verification-postgres.test.ts',
    'schema-lock-timeout-postgres.test.ts',
    'automation-history.test.mjs',
    'monitoring-issues-postgres.test.ts',
    'monitoring-correlation-postgres.test.ts',
    'monitoring-message-history-postgres.test.ts',
    'monitoring-case-workflow-postgres.test.ts',
    'monitoring-vm-access-postgres.test.ts',
    'account-deletion-postgres.test.ts',
    'case-development-postgres.test.ts',
    'personal-automations-postgres.test.ts',
])

const postgresFilterTestFiles = [
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
const postgresFilterTestFileSet = new Set(postgresFilterTestFiles)
export const postgresFilterTestIds = postgresFilterTestFiles.map(file => file.replace(/\.test\.(ts|mjs)$/, ''))

export function classifyUnitTest(file: string) {
    const requiresPostgresFilterPort = postgresFilterTestFileSet.has(file)
    return {
        requiresDatabase: databaseTestFiles.has(file) || requiresPostgresFilterPort,
        requiresPostgresFilterPort,
    }
}

export function isTaskEnabledByDefault(
    requires: 'server' | 'database' | 'network' | 'playwright' | undefined,
    environment: Record<string, string | undefined>,
) {
    if (requires === 'database') return environment.RUN_DB_TESTS === '1'
    if (requires === 'server') return environment.RUN_SERVER_TESTS === '1'
    if (requires === 'network') return environment.RUN_NETWORK_TESTS === '1'
    if (requires === 'playwright') return environment.RUN_E2E === '1' || environment.RUN_PLAYWRIGHT === '1'
    return true
}

export type PostgresFilterTask = {
    id: string
    requiresPostgresFilterPort?: boolean
}

export function getPostgresFilterRunNotice(tasks: readonly PostgresFilterTask[], databaseModeEnabled: boolean) {
    const filterTasks = tasks.filter(task => task.requiresPostgresFilterPort)
    if (databaseModeEnabled || filterTasks.length === 0) return null

    return [
        `Excluded PostgreSQL-filter suites (${filterTasks.length}; not run in this default run): ${filterTasks.map(task => task.id).join(', ')}.`,
        'Set POSTGRES_FILTER_TEST_PORT to the port of a disposable local PostgreSQL instance with a postgres_filter_test database, then run bun run test:postgres-filter (the script sets RUN_DB_TESTS=1).',
    ].join('\n')
}

export function getPostgresFilterPortError(tasks: readonly PostgresFilterTask[], port: string | undefined) {
    const selectedFilterTasks = tasks.filter(task => task.requiresPostgresFilterPort)
    if (selectedFilterTasks.length === 0 || isValidPostgresPort(port)) return null

    return [
        `PostgreSQL-filter test task${selectedFilterTasks.length === 1 ? '' : 's'} selected: ${selectedFilterTasks.map(task => task.id).join(', ')}.`,
        'Set POSTGRES_FILTER_TEST_PORT to the port (1024-65535) of a disposable local PostgreSQL instance with a postgres_filter_test database.',
        'This preflight validates the port value only; it does not connect to PostgreSQL.',
    ].join('\n')
}

function isValidPostgresPort(port: string | undefined) {
    if (!port || !/^\d+$/.test(port)) return false
    const value = Number(port)
    return Number.isInteger(value) && value >= 1024 && value <= 65535
}
