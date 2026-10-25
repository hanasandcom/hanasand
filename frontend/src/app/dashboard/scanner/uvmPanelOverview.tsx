import type { UvmDashboard } from '@/utils/monitoring/types'
import { SummaryCard } from './uvmPanelHelpers'
import { UvmAssetEngineCoverageView } from './uvmPanelCoverageView'
import { UvmAssessmentStarter } from './uvmPanelAssessmentStarter'
import { UvmActivityAndSchedules } from './uvmPanelActivity'

export function UvmOverview({ data, servicesPaused = false, activeRunCount, openFindingCount, needsReviewCount, criticalOrHighCount, onManageAssets, onConfigureScanners, onStartAssessment, onViewRuns }: {
    data: UvmDashboard
    servicesPaused?: boolean
    activeRunCount: number
    openFindingCount: number
    needsReviewCount: number
    criticalOrHighCount: number
    onManageAssets: () => void
    onConfigureScanners: () => void
    onStartAssessment: () => void
    onViewRuns: () => void
}) {
    if (servicesPaused && data.scannerError) return <section role='status' className='rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-4'>
        <h2 className='text-base font-semibold'>Overview unavailable</h2>
        <p className='mt-1 text-sm text-ui-muted'>Live assessment data is unavailable while Scanner services are stopped.</p>
    </section>

    const unavailable = Boolean(data.scannerError)

    return <section className='grid gap-4'>
        {servicesPaused && <p role='status' className='rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-3 text-sm text-ui-warning'>Assessment execution is paused. Existing findings and saved schedules are read-only.</p>}
        <UvmAssessmentStarter data={data} servicesPaused={servicesPaused} onManageAssets={onManageAssets} onConfigureScanners={onConfigureScanners} onStartAssessment={onStartAssessment} />
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            <SummaryCard label='Active scans' value={unavailable ? '—' : String(activeRunCount)} detail={unavailable ? 'Unavailable' : activeRunCount ? 'Updating automatically' : 'No active jobs'} />
            <SummaryCard label='Open findings' value={unavailable ? '—' : String(openFindingCount)} detail={unavailable ? 'Unavailable' : openFindingCount ? `${criticalOrHighCount} critical or high` : 'None need triage'} />
            <SummaryCard label='Needs review' value={unavailable ? '—' : String(needsReviewCount)} detail={unavailable ? 'Unavailable' : needsReviewCount ? 'Unvalidated scanner evidence' : 'No review items'} />
        </div>
        <UvmAssetEngineCoverageView data={data} />
        <UvmActivityAndSchedules data={data} servicesPaused={servicesPaused} onViewRuns={onViewRuns} onManageAssets={onManageAssets} />
    </section>
}
