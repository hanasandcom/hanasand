import { expect, test } from 'bun:test'
import type { TiAdminOverview } from '../src/utils/tiAdmin/ops'
import { summarizeCollectionRuns } from '../src/app/dashboard/ti/runs/runSummaryModel'

const run = (value: Partial<TiAdminOverview['runs'][number]>) => value as TiAdminOverview['runs'][number]
const source = (value: Partial<TiAdminOverview['sources'][number]>) => value as TiAdminOverview['sources'][number]

test('summarizes counters, source schedule, ordering, and attention without dropping overdue completed runs', () => {
    const now = Date.now()
    const runs = [
        run({ id: 'complete-overdue', status: 'completed', startedAt: new Date(now - 3_000).toISOString(), nextRunAt: new Date(now - 1_000).toISOString(), captures: 1, screenshots: 2, rows: 3 }),
        run({ id: 'failed', status: 'failed', startedAt: new Date(now - 2_000).toISOString(), captures: 4, screenshots: 5, rows: 6 }),
        run({ id: 'queued', status: 'queued', startedAt: new Date(now).toISOString(), nextRunAt: new Date(now + 60_000).toISOString(), captures: 7, screenshots: 8, rows: 9 }),
        run({ id: 'running', status: 'running', startedAt: new Date(now + 1_000).toISOString(), nextRunAt: new Date(now + 30_000).toISOString(), captures: 10, screenshots: 11, rows: 12 }),
    ]
    const sources = [
        source({ id: 'late', status: 'active', executable: true, nextRunAt: new Date(now + 90_000).toISOString() }),
        source({ id: 'soon', status: 'active', executable: true, nextRunAt: new Date(now + 20_000).toISOString() }),
    ]

    const summary = summarizeCollectionRuns(runs, sources)

    expect(summary.orderedRuns.map(item => item.id)).toEqual(['running', 'queued', 'failed', 'complete-overdue'])
    expect([summary.running, summary.failed, summary.completed]).toEqual([2, 1, 1])
    expect([summary.captureTotal, summary.screenshotTotal, summary.rowTotal]).toEqual([22, 26, 30])
    expect(summary.nextRun?.id).toBe('running')
    expect(summary.nextSource?.id).toBe('soon')
    expect(summary.attentionRuns.map(item => item.id)).toEqual(['running', 'queued', 'failed', 'complete-overdue'])
})
