import { createAuditRuntime } from './audit-hanasand-api/runtime.mjs'
import { runAccountAndContentChecks } from './audit-hanasand-api/account-and-content-checks.mjs'
import { runVmChecks } from './audit-hanasand-api/vm-checks.mjs'
import { printAuditResults } from './audit-hanasand-api/report.mjs'

if (!process.env.DB_PASSWORD) {
    console.error('DB_PASSWORD is required.')
    process.exit(1)
}

const runtime = createAuditRuntime()

async function main() {
    await runtime.cleanup()
    await runAccountAndContentChecks(runtime)
    await runVmChecks(runtime)
    await runtime.request('GET /metrics', '/metrics', {
        headers: runtime.authHeaders(),
        expect: body => runtime.expectObject(body),
    })
    await runtime.request('GET /docker', '/docker', {
        headers: runtime.authHeaders(),
        expect: body => runtime.expectObject(body),
    })
    printAuditResults(runtime.results)
    await runtime.cleanup()
}

main()
    .catch(error => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await runtime.pool.end()
    })
