export type ControlRequest = { path: string, body: Record<string, unknown> }

export function createTiMockFetch(now: string, controlRequests: ControlRequest[]) {
    return async(request: Request) => {
        const url = new URL(request.url)
        if (request.method === 'POST') {
            const body = await request.json().catch(() => ({})) as Record<string, unknown>
            controlRequests.push({ path: url.pathname, body })
            if (url.pathname === '/v1/ops/collection-scheduler') return json(tiSchedulerPayload(now))
            if (url.pathname === '/v1/dwm/alerts/rebuild') return json({ ok: true, rebuiltAt: now })
            if (url.pathname === '/v1/dwm/source-requests' && body.action === 'pack_worker_run') {
                return json({ action: 'pack_worker_run', sourcePackId: body.sourcePackId, run: { id: 'run_default_source_pack_worker', status: 'completed', completedAt: now } })
            }
            return json({ error: 'not found' }, 404)
        }

        if (url.pathname === '/v1/ops/collection-scheduler') return json(tiSchedulerPayload(now))
        if (url.pathname === '/v1/health') return json({
            ok: true,
            collection: {
                restrictedMetadata: {
                    enabled: true, running: false, intervalSeconds: 900, cycleCount: 4,
                    successCount: 3, errorCount: 1, failedSourceCount: 1,
                    lastCycleAt: '2026-07-03T09:45:00.000Z',
                    lastSuccessAt: '2026-07-03T09:45:30.000Z',
                    nextCycleAt: '2026-07-03T10:00:30.000Z',
                },
            },
        })
        if (url.pathname === '/v1/dwm/exposure-queue') return json({
            status: 'live', scheduler: { cadenceSeconds: 300 },
            freshness: {
                latestCollectedAt: '2026-07-03T09:59:30.000Z',
                latestClaimAt: '2026-07-03T09:59:00.000Z',
                nextExpectedCollection: '2026-07-03T10:04:30.000Z',
            },
            counts: { visible: 4, needsReview: 1 },
        })
        if (url.pathname === '/v1/dwm/exposure-parser/health') return json({ status: 'ready', generatedAt: now, latencyMs: 42 })
        if (url.pathname === '/v1/dwm/alerts/generation-readiness') return json({
            generatedAt: now, blockers: [], candidateCount: 3, latestEvidenceAt: '2026-07-03T09:58:00.000Z',
        })
        if (url.pathname === '/v1/ops/resource-snapshot') return json(resourceSnapshot())
        if (url.pathname === '/v1/dwm/source-packs') return json({
            readiness: { ready: true, blockers: [] },
            lastRun: { updatedAt: '2026-07-03T09:57:00.000Z' },
            counts: { candidateCount: 5, packCount: 2 }, generatedAt: now,
        })
        if (url.pathname === '/v1/frontier') return json({ queued: 7, tasks: [{ id: 'task_public_ti' }] })
        return json({ error: 'not found' }, 404)
    }
}

function tiSchedulerPayload(now: string) {
    return {
        schemaVersion: 'ti.collection_scheduler_status.v1', generatedAt: now,
        scheduler: {
            enabled: true, running: true, intervalSeconds: 300,
            lastRun: {
                id: 'run_public_canary_latest', status: 'completed', captureCount: 12, failedTaskCount: 0,
                createdAt: '2026-07-03T09:59:00.000Z', updatedAt: '2026-07-03T09:59:45.000Z',
            },
            lastSuccessfulRun: { updatedAt: '2026-07-03T09:59:45.000Z' },
            nextRunAt: '2026-07-03T10:04:00.000Z',
        },
        parser: { aiEndpointConfigured: true }, failures: [],
    }
}

function resourceSnapshot() {
    return {
        service: 'ti-scraper', memory: { rssMb: 321, heapUsedMb: 123 }, queue: { queued: 7 },
        pressure: {
            automaticReview: {
                total: 120, backlog: 9,
                counts: { queued: 7, running: 2, terminal: 108, dead_letter: 3 },
            },
            automaticEvaluation: {
                benchmarkCount: 4, activeBenchmarkCount: 1, taskCount: 80,
                counts: { pending: 5, retry_scheduled: 2, terminal: 72, dead_letter: 1 },
                running: true, enabled: true, intervalSeconds: 45, cycleCount: 12, errorCount: 2,
                lastCycleAt: '2026-07-03T09:59:30.000Z',
                lastSuccessAt: '2026-07-03T09:59:45.000Z',
                nextCycleAt: '2026-07-03T10:00:15.000Z',
            },
        },
        workers: [],
    }
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
