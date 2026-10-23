import type { Dispatch, SetStateAction } from 'react'
import type { UvmAssessment, UvmAssessmentReport, UvmDashboard, UvmFindingHistoryPage, UvmRun } from '@/utils/monitoring/types'
import type { UvmPanelView } from './uvmPanelNavigation'

export function createUvmPanelHistoryActions({
    data, getRunAction, findingHistoryAction, getAssessmentReportAction,
    setBusy, setMessage, setSelectedRun, setAssessmentReport, setView, setData,
}: {
    data: UvmDashboard
    getRunAction: (runId: string, engine: string) => Promise<UvmRun>
    findingHistoryAction: (cursor: string | null) => Promise<UvmFindingHistoryPage>
    getAssessmentReportAction: (assessmentId: string) => Promise<{ assessment: UvmAssessmentReport }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setSelectedRun: Dispatch<SetStateAction<UvmRun | null>>
    setAssessmentReport: Dispatch<SetStateAction<UvmAssessmentReport | null>>
    setView: Dispatch<SetStateAction<UvmPanelView>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
}) {
    async function loadOlderFindings(cursor: string | null) {
        const page = await findingHistoryAction(cursor)
        setData(current => ({ ...current,
            findings: [...current.findings, ...page.findings.filter(finding => !current.findings.some(existing => existing.id === finding.id))],
            findingsNextCursor: page.nextCursor,
        }))
        return page
    }

    async function openAssessmentReport(assessment: UvmAssessment) {
        setBusy(`report:${assessment.id}`); setMessage('')
        try { const result = await getAssessmentReportAction(assessment.id); setAssessmentReport(result.assessment) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Assessment report could not be loaded.') }
        finally { setBusy('') }
    }

    async function openRun(runId: string, engine: string) {
        let run = data.runs.find(item => item.id === runId && item.engine === engine)
        if (!run) {
            setBusy(`run:${runId}`); setMessage('')
            try { run = await getRunAction(runId, engine) }
            catch (error) { setMessage(error instanceof Error ? error.message : 'Scanner run could not be loaded.'); return }
            finally { setBusy('') }
        }
        setSelectedRun(run); setView('runs')
    }

    return { loadOlderFindings, openAssessmentReport, openRun }
}
