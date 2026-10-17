import type { Client, QueryResult } from 'pg'

type ProcessLogBatch = typeof import('../src/utils/events/processLogs.ts').processLogBatch
type Rules = Parameters<ProcessLogBatch>[2]

export type LogPipelinePostgresContext = {
    query: (sql: string, values?: unknown[]) => Promise<QueryResult<any>>
    client: Client
    queryObserver: ((sql: string, values: unknown[]) => Promise<void>) | undefined
    atomicTransactions: boolean
    processLogBatch: ProcessLogBatch
    processStoredLogs: typeof import('../src/utils/events/processLogs.ts').processStoredLogs
    rules: Rules
    rows: Parameters<ProcessLogBatch>[0]
    time: number
    BUILTIN_RULES: typeof import('../src/handlers/events.ts').BUILTIN_RULES
    defaultRuleDefinition: typeof import('../src/handlers/events.ts').defaultRuleDefinition
    createFindings: typeof import('../src/handlers/events.ts').createFindings
    normalizeEvent: typeof import('../src/handlers/events.ts').normalizeEvent
    loadConfiguredRules: typeof import('../src/handlers/events.ts').loadConfiguredRules
    securityRules: typeof import('../src/utils/events/securityRules.ts').securityRules
    compileLogQuery: typeof import('../src/utils/logs/kql.ts').compileLogQuery
    backfillLogDimensions: typeof import('../src/utils/logs/dimensions.ts').backfillLogDimensions
    dimensionLogWhere: typeof import('../src/utils/logs/dimensions.ts').dimensionLogWhere
    foldLogCounts: typeof import('../src/utils/logs/dimensions.ts').foldLogCounts
    logCatchupSchema: typeof import('../src/utils/db/logCatchupSchema.ts').logCatchupSchema
    logProcessQueueSchema: typeof import('../src/utils/db/logProcessQueueSchema.ts').logProcessQueueSchema
    processLogIndex: typeof import('../src/utils/db/logProcessQueueSchema.ts').processLogIndex
    installEnsureSchemaTables: typeof import('./support/ensureSchemaTables.ts').installEnsureSchemaTables
}
