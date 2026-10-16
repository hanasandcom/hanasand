import type { TiAdminOverview } from '@/utils/tiAdmin/ops'
import { isOverdue } from './runPresentation'

type Run = TiAdminOverview['runs'][number]
type Source = TiAdminOverview['sources'][number]

export function summarizeCollectionRuns(runs: Run[], sources: Source[]) {
    const orderedRuns = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    const running = runs.filter(run => run.status === 'running' || run.status === 'queued').length
    const failed = runs.filter(run => run.status === 'failed').length
    const completed = runs.filter(run => run.status === 'completed').length
    const captureTotal = runs.reduce((sum, run) => sum + run.captures, 0)
    const screenshotTotal = runs.reduce((sum, run) => sum + run.screenshots, 0)
    const rowTotal = runs.reduce((sum, run) => sum + run.rows, 0)
    const nextRun = [...runs]
        .filter(run => (run.status === 'queued' || run.status === 'running') && run.nextRunAt)
        .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const nextSource = [...sources]
        .filter(source => source.status === 'active' && source.executable && Number.isFinite(new Date(source.nextRunAt).getTime()))
        .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const attentionRuns = orderedRuns.filter(run => run.status !== 'completed' || Boolean(run.nextRunAt && isOverdue(run.nextRunAt)))

    return { orderedRuns, running, failed, completed, captureTotal, screenshotTotal, rowTotal, nextRun, nextSource, attentionRuns }
}

export type CollectionRunSummary = ReturnType<typeof summarizeCollectionRuns>
