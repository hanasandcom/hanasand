import { afterAll, expect, mock, test } from 'bun:test'

const managedCronUrl = 'https://backup.test/worker'
const tiBaseUrl = 'https://ti.test'
const previousEnvironment = {
    DB_BACKUP_WORKER_TOKEN: process.env.DB_BACKUP_WORKER_TOKEN,
    DB_BACKUP_WORKER_URL: process.env.DB_BACKUP_WORKER_URL,
    HANASAND_SCANNER_SERVICE_TOKEN: process.env.HANASAND_SCANNER_SERVICE_TOKEN,
    HANASAND_SCANNER_URL: process.env.HANASAND_SCANNER_URL,
    MAIL_ADMIN_PASSWORD: process.env.MAIL_ADMIN_PASSWORD,
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
    canRunApiCronJobNow: (id: string) => ['api-agent-automations', 'api-cron-health-monitor', 'api-user-account-deletion'].includes(id),
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
    restoreEnvironment('TI_SCRAPER_API_BASE', previousEnvironment.TI_SCRAPER_API_BASE)
})

test('fast snapshots stay provisional while concurrent reads share the active refresh', async () => {
    try {
        process.env.MAIL_ADMIN_PASSWORD = ''
        const fastSnapshot = await listUnifiedScheduledJobs({ fast: true })
        expect(fastSnapshot.find(job => job.id === 'api-user-account-deletion')).toMatchObject({
            status: 'unknown', schedule: 'Every minute', controls: ['run_now'], controlMode: 'run_only',
        })
        expect(fastSnapshot.find(job => job.id === 'api-cron-health-monitor')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.find(job => job.id === 'api-agent-automations')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.find(job => job.id === 'api-vulnerability-scanner')).toMatchObject({ controls: ['run_now'], controlMode: 'run_only' })
        expect(fastSnapshot.some(job => job.id === 'api-mail-account-provisioning')).toBe(false)
        expect(fastSnapshot.find(job => job.id === 'ti-public-canary-collection')?.status).toBe('blocked')
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
