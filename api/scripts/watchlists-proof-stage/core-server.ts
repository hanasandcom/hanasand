import Fastify from 'fastify'

const prefix = process.env.WATCHLIST_STAGE_PREFIX || ''
if (!/^ti-native-proof-[a-f0-9]{12}$/.test(prefix)
    || process.env.WATCHLIST_PROOF_STAGE !== 'synthetic-only'
    || process.env.DB_HOST !== `${prefix}-db` || process.env.DB !== 'core_watchlist_proof_test'
    || process.env.HANASAND_IDENTITY_FDW_HOST !== `${prefix}-db`
    || process.env.IDENTITY_DB_NAME !== 'ti_native_proof_test' || process.env.DB_USER !== 'synthetic'
    || process.env.API_HTTP_ONLY !== '1') throw Error('Requires isolated three-database Core proof stage')
const { default: rateLimit } = await import('../../src/plugins/rateLimit.ts')
const { getOrganizationWatchlists } = await import('../../src/handlers/organizations/watchlists/read.ts')
const { postOrganizationWatchlist } = await import('../../src/handlers/organizations/watchlists/create.ts')
const { putOrganizationWatchlist } = await import('../../src/handlers/organizations/watchlists/update.ts')
const { postOrganizationWatchlistAction } = await import('../../src/handlers/organizations/watchlists/action.ts')
const { deleteOrganizationWatchlist } = await import('../../src/handlers/organizations/watchlists/archive.ts')
const { postOrganizationWatchlistCleanup } = await import('../../src/handlers/organizations/watchlists/cleanup.ts')
const { postOrganizationWatchlistReconcile } = await import('../../src/handlers/organizations/watchlists/reconcile.ts')
const app = Fastify({ logger: true, trustProxy: ['127.0.0.1', '::1'] })
await app.register(rateLimit)
await app.register(async api => {
    api.get('/organizations/:id/watchlists', getOrganizationWatchlists)
    api.post('/organizations/:id/watchlists', postOrganizationWatchlist)
    api.put('/organizations/:organizationId/watchlists/:itemId', putOrganizationWatchlist)
    api.post('/organizations/:organizationId/watchlists/:itemId/actions', postOrganizationWatchlistAction)
    api.delete('/organizations/:organizationId/watchlists/:itemId', deleteOrganizationWatchlist)
    api.post('/organizations/:id/watchlists/cleanup', postOrganizationWatchlistCleanup)
    api.post('/organizations/:id/watchlists/reconcile', postOrganizationWatchlistReconcile)
}, { prefix: '/api' })
app.get('/ready', async () => ({ ok: true, source: process.env.WATCHLIST_CORE_SHA, runtime: process.versions.bun }))
app.get('/api/health', async () => ({ ok: true, release: process.env.WATCHLIST_CORE_SHA, stage: true }))
await app.listen({ host: '0.0.0.0', port: 8082 })
