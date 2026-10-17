import './guard-production-smoke.mjs'
import { createSmokeFixture, cleanupSmoke } from './smoke-impersonation-regression/fixture.mjs'
import { createSmokeApi } from './smoke-impersonation-regression/api.mjs'
import { runImpersonationRegression } from './smoke-impersonation-regression/flow.mjs'

if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const context = createSmokeFixture()
const api = createSmokeApi(context)

runImpersonationRegression(context, api)
    .catch((error) => {
        console.error(error.details ?? error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanupSmoke(context)
        await context.pool.end()
    })
