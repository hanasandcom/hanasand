// Opt-in integration check: all fixtures use temporary tables and roll back.
// LOG_PIPELINE_TEST_DATABASE=1 DB=logs_test DB_HOST=127.0.0.1 DB_PORT=8503 bun tests/log-pipeline-postgres.ts
// Keep the repository layout; containers mounting api at /app also need scripts at /scripts:ro.
import { installEnsureSchemaTables } from './support/ensureSchemaTables.ts'
import { createServiceLogsFixture } from './support/serviceLogsFixture.ts'
import { runLogPipelineCatchupProgressChecks } from './logPipelineCatchupProgressPostgres.ts'
import { runLogPipelineDetectionChecks } from './logPipelineDetectionsPostgres.ts'
import { runLogPipelineProjectionChecks } from './logPipelineProjectionPostgres.ts'
import { runLogPipelineQueueChecks } from './logPipelineQueuePostgres.ts'
import { runLogPipelineSchedulingChecks } from './logPipelineSchedulingPostgres.ts'
import { runLogPipelineStandbyPermissionChecks } from './logPipelineStandbyPermissionsPostgres.ts'
import { mock } from 'bun:test'
import pg from 'pg'
import { requireLogPipelineTestDatabase } from './helpers/logPipelineTestDatabase.ts'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

requireLogPipelineTestDatabase()
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD })
await client.connect()
await client.query('BEGIN')
let queryObserver: ((sql: string, values: unknown[]) => Promise<void>) | undefined
let transactionId = 0
let atomicTransactions = false
const query = async (sql: string, values: unknown[] = []) => {
    await queryObserver?.(sql, values)
    return client.query(sql, values)
}
mock.module('#db', () => ({
    default: query,
    queryOnce: query,
    withTransaction: async (work: (run: typeof query) => Promise<unknown>) => {
        if (!atomicTransactions) return work(query)
        const name = `batch_${++transactionId}`
        await client.query(`SAVEPOINT ${name}`)
        try {
            const result = await work(query)
            await client.query(`RELEASE SAVEPOINT ${name}`)
            return result
        } catch (error) {
            await client.query(`ROLLBACK TO SAVEPOINT ${name}`)
            await client.query(`RELEASE SAVEPOINT ${name}`)
            throw error
        }
    },
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
}))

try {
    await query('CREATE TEMP TABLE organizations (id text PRIMARY KEY, status text, audit_safe_metadata jsonb DEFAULT \'{}\', name text, created_at timestamptz DEFAULT NOW())')
    await query('CREATE TEMP TABLE users (id text PRIMARY KEY)')
    await query('INSERT INTO organizations (id, status, name) VALUES (\'fixture\', \'active\', \'Hanasand\'), (\'other\', \'active\', \'Other\')')
    await createServiceLogsFixture(query, true)
    await installEnsureSchemaTables(import.meta.url, query, ['events', 'findings', 'rules', 'login_events', 'traffic_events', 'system_events'], { temporary: true })
    await query('ALTER TABLE service_logs ADD COLUMN source_event_id text UNIQUE')
    await query('ALTER TABLE events ADD COLUMN log_key text UNIQUE')
    await query('ALTER TABLE findings ADD COLUMN case_id text')
    await query('ALTER TABLE findings ADD COLUMN case_delivery_attempted_at timestamptz')
    await query(`INSERT INTO events (id, ingestion_id, organization_id, event_timestamp, normalized)
        VALUES ('legacy-a', 'logs', 'fixture', NOW(), '{"severity":"low","service":"legacy","log_type":"ApplicationLogs"}'),
            ('legacy-z', 'logs', 'fixture', NOW()-INTERVAL '25 hours', '{"severity":"high","service":null}')`)
    const { logDimensionsSchema } = await import('../src/utils/db/logDimensionsSchema.ts')
    for (const statement of logDimensionsSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    const { logCountsSchema } = await import('../src/utils/db/logCountsSchema.ts')
    for (const statement of logCountsSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))

    const dimensions = await import('../src/utils/logs/dimensions.ts')
    const processing = await import('../src/utils/events/processLogs.ts')
    const eventHandlers = await import('../src/handlers/events.ts')
    const { securityRules } = await import('../src/utils/events/securityRules.ts')
    const { compileLogQuery } = await import('../src/utils/logs/kql.ts')
    const { logCatchupSchema } = await import('../src/utils/db/logCatchupSchema.ts')
    const { logProcessQueueSchema, processLogIndex } = await import('../src/utils/db/logProcessQueueSchema.ts')
    const rules = eventHandlers.BUILTIN_RULES.map(rule => ({
        ...rule,
        enabled: true,
        source: 'hanasand' as const,
        definition: eventHandlers.defaultRuleDefinition(rule.id),
    }))
    const time = Date.now() - 60_000
    const rows = securityRules.flatMap((rule, index) => [true, false].map(positive => {
        const command = positive ? rule.positive : rule.negative
        return {
            id: `${rule.id}-${positive}`,
            service: 'audit',
            host: 'fixture-host',
            level: 'info',
            message: command,
            created_at: new Date(time + index * 10).toISOString(),
            metadata: { process: { executable: rule.field === 'executable' ? command : '/bin/bash', command_line: command } },
        }
    }))
    const context: LogPipelinePostgresContext = {
        query,
        client,
        get queryObserver() { return queryObserver },
        set queryObserver(observer) { queryObserver = observer },
        get atomicTransactions() { return atomicTransactions },
        set atomicTransactions(enabled) { atomicTransactions = enabled },
        processLogBatch: processing.processLogBatch,
        processStoredLogs: processing.processStoredLogs,
        rules,
        rows,
        time,
        BUILTIN_RULES: eventHandlers.BUILTIN_RULES,
        defaultRuleDefinition: eventHandlers.defaultRuleDefinition,
        createFindings: eventHandlers.createFindings,
        normalizeEvent: eventHandlers.normalizeEvent,
        loadConfiguredRules: eventHandlers.loadConfiguredRules,
        securityRules,
        compileLogQuery,
        backfillLogDimensions: dimensions.backfillLogDimensions,
        dimensionLogWhere: dimensions.dimensionLogWhere,
        foldLogCounts: dimensions.foldLogCounts,
        logCatchupSchema,
        logProcessQueueSchema,
        processLogIndex,
        installEnsureSchemaTables,
    }

    await runLogPipelineDetectionChecks(context)
    const queueFixtures = await runLogPipelineQueueChecks(context)
    await runLogPipelineSchedulingChecks(context, queueFixtures)
    await runLogPipelineProjectionChecks(context)
    await runLogPipelineStandbyPermissionChecks(context)
    await runLogPipelineCatchupProgressChecks(context)
} finally {
    await client.query('ROLLBACK')
    await client.end()
}
