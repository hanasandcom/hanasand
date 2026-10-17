import assert from 'node:assert/strict'
import { queryOnce } from '../src/utils/db.ts'
import { listUnifiedScheduledJobs, updateManagedCronJob } from '../src/utils/systemCron.ts'
import { assertLiveRegistry, assertOfflineRegistry } from './smoke-scheduled-job-registry/assertions.ts'
import { createTiMockFetch, type ControlRequest } from './smoke-scheduled-job-registry/fixtures.ts'

const previousTiBase = process.env.TI_SCRAPER_API_BASE
const previousBackupEnabled = process.env.DB_BACKUP_ENABLED
const previousBackupUrl = process.env.DB_BACKUP_WORKER_URL
const previousBackupToken = process.env.DB_BACKUP_WORKER_TOKEN
const originalFetch = globalThis.fetch
const backupWorkerUrl = 'https://backup.test/worker'
const tiMockBase = 'https://ti.test'
const controlRequests: ControlRequest[] = []
const now = '2026-07-03T10:00:00.000Z'
const tiMock: { fetch?: (request: Request) => Promise<Response> | Response } = {}
delete process.env.TI_SCRAPER_API_BASE
process.env.DB_BACKUP_ENABLED = 'false'
process.env.DB_BACKUP_WORKER_URL = backupWorkerUrl
process.env.DB_BACKUP_WORKER_TOKEN = 'test-token'
globalThis.fetch = (async(input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === backupWorkerUrl) {
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token')
        assert.deepEqual(JSON.parse(String(init?.body)), { method: 'status', args: [] })
        return Response.json({ value: [{
            scheduleEnabled: false,
            schedule: '23 2 * * *',
            operations: [],
            currentOperation: null,
            nextBackup: null,
            lastError: null,
            error: null,
        }] })
    }
    if (tiMock.fetch && String(input).startsWith(`${tiMockBase}/`)) return tiMock.fetch(new Request(input, init))
    return originalFetch(input, init)
}) as typeof fetch

const jobs = await listUnifiedScheduledJobs()
restoreTiBase()
if (previousBackupEnabled === undefined) delete process.env.DB_BACKUP_ENABLED
else process.env.DB_BACKUP_ENABLED = previousBackupEnabled

assertOfflineRegistry(jobs)

tiMock.fetch = createTiMockFetch(now, controlRequests)

process.env.TI_SCRAPER_API_BASE = tiMockBase
try {
    const liveJobs = await listUnifiedScheduledJobs()

    assertLiveRegistry(liveJobs)

    const controlDbAvailable = await scheduledJobControlsAvailable()
    if (controlDbAvailable) {
        try {
            let apiJob = await updateManagedCronJob('api-agent-automations', { enabled: false })
            assert.equal(apiJob.status, 'paused')
            assert.ok(apiJob.controls.includes('resume'), 'Paused API cron should expose resume control.')
            apiJob = await updateManagedCronJob('api-agent-automations', { enabled: true })
            assert.ok(apiJob.controls.includes('pause'), 'Resumed API cron should expose pause control.')
        } finally {
            await updateManagedCronJob('api-agent-automations', { enabled: true }).catch(() => undefined)
        }
        const apiJob = await updateManagedCronJob('api-agent-automations', { action: 'run_now' })
        assert.ok(apiJob.controls.includes('run_now'), 'Manual API cron run should stay available after triggering.')
    }

    await updateManagedCronJob('ti-public-canary-collection', { enabled: false })
    await updateManagedCronJob('ti-public-canary-collection', { enabled: true })
    await updateManagedCronJob('ti-public-canary-collection', { action: 'run_now' })
    await updateManagedCronJob('ti-dwm-alert-generation', { action: 'run_now' })
    await updateManagedCronJob('ti-source-pack-worker', { action: 'run_now' })

    assert.deepEqual(controlRequests.map(request => [request.path, request.body.action]), [
        ['/v1/ops/collection-scheduler', 'pause'],
        ['/v1/ops/collection-scheduler', 'resume'],
        ['/v1/ops/collection-scheduler', 'run_now'],
        ['/v1/dwm/alerts/rebuild', undefined],
        ['/v1/dwm/source-requests', 'pack_worker_run'],
    ])
} finally {
    restoreTiBase()
    globalThis.fetch = originalFetch
    restoreEnvironment('DB_BACKUP_ENABLED', previousBackupEnabled)
    restoreEnvironment('DB_BACKUP_WORKER_URL', previousBackupUrl)
    restoreEnvironment('DB_BACKUP_WORKER_TOKEN', previousBackupToken)
}

console.log(`Scheduled job registry smoke passed with ${jobs.length} offline jobs and live TI scraper mapping.`)

async function scheduledJobControlsAvailable() {
    try {
        const result = await queryOnce('SELECT to_regclass($1) AS table_name', ['scheduled_job_controls'])
        return result.rows[0]?.table_name === 'scheduled_job_controls'
    } catch {
        return false
    }
}

function restoreTiBase() {
    restoreEnvironment('TI_SCRAPER_API_BASE', previousTiBase)
}

function restoreEnvironment(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
