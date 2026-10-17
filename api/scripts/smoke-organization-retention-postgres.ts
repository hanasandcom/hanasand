import assert from 'node:assert/strict'
import ensureSchema from '../src/utils/db/ensureSchema.ts'
import { setupOrganizationRetentionScenario } from './organization-retention/setup.ts'
import { runRetentionWorkerScenarios } from './organization-retention/workerScenarios.ts'
import { runRetentionApiScenarios } from './organization-retention/apiScenarios.ts'
import { verifyRetentionDeletion } from './organization-retention/deletionVerification.ts'

assert.equal(process.env.DB, 'hanasand_retention_test', 'Refusing to run outside the disposable retention test database.')
await ensureSchema()

const scenario = await setupOrganizationRetentionScenario()
const workerResults = await runRetentionWorkerScenarios(scenario)
const app = await runRetentionApiScenarios({ ...scenario, ...workerResults })
await verifyRetentionDeletion({ ...scenario, ...workerResults, app })
console.log('organization retention PostgreSQL lifecycle smoke: ok')
process.exit(0)
