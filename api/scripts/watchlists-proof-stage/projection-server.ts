const prefix = process.env.WATCHLIST_STAGE_PREFIX || ''
if (!/^ti-native-proof-[a-f0-9]{12}$/.test(prefix) || process.env.WATCHLIST_PROOF_STAGE !== 'synthetic-only'
    || process.env.PGHOST !== `${prefix}-db` || process.env.PGDATABASE !== 'ti_watchlist_projection_test'
    || process.env.IDENTITY_API_BASE !== `http://${prefix}-identity:8081/api`) throw Error('Requires isolated projection stage')
const sourceRoot = '/scraper/src'
const bunModule = 'bun'
const { SQL } = await import(bunModule)
const { PostgresScraperStore } = await import(`${sourceRoot}/storage/postgresScraperStore.ts`)
const { startApiServer } = await import(`${sourceRoot}/api/server.ts`)
const sql = new SQL({ hostname: process.env.PGHOST, port: 5432, database: process.env.PGDATABASE,
    username: 'synthetic', password: 'synthetic-local-only', prepare: false })
const store = new PostgresScraperStore(sql, [])
const server = startApiServer({ port: 8097, readinessPort: 8098, store, serviceToken: 'synthetic-projection-service' })
process.on('SIGTERM', async () => { await server.stop(); await store.close(); process.exit(0) })

export {}
