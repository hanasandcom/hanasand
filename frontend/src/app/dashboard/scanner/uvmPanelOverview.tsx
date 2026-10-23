import type { UvmDashboard } from '@/utils/monitoring/types'
import { formatDate, SummaryCard } from './uvmPanelHelpers'
import { UvmAssetEngineCoverageView } from './uvmPanelCoverageView'
import { UvmAssessmentStarter, UvmHelp } from './uvmPanelViews'

export function UvmOverview({ data, activeRunCount, openFindingCount, criticalOrHighCount, onManageAssets, onConfigureScanners, onStartAssessment }: {
    data: UvmDashboard
    activeRunCount: number
    openFindingCount: number
    criticalOrHighCount: number
    onManageAssets: () => void
    onConfigureScanners: () => void
    onStartAssessment: () => void
}) {
    const unavailable = Boolean(data.scannerError)
    const latestRun = data.runs[0]

    return <section className='grid gap-4'>
        <UvmAssessmentStarter data={data} onManageAssets={onManageAssets} onConfigureScanners={onConfigureScanners} onStartAssessment={onStartAssessment} />
        <div className='grid gap-3 sm:grid-cols-2'>
            <SummaryCard label='Active scans' value={unavailable ? '—' : String(activeRunCount)} detail={unavailable ? 'Unavailable' : activeRunCount ? 'Updating automatically' : 'No active jobs'} />
            <SummaryCard label='Open findings' value={unavailable ? '—' : String(openFindingCount)} detail={unavailable ? 'Unavailable' : openFindingCount ? `${criticalOrHighCount} critical or high` : 'None need triage'} />
        </div>
        <UvmAssetEngineCoverageView data={data} />
        <div className='grid gap-4 lg:grid-cols-2'>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex items-start justify-between gap-3'><h2 className='text-base font-semibold'>Latest scan</h2><UvmHelp label='Latest scan' text='Coverage counts completed target addresses. A partial or unreported result does not confirm that an asset is clear.' /></div>
                {latestRun ? <div className='mt-3'><div className='flex flex-wrap items-center gap-2'><strong>{latestRun.target}</strong><span className='rounded-full bg-ui-raised px-2 py-1 text-xs'>{latestRun.status}</span></div><p className='mt-1 text-sm text-ui-muted'>{latestRun.engine} · {latestRun.profile} · {formatDate(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt)}</p><p className='mt-2 text-sm text-ui-muted'>{latestRun.coverage ? `Address coverage ${latestRun.coverage.completedAddresses}/${latestRun.coverage.requestedAddresses ?? latestRun.coverage.attemptedAddresses ?? 0}` : ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(latestRun.status) ? 'Address coverage pending' : 'Coverage was not reported'}</p>{latestRun.error && <p className='mt-2 text-sm text-ui-warning'>{latestRun.error}</p>}</div> : <p className='mt-2 text-sm text-ui-muted'>{unavailable ? 'Unavailable — Scanner data could not be loaded.' : 'No scan runs yet.'}</p>}
            </section>
        </div>
    </section>
}
