import { createQuotaSmokeFixture, cleanup, seedBase } from './smoke-ai-quotas-fixture.mjs'
import { runDeploymentQuotaScenario } from './smoke-ai-quotas-deployments.mjs'
import { runCollaboratorQuotaScenario } from './smoke-ai-quotas-collaborators.mjs'

const dbPassword = process.env.DB_PASSWORD

if (!dbPassword) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const fixture = createQuotaSmokeFixture(dbPassword)

async function main() {
    await cleanup(fixture)
    await seedBase(fixture)
    const { quota, blocked } = await runDeploymentQuotaScenario(fixture)
    const overSeatLimit = await runCollaboratorQuotaScenario(fixture)

    console.log(JSON.stringify({
        ok: true,
        activeRunning: quota.body.quota.activeRunning,
        maxRunning: quota.body.quota.maxRunning,
        runningRemaining: quota.body.quota.runningRemaining,
        blockedError: blocked.body.error,
        collaboratorSeatLimit: overSeatLimit.body?.quota?.limit,
    }, null, 2))
}

main()
    .catch((error) => {
        console.error(error.details ?? error)
        process.exitCode = 1
    })
    .finally(async () => {
        await cleanup(fixture)
        await fixture.pool.end()
    })
