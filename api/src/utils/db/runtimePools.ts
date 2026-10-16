import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import config from '#constants'

export type SQLParamType = (string | number | null | boolean | string[] | Date)[]

const {
    DB,
    DB_USER,
    DB_HOST,
    DB_POOL_HOST,
    DB_POOL_PORT,
    DB_PASSWORD,
    DB_PORT,
    DB_MAX_CONN,
    DB_IDLE_TIMEOUT_MS,
    DB_TIMEOUT_MS
} = config

const { Pool } = pg

export const schemaWork = new AsyncLocalStorage<boolean>()

// A queued schema lock also blocks later reads, including authentication.
// Fail fast so a busy migration cannot queue site requests behind it.
export const schemaLockTimeout = '100ms'

export function withSchemaLockTimeout<T>(work: () => Promise<T>): Promise<T> {
    return schemaWork.run(true, work)
}

export const eventWork = new AsyncLocalStorage<boolean>()

export const priorityEventWork = new AsyncLocalStorage<boolean>()

export const readWork = new AsyncLocalStorage<boolean>()

const maxConnections = Number(DB_MAX_CONN) || (DB_POOL_HOST ? 1000 : 20)

// Bound the number of requests waiting inside node-postgres. Without this,
// bursts can turn into an unbounded in-process queue while the database is slow.
export const maxWaitingConnections = Math.max(8, Math.min(64, maxConnections * 2))

// Schema setup and session-scoped advisory locks bypass transaction pooling.
// Reserve those clients inside the configured total instead of adding a second budget.
const directConnections = DB_POOL_HOST ? Math.min(8, maxConnections) : 0

const dedicatedLogProcessor = process.env.LOG_PROCESSOR_ONLY === '1'

const httpOnlyApi = process.env.API_HTTP_ONLY === '1' && process.env.AUTH_SERVICE_ONLY !== '1'

const primaryReserve = dedicatedLogProcessor ? Math.min(4, Math.max(0, maxConnections - directConnections)) : 0

// Keep a small pool available for new logs while the durable history pass is busy.
const priorityEventConnections = dedicatedLogProcessor
    ? Math.min(4, Math.max(0, maxConnections - directConnections - primaryReserve))
    : 0

// The dedicated log worker does not serve API reads; reserve its pool budget
// for independent event writes instead of creating an unused read pool.
const readConnections = dedicatedLogProcessor
    ? 0
    : process.env.AUTH_SERVICE_ONLY !== '1' && maxConnections >= 16
        ? Math.min(10, Math.max(2, Math.floor(maxConnections / 10))) : 0

// Reserve worker capacity without increasing its total connection budget.
// Event holds cursor and batch locks while committing evidence on another client.
const eventConnections = process.env.LOG_PROCESSOR_ONLY === '1'
    ? Math.min(36, Math.max(0, maxConnections - directConnections - readConnections - priorityEventConnections - primaryReserve))
    : process.env.API_HTTP_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1'
        && maxConnections >= 12 ? 8 : 0

const primaryConnections = Math.max(0, maxConnections - eventConnections - priorityEventConnections - readConnections - directConnections)

const warmupBudget = Math.max(0, Math.min(maxConnections, Math.floor(Number(process.env.DB_POOL_WARMUP_CONN) || 0)))

const httpReadWarmup = httpOnlyApi ? Math.min(readConnections, warmupBudget) : 0

const primaryWarmup = Math.min(primaryConnections, Math.max(0, warmupBudget - httpReadWarmup))

const priorityEventWarmup = Math.min(priorityEventConnections, Math.max(0, warmupBudget - primaryWarmup))

const eventWarmup = Math.min(eventConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup))

const readWarmup = Math.max(httpReadWarmup, Math.min(readConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup - eventWarmup)))

const directWarmup = Math.min(directConnections, Math.max(0, warmupBudget - primaryWarmup - priorityEventWarmup - eventWarmup - readWarmup))

const configuredIdleTimeout = Number(DB_IDLE_TIMEOUT_MS) || (
    process.env.AUTH_SERVICE_ONLY === '1' ? 5000 : 120_000
)

const poolOptions = {
    user: DB_USER || 'hanasand',
    host: DB_POOL_HOST || DB_HOST,
    database: DB || 'hanasand',
    password: DB_PASSWORD,
    port: Number(DB_POOL_PORT) || Number(DB_PORT) || 5432,
    application_name: process.env.AUTH_SERVICE_ONLY === '1'
        ? 'hanasand-auth'
        : httpOnlyApi ? 'hanasand-api-http' : 'hanasand-api',
    max: primaryConnections,
    // Keep warmed client sessions available so bursts reuse SCRAM-authenticated
    // connections instead of paying the handshake cost on request paths.
    min: primaryWarmup,
    idleTimeoutMillis: httpOnlyApi
        ? Math.min(Math.max(configuredIdleTimeout, 1), 15_000)
        : configuredIdleTimeout,
    // Rotate sessions even under steady traffic so old HAProxy workers can drain.
    maxLifetimeSeconds: httpOnlyApi ? 45 : undefined,
    connectionTimeoutMillis: Number(DB_TIMEOUT_MS) || 3000,
    statement_timeout: (process.env.AUTH_SERVICE_ONLY === '1' || process.env.API_HTTP_ONLY === '1') ? 5000 : undefined,
    keepAlive: true
}

export const pool = new Pool(poolOptions)

export const eventPool = eventConnections ? new Pool({ ...poolOptions, max: eventConnections, min: eventWarmup }) : pool

export const priorityEventPool = priorityEventConnections ? new Pool({ ...poolOptions, application_name: 'hanasand-log-priority', max: priorityEventConnections, min: priorityEventWarmup }) : pool

export const readPool = readConnections ? new Pool({ ...poolOptions, application_name: `${poolOptions.application_name}-read`, max: readConnections, min: readWarmup }) : pool

// Schema startup uses session-scoped SET/RESET and CREATE INDEX CONCURRENTLY.
// Keep that small, infrequent path on PostgreSQL directly when traffic uses PgBouncer.
export const directPool = DB_POOL_HOST ? new Pool({ ...poolOptions, host: DB_HOST, port: Number(DB_PORT) || 5432, max: directConnections, min: directWarmup }) : pool

// SSH key data belongs to Identity. Query its PostgreSQL directly instead of
// sending interactive profile reads through the application DB's FDW views.
const identityHost = process.env.HANASAND_IDENTITY_FDW_HOST

export const identityPool = identityHost ? new Pool({
    ...poolOptions,
    host: identityHost,
    port: Number(process.env.HANASAND_IDENTITY_FDW_PORT) || 5432,
    database: process.env.IDENTITY_DB_NAME || 'identity',
    application_name: 'hanasand-api-identity-data',
    max: Math.max(1, Math.min(4, Number(process.env.IDENTITY_DB_MAX_CONN) || 4)),
    min: 1,
    statement_timeout: 5000,
}) : null

export {
    DB_POOL_HOST,
    primaryWarmup,
    eventWarmup,
    priorityEventWarmup,
    readWarmup,
    directWarmup,
    readConnections,
    primaryConnections,
}
