import type { UvmAssetEngineCoverage, UvmDashboard, UvmRun } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'

function runResult(run: UvmRun) {
    if (run.engine === 'nmap') {
        const observations = (run.hosts || []).flatMap(host => host.ports)
        const confirmedOpenPorts = observations.filter(port => port.state === 'open').length
        const ambiguousUdpPorts = observations.filter(port => port.protocol === 'udp' && port.state === 'open|filtered').length
        const ports = run.profile === 'udp-top-100'
            ? `${confirmedOpenPorts} open · ${ambiguousUdpPorts} open|filtered UDP`
            : `${confirmedOpenPorts} open TCP port${confirmedOpenPorts === 1 ? '' : 's'}`
        const total = run.coverage?.requestedAddresses ?? run.coverage?.attemptedAddresses
        const coverage = total === undefined ? '' : `Address coverage ${run.coverage?.completedAddresses}/${total} · `
        return `${coverage}${ports}${run.profile === 'tcp-top-1000-safe-vuln' ? ' · NSE checks' : run.profile === 'udp-top-100' ? ' · UDP inventory' : ' · service inventory only'}`
    }
    if (run.engine === 'testssl') {
        const flagged = run.observations?.filter(observation => observation.disposition === 'finding').length || 0
        const completed = run.completedAddresses?.length ?? run.coverage?.completedAddresses
        const requested = run.coverage?.requestedAddresses ?? run.attemptedAddresses?.length
        const addressCoverage = completed === undefined || requested === undefined ? 'TLS address coverage unknown' : `${completed}/${requested} TLS addresses complete`
        return `${addressCoverage} · ${flagged} flagged TLS checks · ${run.observations?.length || 0} total observations`
    }
    if (run.findings) return `${run.findings.length} findings reported`
    if (run.coverage) {
        const total = run.coverage.requestedAddresses ?? run.coverage.attemptedAddresses
        return total === undefined ? `${run.coverage.completedAddresses} addresses complete` : `${run.coverage.completedAddresses}/${total} addresses complete`
    }
    return ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status) ? 'Results pending' : 'Results not reported'
}

function sourceLabel(source: UvmRun['source']) {
    return source === 'scheduled' ? 'scheduled' : source === 'assessment' ? 'assessment' : source === 'manual' ? 'manual' : 'source unknown'
}

function RecentActivity({ data, unavailable, onViewRuns }: { data: UvmDashboard, unavailable: boolean, onViewRuns: () => void }) {
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'><h2 className='text-base font-semibold'>Recent activity</h2><button type='button' onClick={onViewRuns} className='text-xs font-semibold text-ui-muted hover:text-ui-text'>All runs</button></div>
        {unavailable ? <p className='mt-3 text-sm text-ui-warning'>Activity unavailable while Scanner is offline.</p>
            : data.runs.length ? <ol className='mt-3 grid gap-2'>
                {data.runs.slice(0, 5).map(run => <li key={run.id} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'><strong className='text-sm'>{run.target}</strong><span className='rounded bg-ui-canvas px-2 py-1 text-xs'>{run.status}</span></div>
                    <p className='mt-1 text-xs text-ui-muted'>{run.engine} · {run.profile} · {sourceLabel(run.source)} · {formatDate(run.finishedAt || run.startedAt || run.createdAt)}</p>
                    <p className='mt-1 text-xs text-ui-muted'>{runResult(run)}{run.error ? ` · ${run.error}` : ''}</p>
                </li>)}
            </ol> : <p className='mt-3 text-sm text-ui-muted'>No assessment activity yet.</p>}
    </section>
}

function ScheduledAssessments({ data, unavailable, onManageAssets }: { data: UvmDashboard, unavailable: boolean, onManageAssets: () => void }) {
    const scheduled = data.assets.filter(asset => asset.scheduleEnabled)
        .sort((left, right) => (Date.parse(left.nextRunAt || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(right.nextRunAt || '') || Number.MAX_SAFE_INTEGER))
    const coverageFor = (assetId: string, engine: UvmAssetEngineCoverage['engine']) =>
        data.coverage?.find(item => item.assetId === assetId && item.engine === engine)

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'><h2 className='text-base font-semibold'>Upcoming schedules</h2><button type='button' onClick={onManageAssets} className='text-xs font-semibold text-ui-muted hover:text-ui-text'>Manage assets</button></div>
        {unavailable ? <p className='mt-3 text-sm text-ui-warning'>Schedule status unavailable while Scanner is offline.</p>
            : scheduled.length ? <ol className='mt-3 grid gap-2'>
                {scheduled.slice(0, 5).map(asset => {
                    const plan = asset.schedulePlan?.length ? asset.schedulePlan : [{ engine: asset.scheduleEngine }]
                    const coverage = plan.map(choice => ({ engine: choice.engine, coverage: coverageFor(asset.id, choice.engine) }))
                    return <li key={asset.id} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'><strong className='text-sm'>{asset.hostname}</strong><span className='text-xs text-ui-muted'>{plan.map(choice => choice.engine).join(' → ')}</span></div>
                        <p className='mt-1 text-xs text-ui-muted'>Every {asset.intervalMinutes} min · next {formatDate(asset.nextRunAt)}</p>
                        {coverage.map(item => <p key={item.engine} className='mt-1 text-xs text-ui-muted'>{item.engine} last complete: {item.coverage?.lastCompleteRun ? `${item.coverage.freshness} · ${formatDate(item.coverage.lastCompleteRun.at)}` : 'none recorded'}</p>)}
                    </li>
                })}
            </ol> : <p className='mt-3 text-sm text-ui-muted'>No recurring assessments enabled.</p>}
    </section>
}

export function UvmActivityAndSchedules({ data, onViewRuns, onManageAssets }: {
    data: UvmDashboard
    onViewRuns: () => void
    onManageAssets: () => void
}) {
    const unavailable = Boolean(data.scannerError)
    return <div className='grid gap-4 lg:grid-cols-2'>
        <RecentActivity data={data} unavailable={unavailable} onViewRuns={onViewRuns} />
        <ScheduledAssessments data={data} unavailable={unavailable} onManageAssets={onManageAssets} />
    </div>
}
