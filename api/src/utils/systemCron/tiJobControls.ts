import { tiBase } from './tiScraperClient.ts'
import type { ManagedCronUpdate } from './types.ts'

export async function updateTiCollectionScheduler(input: ManagedCronUpdate) {
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

export async function runTiJob(path: string, body: unknown) {
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
