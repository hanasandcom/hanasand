import { canRunApiCronJobNow } from '../cron.ts'
import { listTiScheduledJobs } from './tiScheduledJobs.ts'
import { apiBackgroundJobDefinitions } from './apiJobDefinitions/index.ts'
import { listManagedCronJobs } from './managedCrontabState.ts'
import { apiBackgroundJob } from './jobProjections.ts'
import { managedHostCronJob } from './managedHostProjection.ts'
import { fastUnifiedScheduledJobs } from './fastSnapshot.ts'
import type { UnifiedScheduledJob } from './types.ts'

const UNIFIED_CRON_CACHE_TTL_MS = 5_000
let unifiedCronCache: { jobs: UnifiedScheduledJob[], expiresAt: number } | null = null
let unifiedCronRefresh: Promise<UnifiedScheduledJob[]> | null = null

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

function visibleApiBackgroundJobDefinitions() {
    return apiBackgroundJobDefinitions.filter(job => job.id !== 'api-mail-account-provisioning' || canRunApiCronJobNow(job.id))
}

async function refreshUnifiedScheduledJobs(): Promise<UnifiedScheduledJob[]> {
    const [forgejoJobs, tiJobs] = await Promise.all([
        listManagedCronJobs(),
        listTiScheduledJobs(),
    ])
    const apiDefinitions = visibleApiBackgroundJobDefinitions()
    const apiJobs = await Promise.all(apiDefinitions.map(job => apiBackgroundJob(job)))
    const jobs = [...tiJobs, ...apiJobs, ...forgejoJobs.map(managedHostCronJob)]
    unifiedCronCache = { jobs, expiresAt: Date.now() + UNIFIED_CRON_CACHE_TTL_MS }
    return jobs
}
