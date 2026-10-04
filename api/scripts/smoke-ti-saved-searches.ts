import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [handler, routes, schema] = await Promise.all([
    readFile(new URL('../src/handlers/ti/savedSearches.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes.ts', import.meta.url), 'utf8'),
])

assert.match(handler, /tokenWrapper/)
assert.match(routes, /fastify\.get\('\/ti\/saved-searches'/)
assert.match(routes, /fastify\.post\('\/ti\/saved-searches'/)
assert.match(routes, /fastify\.delete\('\/ti\/saved-searches'/)
assert.match(handler, /\/v1\/internal\/saved-searches/)
assert.match(handler, /x-hanasand-service-token/)
assert.match(handler, /TI_SCRAPER_API_BASE/)
assert.doesNotMatch(handler, /\b(?:queryOnce|CREATE TABLE|ON CONFLICT)\b/)

console.log(JSON.stringify({ ok: true, checked: ['authenticated_saved_search_routes', 'service_token_proxy', 'no_core_database_storage'] }, null, 2))
