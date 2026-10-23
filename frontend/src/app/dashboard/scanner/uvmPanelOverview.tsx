import type { UvmDashboard } from '@/utils/monitoring/types'
import { SummaryCard } from './uvmPanelHelpers'
import { UvmAssetEngineCoverageView } from './uvmPanelCoverageView'
import { UvmAssessmentStarter } from './uvmPanelAssessmentStarter'
import { UvmActivityAndSchedules } from './uvmPanelActivity'

export function UvmOverview({ data, activeRunCount, openFindingCount, criticalOrHighCount, onManageAssets, onConfigureScanners, onStartAssessment, onViewRuns }: {
    data: UvmDashboard
    activeRunCount: number
    openFindingCount: number
    criticalOrHighCount: number
    onManageAssets: () => void
    onConfigureScanners: () => void
    onStartAssessment: () => void
    onViewRuns: () => void
}) {
    const unavailable = Boolean(data.scannerError)

    return <section className='grid gap-4'>
        <UvmAssessmentStarter data={data} onManageAssets={onManageAssets} onConfigureScanners={onConfigureScanners} onStartAssessment={onStartAssessment} />
        <div className='grid gap-3 sm:grid-cols-2'>
            <SummaryCard label='Active scans' value={unavailable ? '—' : String(activeRunCount)} detail={unavailable ? 'Unavailable' : activeRunCount ? 'Updating automatically' : 'No active jobs'} />
            <SummaryCard label='Open findings' value={unavailable ? '—' : String(openFindingCount)} detail={unavailable ? 'Unavailable' : openFindingCount ? `${criticalOrHighCount} critical or high` : 'None need triage'} />
        </div>
        <UvmAssetEngineCoverageView data={data} />
        <UvmActivityAndSchedules data={data} onViewRuns={onViewRuns} onManageAssets={onManageAssets} />
    </section>
}
