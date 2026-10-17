import assert from 'node:assert/strict'
import type { listUnifiedScheduledJobs } from '../../src/utils/systemCron.ts'

type ScheduledJobs = Awaited<ReturnType<typeof listUnifiedScheduledJobs>>

export function assertOfflineRegistry(jobs: ScheduledJobs) {
    const byId = new Map(jobs.map(job => [job.id, job]))
    const registeredIds = [
        'forgejo-standby-sync', 'forgejo-doctor', 'db-dashboard-monitor',
        'ti-threat-intel-backup', 'ti-operational-workflow-canary',
        'ti-public-canary-collection', 'ti-restricted-metadata-collection',
        'ti-exposure-queue-collection', 'ti-exposure-parser', 'ti-dwm-alert-generation',
        'ti-automatic-review', 'ti-automatic-evaluation', 'api-agent-automations',
        'api-vulnerability-scanner', 'api-database-backup',
    ]
    for (const id of registeredIds) assert.ok(byId.has(id), `${id} should be registered.`)

    assert.equal(byId.get('ti-public-canary-collection')?.category, 'TI / Exposure')
    assert.equal(byId.get('ti-exposure-queue-collection')?.controlMode, 'observable_only')
    assert.equal(byId.get('ti-dwm-alert-generation')?.controlMode, 'run_only')
    assert.ok(byId.get('forgejo-standby-sync')?.controls.includes('edit_schedule'), 'Forgejo schedule editing should stay available.')
    assert.equal(byId.get('db-dashboard-monitor')?.category, 'Backup/Database')
    assert.equal(byId.get('db-dashboard-monitor')?.service, 'database-monitor')
    assert.equal(byId.get('db-dashboard-monitor')?.schedule, '* * * * *')
    assert.ok(byId.get('db-dashboard-monitor')?.controls.includes('edit_schedule'), 'Database monitor schedule editing should stay available.')
    assert.equal(byId.get('ti-threat-intel-backup')?.schedule, '23 2 * * *')
    assert.equal(byId.get('ti-threat-intel-backup')?.category, 'Backup/Database')
    assert.ok(byId.get('ti-threat-intel-backup')?.controls.includes('edit_schedule'), 'Threat-intelligence backup schedule should be editable.')
    assert.equal(byId.get('ti-operational-workflow-canary')?.schedule, '41 3 * * *')
    assert.equal(byId.get('ti-operational-workflow-canary')?.category, 'TI / Exposure')
    assert.ok(byId.get('ti-public-canary-collection')?.controls.length, 'TI collection should expose safe controls.')
    assert.ok(byId.get('ti-public-canary-collection')?.controls.includes('run_now'), 'TI collection should expose safe run-now control.')
    assert.equal(byId.get('api-agent-automations')?.controlMode, 'safe_control')
    assert.ok(byId.get('api-agent-automations')?.controls.includes('pause'), 'API automation cron should expose persisted pause control.')
    assert.ok(byId.get('api-agent-automations')?.controls.includes('run_now'), 'API automation cron should expose safe run-now control.')
    assert.equal(byId.get('api-user-account-deletion')?.schedule, 'Every minute', 'Due account deletion should run automatically each minute.')
    assert.ok(byId.get('api-user-account-deletion')?.controls.includes('run_now'), 'Account deletion should expose the same tracked manual runner.')
    assert.equal(byId.get('api-hot-cache-refresh')?.controlMode, 'observable_only', 'Fastify cache refresh stays audit-only because it needs server instance state.')
    assert.equal(byId.get('ti-source-pack-worker')?.controlMode, 'run_only', 'Source-pack worker should expose the existing pack_worker_run contract.')
    assert.ok(byId.get('ti-source-pack-worker')?.controls.includes('run_now'), 'Source-pack worker should expose safe run-now control.')
    assert.equal(byId.get('api-vulnerability-scanner')?.controlMode, 'safe_control')
    assert.ok(byId.get('api-vulnerability-scanner')?.controls.includes('run_now'), 'Vulnerability scanner should expose manual run control.')
    assert.equal(byId.get('api-vulnerability-scanner')?.status, 'blocked', 'A never-run vulnerability scanner should be visible as blocked/stale.')
    assert.match(byId.get('api-vulnerability-scanner')?.lastError || '', /No vulnerability scan has completed|Docker|Scout|socket|Previous vulnerability scan|HANASAND_SCANNER_URL is not configured/, 'Vulnerability scanner should expose the stale reason or exact scanner blocker.')
    assert.equal(byId.get('api-database-backup')?.category, 'Backup/Database')
    assert.equal(byId.get('api-database-backup')?.schedule, '23 2 * * * UTC')
    assert.ok(byId.get('api-database-backup')?.controls.includes('resume'), 'Disabled backup schedule should expose a persisted resume control.')

    for (const job of jobs) {
        assert.ok(job.resourceUsage, `${job.id} should include resource telemetry.`)
        assert.ok(job.costEstimate, `${job.id} should include cost telemetry.`)
        assert.equal(job.costEstimate.electricityUsdPerKwh, 0.05)
    }
}

export function assertLiveRegistry(liveJobs: ScheduledJobs) {
    const byId = new Map(liveJobs.map(job => [job.id, job]))
    assert.equal(byId.get('ti-public-canary-collection')?.status, 'running')
    assert.equal(byId.get('ti-public-canary-collection')?.lastRunAt, '2026-07-03T09:59:00.000Z')
    assert.equal(byId.get('ti-public-canary-collection')?.nextRunAt, '2026-07-03T10:04:00.000Z')
    assert.ok(byId.get('ti-public-canary-collection')?.controls.includes('run_now'), 'Live TI collection should expose run-now control.')
    assert.equal(byId.get('ti-exposure-queue-collection')?.logExcerpt, '4 visible claims, 1 need review.')
    assert.equal(byId.get('ti-exposure-parser')?.averageRuntimeMs, 42)
    assert.equal(byId.get('ti-dwm-alert-generation')?.controlMode, 'run_only')
    assert.equal(byId.get('ti-source-pack-worker')?.controlMode, 'run_only')
    assert.equal(byId.get('ti-frontier-queue')?.resourceUsage.queueDepth, 7)
    assert.equal(byId.get('ti-public-canary-collection')?.resourceUsage.memoryRssMb, 321)
    assert.equal(byId.get('ti-restricted-metadata-collection')?.status, 'enabled')
    assert.equal(byId.get('ti-restricted-metadata-collection')?.nextRunAt, '2026-07-03T10:00:30.000Z')
    assert.equal(byId.get('ti-automatic-review')?.resourceUsage.queueDepth, 9)
    assert.equal(byId.get('ti-automatic-review')?.failureCount, 3)
    assert.equal(byId.get('ti-automatic-evaluation')?.status, 'running')
    assert.equal(byId.get('ti-automatic-evaluation')?.cadenceSeconds, 45)
    assert.equal(byId.get('ti-automatic-evaluation')?.lastSuccessAt, '2026-07-03T09:59:45.000Z')
    assert.equal(byId.get('ti-automatic-evaluation')?.nextRunAt, '2026-07-03T10:00:15.000Z')
    assert.equal(byId.get('ti-automatic-evaluation')?.resourceUsage.queueDepth, 7)
    assert.equal(byId.get('ti-automatic-evaluation')?.failureCount, 3)
}
