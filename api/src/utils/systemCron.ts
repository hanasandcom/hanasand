import { RAW_LOG_RETENTION_JOB_ID } from './events/rawLogRetention.ts'
import { VM_METRICS_JOB_ID } from './vms/collectMetrics.ts'
import { getBackgroundJobRuntime, type BackgroundJobRuntime } from './backgroundJobRuntime.ts'
import { canRunApiCronJobNow, HOST_UPDATE_MONITOR_JOB_ID, isApiCronJobPaused, runApiCronJobNow, setApiCronJobPaused } from './cron.ts'
import { ORGANIZATION_RETENTION_JOB_ID } from './organizationPrivacy.ts'
import { RULE_STORAGE_ESTIMATE_JOB_ID } from './events/ruleStorageEstimateWorker.ts'
import { ACCOUNT_DELETION_PURGE_JOB_ID } from './auth/purgeDeletedAccounts.ts'
import { LOG_INGEST_ACCESS_DETECTION_JOB_ID } from './events/analyzeIngestAccess.ts'
import { DROP_RATE_ALERT_REFRESH_JOB_ID } from './events/dropRateAlert.ts'
import { LIVE_LOG_PROCESSOR_JOB_ID, RULE_REPROCESSOR_JOB_ID, STORED_LOG_PROCESSOR_JOB_ID } from './events/processor.ts'
import { getVulnerabilityReport, setVulnerabilityScannerPaused, startTrackedVulnerabilityScan, VULNERABILITY_SCAN_CADENCE_SECONDS, VULNERABILITY_SCAN_JOB_ID } from './vulnerabilities/scanner.ts'
import { collectDatabaseBackupServices, createDatabaseBackup, DATABASE_BACKUP_JOB_ID, setDatabaseBackupSchedulePaused } from './db/backups.ts'
import { normalizeSchedule, parseExistingCronEntries, parseManagedBlock, replaceManagedBlock } from './systemCronCrontab.ts'
import { readManagedCronLog, readManagedCrontab, writeManagedCrontab } from './managedCronHost.ts'
import { VM_FAILOVER_JOB_ID } from './vms/failover.ts'
import { ageMs, costEstimate, scheduledJobControlMode, secondsSchedule, unavailableTelemetry } from './systemCron/jobMetrics.ts'
import { tiBase } from './systemCron/tiScraperClient.ts'
import { listTiScheduledJobs } from './systemCron/tiScheduledJobs.ts'
import { tiUnavailableJobs } from './systemCron/tiJobProjection.ts'
export { tiAutomaticReviewJob } from './systemCron/tiCollectionJobProjection.ts'

export type ManagedCronDefinition = {
    id: string
    name: string
    description: string
    defaultSchedule: string
    command: string
    legacyCommands?: string[]
    host: string
    category?: ScheduledJobCategory
    service?: string
    logPath?: string
}

export type ManagedCronJob = ManagedCronDefinition & {
    schedule: string
    enabled: boolean
    installed: boolean
    lastLogLine: string | null
    lastLogAt: string | null
}

export type ManagedCronUpdate = {
    schedule?: unknown
    enabled?: unknown
    action?: unknown
}

export type ScheduledJobCategory = 'TI / Exposure' | 'Alerts' | 'Mail' | 'Backup/Database' | 'Forgejo' | 'Other/System'
export type ScheduledJobControl = 'pause' | 'resume' | 'enable' | 'disable' | 'edit_schedule' | 'run_now'
export type ScheduledJobStatus = 'running' | 'enabled' | 'paused' | 'failed' | 'blocked' | 'observable' | 'unknown'

export type ScheduledJobTelemetry = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    cpuPercent: number | null
    memoryRssMb: number | null
    memoryUsedMb: number | null
    queueDepth: number | null
    note: string
}

export type ScheduledJobCostEstimate = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    electricityUsdPerKwh: number
    powerWatts: number | null
    hourlyUsd: number | null
    dailyUsd: number | null
    assumption: string
}

export type UnifiedScheduledJob = {
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    source: string
    service: string
    schedule: string
    cadenceSeconds: number | null
    enabled: boolean
    running: boolean
    status: ScheduledJobStatus
    installed?: boolean
    command?: string
    host?: string
    logPath?: string
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastFinishedAt: string | null
    nextRunAt: string | null
    currentRunDurationMs: number | null
    averageRuntimeMs: number | null
    failureCount: number
    lastError: string | null
    logExcerpt: string | null
    controls: ScheduledJobControl[]
    controlMode: 'editable' | 'safe_control' | 'run_only' | 'observable_only'
    resourceUsage: ScheduledJobTelemetry
    costEstimate: ScheduledJobCostEstimate
    assumptions: string[]
}

const API_CRON_CADENCE_SECONDS = 60
const UNIFIED_CRON_CACHE_TTL_MS = 5_000

let unifiedCronCache: { jobs: UnifiedScheduledJob[], expiresAt: number } | null = null
let unifiedCronRefresh: Promise<UnifiedScheduledJob[]> | null = null

export const managedCronDefinitions: ManagedCronDefinition[] = [
    {
        id: 'forgejo-standby-sync',
        name: 'Forgejo standby sync',
        description: 'Repairs Forgejo metadata, copies the active Git service to OVH standby, restores the database, and health-checks the standby.',
        defaultSchedule: '*/5 * * * *',
        command: 'LOG=/home/hanasand/git/standby-sync.log /home/hanasand/git/sync-to-ovh.sh',
        legacyCommands: [
            '/home/hanasand/git/sync-to-ovh.sh',
            'cd /home/hanasand/git && LOCK=/tmp/forgejo-standby-sync.lock LOG=/home/hanasand/git/standby-sync.log bash scripts/sync-to-ovh.sh',
        ],
        host: 'inspur',
        logPath: '/home/hanasand/git/standby-sync.log',
    },
    {
        id: 'forgejo-doctor',
        name: 'Forgejo doctor',
        description: 'Runs Forgejo repository metadata checks and fixes repository HEAD, hook, key, and push-option drift.',
        defaultSchedule: '17 * * * *',
        command: 'cd /home/hanasand/git && LOG_FILE=/home/hanasand/git/forgejo-doctor.log FIX=1 bash scripts/forgejo-doctor.sh',
        host: 'inspur',
        logPath: '/home/hanasand/git/forgejo-doctor.log',
    },
    {
        id: 'db-dashboard-monitor',
        name: 'Database dashboard monitor',
        description: 'Logs in to the production dashboard, verifies live database metrics stay non-zero and explicit, and sends Discord alerts on repeated failure.',
        defaultSchedule: '* * * * *',
        command: '/home/hanasand/hanasand/ops/db-dashboard-monitor/run-db-dashboard-monitor.sh',
        legacyCommands: [],
        host: 'hanasand',
        category: 'Backup/Database',
        service: 'database-monitor',
        logPath: '/home/hanasand/hanasand/ops/monitoring-state/db-dashboard-monitor.log',
    },
    {
        id: 'ti-threat-intel-backup',
        name: 'Threat intelligence backup',
        description: 'Creates and verifies a daily threat-intelligence database and evidence backup, runs a weekly restore drill, and retains 14 days.',
        defaultSchedule: '23 2 * * *',
        command: '/home/hanasand/ti/ops/threat-intel-backup/run-threat-intel-backup.sh >> /home/hanasand/hanasand/ops/monitoring-state/threat-intel-backup.log 2>&1',
        legacyCommands: [],
        host: 'hanasand',
        category: 'Backup/Database',
        service: 'ti-scraper',
        logPath: '/home/hanasand/hanasand/ops/monitoring-state/threat-intel-backup.log',
    },
    {
        id: 'ti-operational-workflow-canary',
        name: 'Threat intelligence workflow canary',
        description: 'Exercises organization, watchlist, evidence alert, and webhook delivery through an explicitly classified operational canary.',
        defaultSchedule: '41 3 * * *',
        command: '/home/hanasand/ti/ops/threat-intel-workflow-canary/run-threat-intel-workflow-canary.sh >> /home/hanasand/hanasand/ops/monitoring-state/threat-intel-workflow-canary.log 2>&1',
        legacyCommands: [],
        host: 'hanasand',
        category: 'TI / Exposure',
        service: 'ti-scraper',
        logPath: '/home/hanasand/hanasand/ops/monitoring-state/threat-intel-workflow-canary.log',
    },
]

export function scheduledJobRegistryGuardrailEntries() {
    return [
        ...managedCronDefinitions.map(job => ({ id: job.id, source: 'api/src/utils/systemCron.ts' })),
        ...apiBackgroundJobDefinitions.map(job => ({ id: job.id, source: job.source })),
        { id: 'deployment-compose-schedules', source: 'docker-compose.yml' },
        { id: 'ti-public-canary-collection', source: 'scraper/src/ops/canaryCollection.ts' },
        { id: 'ti-restricted-metadata-collection', source: 'scraper/src/ops/restrictedMetadataCollection.ts' },
        { id: 'ti-exposure-queue-collection', source: 'scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-exposure-parser', source: 'scraper/src/api/exposureQueueRoutes.ts' },
        { id: 'ti-dwm-alert-generation', source: 'scraper/src/api/dwmWorkflowRoutes.ts' },
        { id: 'ti-source-pack-worker', source: 'scraper/src/api/dwmSourceRequestRoute.ts' },
        { id: 'ti-frontier-queue', source: 'scraper/src/frontier/frontier.ts' },
        { id: 'ti-automatic-review', source: 'scraper/src/api/automaticReviewRoutes.ts' },
        { id: 'ti-automatic-evaluation', source: 'scraper/src/api/evaluationBenchmarkRoutes.ts' },
    ]
}

const apiBackgroundJobDefinitions: Array<{
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    schedule: string
    cadenceSeconds: number | null
    source: string
    controls: ScheduledJobControl[]
    isEnabled?: () => boolean
}> = [
    {
        id: 'api-cron-health-monitor',
        name: 'Scheduled job health monitor',
        description: 'Checks blocked jobs, updates their cases, and sends Discord notifications.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/systemCronMonitor.ts',
        controls: ['run_now'],
    },
    {
        id: LOG_INGEST_ACCESS_DETECTION_JOB_ID,
        name: 'Log-ingest abuse detection',
        description: 'Flushes access counters, checks configured request thresholds, and records abuse findings.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: 60,
        source: 'api/src/utils/events/analyzeIngestAccess.ts',
        controls: [],
        isEnabled: () => process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: DROP_RATE_ALERT_REFRESH_JOB_ID,
        name: 'Drop-rule rate alert refresh',
        description: 'Checks recent drop-rule matches and creates alerts when configured rate thresholds are exceeded.',
        category: 'Alerts',
        schedule: 'Every 15 seconds',
        cadenceSeconds: 15,
        source: 'api/src/utils/events/dropRateAlert.ts',
        controls: [],
        isEnabled: () => process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1' && process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: STORED_LOG_PROCESSOR_JOB_ID,
        name: 'Stored event log processor',
        description: 'Drains stored event logs using the configured adaptive catch-up interval.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; configured catch-up interval and 5-second idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1'
            && process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1'
            && process.env.LOG_CATCHUP_WORKER_DISABLED !== '1',
    },
    {
        id: LIVE_LOG_PROCESSOR_JOB_ID,
        name: 'Live event log processor',
        description: 'Drains live event logs with a 100-millisecond processing interval and idle backoff.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; up to 100-millisecond interval with 100-millisecond idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1'
            && process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1'
            && process.env.LOG_LIVE_WORKER_DISABLED !== '1',
    },
    {
        id: RULE_REPROCESSOR_JOB_ID,
        name: 'Event rule reprocessor',
        description: 'Reprocesses stored events for updated rules using the adaptive queue worker.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; up to 1-second interval with 5-second idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1'
            && process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: 'api-hot-cache-refresh',
        name: 'API stats and Docker cache refresh',
        description: 'Refreshes cached API stats and Docker/container snapshots for dashboard resource telemetry.',
        category: 'Other/System',
        schedule: 'Every hot-cache interval',
        cadenceSeconds: null,
        source: 'api/src/utils/refresh/fp.ts',
        controls: [],
    },
    {
        id: RAW_LOG_RETENTION_JOB_ID,
        name: 'Raw log retention',
        description: 'Deletes raw service and traffic logs older than seven days after completed Event ingestion. Keeps Event events and traffic aggregates.',
        category: 'Backup/Database',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/events/rawLogRetention.ts',
        controls: ['run_now', 'pause', 'resume'],
    },
    {
        id: ORGANIZATION_RETENTION_JOB_ID,
        name: 'Organization retention and privacy lifecycle',
        description: 'Applies each organization retention setting in bounded batches, preserves legal holds, and resumes auditable privacy deletion work.',
        category: 'Backup/Database',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/organizationPrivacy.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: ACCOUNT_DELETION_PURGE_JOB_ID,
        name: 'Account deletion retention',
        description: 'Permanently removes accounts and account credentials after the 30-day restore period.',
        category: 'Backup/Database',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/auth/purgeDeletedAccounts.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: RULE_STORAGE_ESTIMATE_JOB_ID,
        name: 'Rule storage estimates',
        description: 'Calculates saved event counts and row bytes for drop rules one at a time when database load is low.',
        category: 'Backup/Database',
        schedule: 'Every minute when database load is low',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/events/ruleStorageEstimateWorker.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: VM_METRICS_JOB_ID,
        name: 'VM metrics',
        description: 'Collects CPU, memory, disk, network and power measurements for registered VMs.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/vms/collectMetrics.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: VM_FAILOVER_JOB_ID,
        name: 'VM failover maintenance',
        description: 'Processes queued VM failovers and refreshes standby replicas for enabled VMs.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/vms/failover.ts',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: HOST_UPDATE_MONITOR_JOB_ID,
        name: 'Host update monitor',
        description: 'Persists the hanasand host updater check-in, pending package list, installed packages, and failure state for the admin console.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/aptUpdates.ts',
        controls: [],
    },
    {
        id: 'api-security-case-delivery',
        name: 'Security case delivery',
        description: 'Opens cases for security detections and retries pending deliveries.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/caseDelivery.ts',
        controls: [],
    },
    {
        id: 'api-vm-deletion',
        name: 'Deleted VM retention',
        description: 'Keeps deleted VMs stopped and removes their disks after the 30-day recovery period.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/vms/deletion.ts',
        controls: [],
    },
    {
        id: 'api-vm-ensure-running',
        name: 'VM keepalive enforcement',
        description: 'Keeps configured always-running VM and agent targets alive.',
        category: 'Other/System',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/vms/ensureAlwaysRunning.ts',
        controls: [],
    },
    {
        id: VULNERABILITY_SCAN_JOB_ID,
        name: 'Vulnerability image scanner',
        description: 'Scans running container images with Trivy and Docker Scout, then stores reports in the standalone Scanner service.',
        category: 'Other/System',
        schedule: secondsSchedule(VULNERABILITY_SCAN_CADENCE_SECONDS),
        cadenceSeconds: VULNERABILITY_SCAN_CADENCE_SECONDS,
        source: 'https://github.com/hanasandcom/scanner',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: DATABASE_BACKUP_JOB_ID,
        name: 'Primary database backup',
        description: 'Creates a verified PostgreSQL archive on its persisted UTC schedule, applies retention, and records every attempt durably.',
        category: 'Backup/Database',
        schedule: 'Persisted daily UTC schedule (checked every minute)',
        cadenceSeconds: null,
        source: 'https://github.com/hanasandcom/database-backup',
        controls: ['pause', 'resume', 'run_now'],
    },
    {
        id: 'api-agent-automations',
        name: 'Agent automation dispatcher',
        description: 'Claims due user/system automations and runs alert, mail, and system actions.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/automations.ts',
        controls: [],
    },
    {
        id: 'api-mail-account-provisioning',
        name: 'Mail account provisioning sync',
        description: 'Reconciles application users with managed mail accounts when mail admin credentials are configured.',
        category: 'Mail',
        schedule: 'Every minute when mail admin is configured',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/mail/accounts.ts',
        controls: [],
    },
]

export async function listManagedCronJobs(): Promise<ManagedCronJob[]> {
    const { entries } = await readManagedCronState()

    return Promise.all(managedCronDefinitions.map(async(definition) => {
        const entry = entries.get(definition.id)
        const log = await readManagedCronLog(definition.logPath)

        return {
            ...definition,
            schedule: entry?.schedule || definition.defaultSchedule,
            enabled: entry ? entry.enabled : false,
            installed: Boolean(entry),
            lastLogLine: log.line,
            lastLogAt: log.createdAt,
        }
    }))
}

export async function listUnifiedScheduledJobs(options: { fast?: boolean } = {}): Promise<UnifiedScheduledJob[]> {
    const now = Date.now()
    if (options.fast && unifiedCronCache && unifiedCronCache.expiresAt > now) return unifiedCronCache.jobs
    if (unifiedCronRefresh) return options.fast ? cachedOrFastUnifiedScheduledJobs() : unifiedCronRefresh

    unifiedCronRefresh = refreshUnifiedScheduledJobs()
    void unifiedCronRefresh.catch(error => {
        console.error('Failed to refresh unified cron inventory', error)
    }).finally(() => {
        unifiedCronRefresh = null
    })
    return options.fast ? cachedOrFastUnifiedScheduledJobs() : unifiedCronRefresh
}

export function hasUnifiedScheduledJobsCache() {
    return Boolean(unifiedCronCache && unifiedCronCache.expiresAt > Date.now())
}

function cachedOrFastUnifiedScheduledJobs(): UnifiedScheduledJob[] {
    return unifiedCronCache?.jobs || fastUnifiedScheduledJobs()
}

function fastUnifiedScheduledJobs(): UnifiedScheduledJob[] {
    const telemetry = unavailableTelemetry('Live job state is refreshing.')
    const apiJobs = visibleApiBackgroundJobDefinitions().map(job => {
        const controls = apiBackgroundJobControls(job, true, false)
        return {
            ...apiBackgroundJobDefinitionFields(job),
            enabled: job.isEnabled?.() ?? true, running: false, status: 'unknown' as const,
            lastRunAt: null, lastSuccessAt: null, lastFinishedAt: null, nextRunAt: null,
            currentRunDurationMs: null, averageRuntimeMs: null, failureCount: 0, lastError: null,
            logExcerpt: 'Live state is refreshing.', controls,
            controlMode: scheduledJobControlMode(controls),
            resourceUsage: telemetry, costEstimate: costEstimate(18, 'Live cost estimate is refreshing.'),
            assumptions: ['This immediate registry snapshot will be replaced by live runtime state.'],
        }
    })
    const managedJobs = managedCronDefinitions.map(job => ({
        id: job.id, name: job.name, description: job.description, category: job.category || 'Forgejo' as const,
        source: 'api/src/utils/systemCron.ts', service: job.service || 'forgejo', schedule: job.defaultSchedule,
        cadenceSeconds: cronCadenceSeconds(job.defaultSchedule), enabled: false, running: false, status: 'unknown' as const,
        installed: false, command: job.command, host: job.host, logPath: job.logPath,
        lastRunAt: null, lastSuccessAt: null, lastFinishedAt: null, nextRunAt: null,
        currentRunDurationMs: null, averageRuntimeMs: null, failureCount: 0, lastError: null,
        logExcerpt: 'Live state is refreshing.', controls: ['edit_schedule', 'resume'] as ScheduledJobControl[],
        controlMode: 'editable' as const, resourceUsage: telemetry,
        costEstimate: costEstimate(8, 'Live cost estimate is refreshing.'),
        assumptions: ['This immediate registry snapshot will be replaced by live crontab state.'],
    }))
    return [...tiUnavailableJobs('Live TI state is refreshing.'), ...apiJobs, ...managedJobs]
}

function visibleApiBackgroundJobDefinitions() {
    return apiBackgroundJobDefinitions.filter(job => job.id !== 'api-mail-account-provisioning' || canRunApiCronJobNow(job.id))
}

async function readManagedCronState() {
    const crontab = await readManagedCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab, managedCronDefinitions)
    for (const [id, entry] of existingEntries) {
        if (!entries.has(id)) entries.set(id, entry)
    }
    return { crontab, entries }
}

async function refreshUnifiedScheduledJobs(): Promise<UnifiedScheduledJob[]> {
    const [forgejoJobs, tiJobs] = await Promise.all([
        listManagedCronJobs(),
        listTiScheduledJobs(),
    ])
    const apiDefinitions = visibleApiBackgroundJobDefinitions()
    const apiJobs = await Promise.all(apiDefinitions.map(job => job.id === VULNERABILITY_SCAN_JOB_ID
        ? vulnerabilityScannerJob(job)
        : apiBackgroundJob(job)))
    const jobs = [...tiJobs, ...apiJobs, ...forgejoJobs.map(managedHostCronJob)]
    unifiedCronCache = { jobs, expiresAt: Date.now() + UNIFIED_CRON_CACHE_TTL_MS }
    return jobs
}

export async function updateManagedCronJob(id: string, input: ManagedCronUpdate) {
    if (id === VULNERABILITY_SCAN_JOB_ID) {
        return updateExternallyManagedCronJob(id, input, {
            runNow: { run: startTrackedVulnerabilityScan, label: 'vulnerability scanner' },
            setPaused: setVulnerabilityScannerPaused,
        })
    }
    if (id === 'ti-public-canary-collection') {
        await updateTiCollectionScheduler(input)
        return updatedScheduledJob(id)
    }
    if (id === 'ti-dwm-alert-generation' && input.action === 'run_now') {
        await runTiJob('/v1/dwm/alerts/rebuild', { tenantId: 'default', actor: 'dashboard/system/cron' })
        return updatedScheduledJob(id)
    }
    if (id === 'ti-source-pack-worker' && input.action === 'run_now') {
        await runTiJob('/v1/dwm/source-requests', { action: 'pack_worker_run', sourcePackLabel: 'default', requestedBy: 'dashboard/system/cron', reason: 'Run now requested from Cron Jobs dashboard.' })
        return updatedScheduledJob(id)
    }
    if (id === DATABASE_BACKUP_JOB_ID) {
        return updateExternallyManagedCronJob(id, input, {
            runNow: {
                run: () => createDatabaseBackup({ actorId: 'cron_dashboard', trigger: 'manual' }),
                label: 'database backup',
            },
            setPaused: setDatabaseBackupSchedulePaused,
        })
    }
    if (canRunApiCronJobNow(id)) {
        return updateExternallyManagedCronJob(id, input, {
            runNow: {
                run: () => runApiCronJobNow(id),
                label: `API cron job ${id}`,
            },
            setPaused: paused => setApiCronJobPaused(id, paused),
        })
    }

    const definition = managedCronDefinitions.find(job => job.id === id)
    if (!definition) {
        throw new Error('Managed cron job not found or does not support controls.')
    }

    const schedule = input.schedule === undefined
        ? undefined
        : normalizeSchedule(input.schedule)
    const enabled = input.enabled === undefined
        ? undefined
        : Boolean(input.enabled)
    const { crontab, entries } = await readManagedCronState()
    const current = entries.get(id)
    entries.set(id, {
        schedule: schedule || current?.schedule || definition.defaultSchedule,
        enabled: enabled ?? current?.enabled ?? true,
    })

    await writeManagedCrontab(replaceManagedBlock(crontab, entries, managedCronDefinitions))
    return (await listManagedCronJobs()).find(job => job.id === id)!
}

async function updateExternallyManagedCronJob(
    id: string,
    input: ManagedCronUpdate,
    options: {
        runNow?: { run: () => Promise<unknown>, label: string }
        setPaused?: (paused: boolean) => Promise<unknown>
    },
) {
    const runNow = options.runNow
    if (input.action === 'run_now' && runNow) {
        void runNow.run().catch(error => {
            console.error(`Failed to run ${runNow.label} from Cron Jobs dashboard`, error)
        })
    }
    if (input.enabled !== undefined && options.setPaused) await options.setPaused(!input.enabled)
    return updatedScheduledJob(id)
}

async function updatedScheduledJob(id: string) {
    return (await listUnifiedScheduledJobs()).find(job => job.id === id)!
}

function apiBackgroundJobControls(
    definition: typeof apiBackgroundJobDefinitions[number],
    enabled: boolean,
    allowPauseResume = true,
): ScheduledJobControl[] {
    const hasRunner = canRunApiCronJobNow(definition.id)
    if (!allowPauseResume) {
        return hasRunner || definition.controls.includes('run_now') ? ['run_now'] : []
    }
    if (!hasRunner) return definition.controls
    return [enabled ? 'pause' : 'resume', 'run_now']
}

function managedHostCronJob(job: ManagedCronJob): UnifiedScheduledJob {
    const running = false
    return {
        id: job.id,
        name: job.name,
        description: job.description,
        category: job.category || 'Forgejo',
        source: 'api/src/utils/systemCron.ts',
        service: job.service || 'forgejo',
        schedule: job.schedule,
        cadenceSeconds: cronCadenceSeconds(job.schedule),
        enabled: job.enabled,
        running,
        status: job.enabled ? 'enabled' : 'paused',
        installed: job.installed,
        command: job.command,
        host: job.host,
        logPath: job.logPath,
        lastRunAt: job.lastLogAt,
        lastSuccessAt: job.lastLogAt,
        lastFinishedAt: job.lastLogAt,
        nextRunAt: null,
        currentRunDurationMs: null,
        averageRuntimeMs: null,
        failureCount: 0,
        lastError: null,
        logExcerpt: job.lastLogLine,
        controls: ['edit_schedule', job.enabled ? 'pause' : 'resume'],
        controlMode: 'editable',
        resourceUsage: unavailableTelemetry('Host cron logs are visible, but per-run CPU/RAM is not exposed by crontab.'),
        costEstimate: costEstimate(8, 'Estimated host-script average draw while scheduled; exact Forgejo cron power is not metered per job.'),
        assumptions: ['Host cron has log timestamps only; runtime and resource usage require shell wrapper metrics.'],
    }
}

function apiBackgroundJobDefinitionFields(
    definition: typeof apiBackgroundJobDefinitions[number],
    service = 'hanasand-api',
) {
    return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        source: definition.source,
        service,
        schedule: definition.schedule,
        cadenceSeconds: definition.cadenceSeconds,
    }
}

async function apiBackgroundJob(definition: typeof apiBackgroundJobDefinitions[number]): Promise<UnifiedScheduledJob> {
    if (definition.id === DATABASE_BACKUP_JOB_ID) return databaseBackupScheduledJob(definition)
    const telemetry = getBackgroundJobRuntime(definition.id)
    const hasRunner = canRunApiCronJobNow(definition.id)
    const enabled = hasRunner ? !await isApiCronJobPaused(definition.id) : definition.isEnabled?.() ?? true
    const controls = apiBackgroundJobControls(definition, enabled)
    return {
        ...apiBackgroundJobDefinitionFields(definition),
        enabled,
        running: telemetry.running,
        status: telemetry.running ? 'running' : !enabled ? 'paused' : telemetry.lastError ? 'failed' : 'enabled',
        lastRunAt: telemetry.lastRunAt,
        lastSuccessAt: telemetry.lastSuccessAt,
        lastFinishedAt: telemetry.lastFinishedAt,
        nextRunAt: enabled && definition.cadenceSeconds ? new Date(Date.now() + definition.cadenceSeconds * 1000).toISOString() : null,
        currentRunDurationMs: currentDurationMs(telemetry),
        averageRuntimeMs: telemetry.averageRuntimeMs,
        failureCount: telemetry.failureCount,
        lastError: telemetry.lastError,
        logExcerpt: telemetry.logExcerpt,
        controls,
        controlMode: scheduledJobControlMode(controls),
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: null,
            note: 'API process-level memory; per-cron task CPU/RAM is not available without a worker wrapper.',
        },
        costEstimate: costEstimate(18, 'Estimated shared API process draw; cost is service-level, not per cron task.'),
        assumptions: [
            'The API minute cron runs subjobs in one process, so CPU/RAM and power are service-level estimates.',
            hasRunner ? 'Pause/resume is persisted in scheduled_job_controls; run now uses the same tracked job function as the minute cron.' : 'No standalone safe runner is exposed for this API job.',
        ],
    }
}

async function databaseBackupScheduledJob(definition: typeof apiBackgroundJobDefinitions[number]): Promise<UnifiedScheduledJob> {
    const service = (await collectDatabaseBackupServices())[0]
    const enabled = Boolean(service.scheduleEnabled)
    const operations = service.operations || []
    const durations = operations.map(operation => operation.durationMs).filter((value): value is number => value !== null)
    const last = operations[0] || null
    const lastSuccess = operations.find(operation => operation.kind === 'backup' && operation.status === 'succeeded') || null
    const failures = operations.filter(operation => operation.status === 'failed' || operation.status === 'interrupted')
    return {
        ...apiBackgroundJobDefinitionFields(definition),
        schedule: `${service.schedule || 'Unavailable'} UTC`,
        cadenceSeconds: null,
        enabled,
        running: Boolean(service.currentOperation),
        status: service.currentOperation ? 'running' : !enabled ? 'paused' : last?.status === 'failed' || last?.status === 'interrupted' ? 'failed' : 'enabled',
        lastRunAt: last?.startedAt || null,
        lastSuccessAt: lastSuccess?.finishedAt || null,
        lastFinishedAt: last?.finishedAt || null,
        nextRunAt: enabled ? service.nextBackup || null : null,
        currentRunDurationMs: service.currentOperation ? Math.max(0, Date.now() - Date.parse(service.currentOperation.startedAt)) : null,
        averageRuntimeMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        failureCount: failures.length,
        lastError: service.lastError || service.error || null,
        logExcerpt: last ? `${last.kind} ${last.status}: ${last.stage}` : 'No backup attempt has been recorded yet.',
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: mb(process.memoryUsage().rss),
            memoryUsedMb: mb(process.memoryUsage().heapUsed),
            queueDepth: service.currentOperation ? 1 : 0,
            note: 'API process memory and durable backup-operation lock state.',
        },
        costEstimate: costEstimate(18, 'Uses the shared API process and PostgreSQL client during an active operation.'),
        assumptions: ['Schedule, next run, attempt, success, failure, and retention evidence come from the persisted backup ledger.'],
    }
}

async function vulnerabilityScannerJob(definition: typeof apiBackgroundJobDefinitions[number]): Promise<UnifiedScheduledJob> {
    const telemetry = getBackgroundJobRuntime(definition.id)
    const report = await getVulnerabilityReport()
    const scan = report.scanStatus
    const enabled = scan.enabled && !scan.paused
    const running = telemetry.running || scan.isRunning
    const issue = scan.blocker || scan.lastError || scan.staleReason || telemetry.lastError
    return {
        ...apiBackgroundJobDefinitionFields(definition, 'hanasand-scanner'),
        schedule: scan.schedule || definition.schedule,
        cadenceSeconds: scan.cadenceSeconds || definition.cadenceSeconds,
        enabled,
        running,
        status: running ? 'running' : !enabled ? 'paused' : scan.blocker || scan.stale ? 'blocked' : scan.lastError ? 'failed' : 'enabled',
        lastRunAt: telemetry.lastRunAt || scan.startedAt,
        lastSuccessAt: scan.lastSuccessAt || telemetry.lastSuccessAt,
        lastFinishedAt: scan.finishedAt || telemetry.lastFinishedAt,
        nextRunAt: enabled ? scan.nextRunAt : null,
        currentRunDurationMs: currentDurationMs(telemetry) || (scan.isRunning ? ageMs(scan.startedAt) : null),
        averageRuntimeMs: telemetry.averageRuntimeMs,
        failureCount: scan.failureCount || telemetry.failureCount,
        lastError: issue,
        logExcerpt: scan.logs.at(-1)?.message || issue || telemetry.logExcerpt,
        controls: [enabled ? 'pause' : 'resume', 'run_now'],
        controlMode: 'safe_control',
        resourceUsage: {
            scope: 'service',
            cpuPercent: null,
            memoryRssMb: null,
            memoryUsedMb: null,
            queueDepth: scan.targetCount,
            note: 'Scanner service CPU is capped by its Compose container; image-level CPU is not exposed by Docker Scout or Trivy.',
        },
        costEstimate: costEstimate(20, 'Estimated Scanner service draw while scheduled; exact scanner power is not metered per job.'),
        assumptions: [
            'Pause/resume updates the Scanner service schedule; an already-running scan is allowed to finish.',
            scan.blockerAction || scan.staleReason || 'Trivy and Docker Scout scan local images from the Docker Engine.',
        ],
    }
}

async function updateTiCollectionScheduler(input: ManagedCronUpdate) {
    const action = input.action === 'run_now'
        ? 'run_now'
        : input.enabled === true
            ? 'resume'
            : input.enabled === false
                ? 'pause'
                : ''

    if (!action) {
        throw new Error('TI collection scheduler requires enabled=true, enabled=false, or action=run_now.')
    }

    await runTiJob('/v1/ops/collection-scheduler', {
        action,
        operatorApproval: true,
        approvedBy: 'dashboard/system/cron',
        reason: tiCollectionControlReason(action),
    })
}

function tiCollectionControlReason(action: 'pause' | 'resume' | 'run_now') {
    if (action === 'run_now') return 'Run now requested from Cron Jobs dashboard.'
    return action === 'resume'
        ? 'Resume requested from Cron Jobs dashboard.'
        : 'Pause requested from Cron Jobs dashboard.'
}

async function runTiJob(path: string, body: unknown) {
    const base = tiBase()
    if (!base) {
        throw new Error('TI_SCRAPER_API_BASE is not configured.')
    }
    const response = await fetch(new URL(path, base), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(process.env.TI_SCRAPER_SERVICE_TOKEN ? { 'x-hanasand-service-token': process.env.TI_SCRAPER_SERVICE_TOKEN } : {}),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `TI scraper returned ${response.status}`)
    }
}

function mb(bytes: number) {
    return Math.round(bytes / 1024 / 1024)
}

function currentDurationMs(telemetry: BackgroundJobRuntime) {
    return telemetry.running && telemetry.currentRunStartedAt ? ageMs(telemetry.currentRunStartedAt) : null
}

export function cronCadenceSeconds(schedule: string) {
    const parts = schedule.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const minute = parts[0]
    if (parts.slice(1).some(field => field !== '*')) return null
    if (minute === '*') return 60
    const every = minute.match(/^\*\/(\d+)$/)
    if (!every) return null
    const intervalMinutes = Number(every[1])
    return intervalMinutes > 0 && intervalMinutes <= 60 && 60 % intervalMinutes === 0
        ? intervalMinutes * 60
        : null
}
