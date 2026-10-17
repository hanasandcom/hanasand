import { createRateLimitSmokeContext } from './smoke-rate-limits-fixture.mjs'
import { runRateLimitSmoke } from './smoke-rate-limits-flow.mjs'

if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const context = createRateLimitSmokeContext()
runRateLimitSmoke(context)
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await context.cleanup()
        await context.pool.end()
    })
