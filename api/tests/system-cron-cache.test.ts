import { afterAll, expect, mock, test } from 'bun:test'

const managedCronUrl = 'https://backup.test/worker'
const tiBaseUrl = 'https://ti.test'
const previousEnvironment = {
    DB_BACKUP_WORKER_TOKEN: process.env.DB_BACKUP_WORKER_TOKEN,
    DB_BACKUP_WORKER_URL: process.env.DB_BACKUP_WORKER_URL,
    HANASAND_SCANNER_SERVICE_TOKEN: process.env.HANASAND_SCANNER_SERVICE_TOKEN,
    HANASAND_SCANNER_URL: process.env.HANASAND_SCANNER_URL,
    MAIL_ADMIN_PASSWORD: process.env.MAIL_ADMIN_PASSWORD,
    LOG_LIVE_WORKER_DISABLED: process.env.LOG_LIVE_WORKER_DISABLED,
    TI_SCRAPER_API_BASE: process.env.TI_SCRAPER_API_BASE,
}
const originalFetch = globalThis.fetch
let releaseTiRequests!: () => void
const tiRequestsGate = new Promise<void>(resolve => { releaseTiRequests = resolve })
let tiRequestCount = 0
let backupRequestCount = 0

process.env.DB_BACKUP_WORKER_TOKEN = 'test-token'
process.env.DB_BACKUP_WORKER_URL = managedCronUrl
delete process.env.HANASAND_SCANNER_SERVICE_TOKEN
delete process.env.HANASAND_SCANNER_URL
process.env.TI_SCRAPER_API_BASE = tiBaseUrl

mock.module('../src/utils/cron.ts', () => ({
    HOST_UPDATE_MONITOR_JOB_ID: 'api-host-update-monitor',
    canRunApiCronJobNow: (id: string) => id === 'api-mail-account-provisioning'
        ? Boolean(process.env.MAIL_ADMIN_PASSWORD)
        : ['api-agent-automations', 'api-cron-health-monitor', 'api-user-account-deletion'].includes(id),
    isApiCronJobPaused: async () => true,
    runApiCronJobNow: async () => undefined,
    setApiCronJobPaused: async () => undefined,
}))

globalThis.fetch = (async(input: string | URL | Request) => {
    const url = String(input)
    if (url === managedCronUrl) {
        backupRequestCount++
        return Response.json({ value: [{ scheduleEnabled: false, schedule: '23 2 * * *', operations: [] }] })
    }
    if (url.startsWith(tiBaseUrl)) {
        tiRequestCount++
        await tiRequestsGate
        if (url.endsWith('/v1/health')) {
            return Response.json({ collection: { restrictedMetadata: { enabled: true, running: false, lastError: 'Latest cycle failed.' } } })
        }
        if (url.endsWith('/v1/ops/resource-snapshot')) {
            return Response.json({ pressure: {
                automaticReview: { enabled: true, counts: { running: 1 } },
                automaticEvaluation: { enabled: false, running: true },
            } })
        }
        return Response.json({})
    }
    throw new Error(`Unexpected fetch in cron registry test: ${url}`)
}) as typeof fetch

const { listUnifiedScheduledJobs } = await import('../src/utils/systemCron.ts')

afterAll(() => {
    globalThis.fetch = originalFetch
    restoreEnvironment('DB_BACKUP_WORKER_TOKEN', previousEnvironment.DB_BACKUP_WORKER_TOKEN)
    restoreEnvironment('DB_BACKUP_WORKER_URL', previousEnvironment.DB_BACKUP_WORKER_URL)
    restoreEnvironment('HANASAND_SCANNER_SERVICE_TOKEN', previousEnvironment.HANASAND_SCANNER_SERVICE_TOKEN)
    restoreEnvironment('HANASAND_SCANNER_URL', previousEnvironment.HANASAND_SCANNER_URL)
    restoreEnvironment('MAIL_ADMIN_PASSWORD', previousEnvironment.MAIL_ADMIN_PASSWORD)
    restoreEnvironment('LOG_LIVE_WORKER_DISABLED', previousEnvironment.LOG_LIVE_WORKER_DISABLED)
    restoreEnvironment('TI_SCRAPER_API_BASE', previousEnvironment.TI_SCRAPER_API_BASE)
})

test('fast snapshots stay provisional while concurrent reads share the active refresh', async () => {
    try {
        process.env.MAIL_ADMIN_PASSWORD = ''
        process.env.LOG_LIVE_WORKER_DISABLED = '1'
        const fastSnapshot = await listUnifiedScheduledJobs({ fast: true })
        expect(fastSnapshot.find(job => job.id === 'api-user-account-deletion')).toMatchObject({
            status: 'unknown', schedule: 'Every minute', controls: ['run_now'], controlMode: 'run_only',
        })
        expect(fastSnapshot.find(job => job.id === 'api-cron-health-monitor')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.find(job => job.id === 'api-agent-automations')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.find(job => job.id === 'api-vulnerability-scanner')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.find(job => job.id === 'api-live-log-processor')?.enabled).toBe(false)
        delete process.env.LOG_LIVE_WORKER_DISABLED
        expect(fastSnapshot.some(job => job.id === 'api-mail-account-provisioning')).toBe(false)
        expect(fastSnapshot.find(job => job.id === 'ti-public-canary-collection')?.status).toBe('blocked')
        expect((await listUnifiedScheduledJobs({ fast: true })).find(job => job.id === 'api-cron-health-monitor'))
            .toMatchObject({ status: 'unknown', controls: ['run_now'] })
        const requestsDuringRefresh = tiRequestCount
        expect(requestsDuringRefresh).toBeGreaterThan(0)

        const firstRead = listUnifiedScheduledJobs()
        const secondRead = listUnifiedScheduledJobs()
        expect(tiRequestCount).toBe(requestsDuringRefresh)

        process.env.MAIL_ADMIN_PASSWORD = 'configured-for-test'
        releaseTiRequests()
        const [firstJobs, secondJobs] = await Promise.all([firstRead, secondRead])
        expect(firstJobs).toBe(secondJobs)
        expect(firstJobs.some(job => job.id === 'api-mail-account-provisioning')).toBe(true)
        expect(firstJobs.find(job => job.id === 'api-user-account-deletion')).toMatchObject({ controls: ['resume', 'run_now'], controlMode: 'safe_control' })
        expect(firstJobs.find(job => job.id === 'api-cron-health-monitor')).toMatchObject({ controls: ['resume', 'run_now'], controlMode: 'safe_control' })
        expect(firstJobs.find(job => job.id === 'api-agent-automations')).toMatchObject({ controls: ['resume', 'run_now'], controlMode: 'safe_control' })
        expect(firstJobs.find(job => job.id === 'ti-automatic-review')?.status).toBe('running')
        expect(firstJobs.find(job => job.id === 'ti-automatic-evaluation')).toMatchObject({ enabled: false, running: true, status: 'paused' })
        expect(firstJobs.find(job => job.id === 'ti-restricted-metadata-collection')?.status).toBe('failed')
        for (const [id, schedule, cadenceSeconds] of [
            ['api-log-ingest-access-detection', 'Every minute', 60],
            ['api-drop-rate-alert-refresh', 'Every 15 seconds', 15],
            ['api-stored-log-processor', 'Adaptive queue drain; configured catch-up interval and 5-second idle backoff', null],
            ['api-live-log-processor', 'Adaptive queue drain; up to 100-millisecond interval with 100-millisecond idle backoff', null],
            ['api-rule-reprocessor', 'Adaptive queue drain; up to 1-second interval with 5-second idle backoff', null],
        ] as const) {
            expect(firstJobs.find(job => job.id === id)).toMatchObject({
                schedule, cadenceSeconds, enabled: true, controls: [], controlMode: 'observable_only',
            })
        }
        expect(backupRequestCount).toBe(1)
        expect(await listUnifiedScheduledJobs({ fast: true })).toBe(firstJobs)
    } finally {
        releaseTiRequests()
    }
})

function restoreEnvironment(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
