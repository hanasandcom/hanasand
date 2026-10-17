import assert from 'node:assert/strict'
import { resetDatabase } from './commercialApiLifecycle/database.ts'
import { seedLifecycleFixtures } from './commercialApiLifecycle/fixtures.ts'
import { verifyRateLimitCleanup } from './commercialApiLifecycle/rateLimitCleanup.ts'
import { verifyRateLimitLifecycle } from './commercialApiLifecycle/rateLimitLifecycle.ts'
import { verifyOrganizationConcurrency } from './commercialApiLifecycle/organizationConcurrency.ts'
import { verifyAccountDeletion } from './commercialApiLifecycle/accountDeletion.ts'
import { commercialApp } from './commercialApiLifecycle/helpers.ts'

assert.equal(process.env.DB, 'hanasand_commercial_api_test', 'Refusing to run outside the disposable commercial API test database.')

await resetDatabase()
const { organizationKey, legacyUnboundKey } = await seedLifecycleFixtures()
await verifyRateLimitCleanup()
const app = await verifyRateLimitLifecycle(await commercialApp(), organizationKey)
await verifyOrganizationConcurrency(app)
await verifyAccountDeletion(app, organizationKey, legacyUnboundKey)
console.log('Commercial API PostgreSQL lifecycle smoke passed.')
