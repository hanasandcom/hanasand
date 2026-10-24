import type { Dispatch, SetStateAction } from 'react'
import type { UvmAssessment, UvmAssessmentReport, UvmDashboard, UvmFindingHistoryPage, UvmFindingHistoryScope, UvmRun } from '@/utils/monitoring/types'
import type { UvmPanelView } from './uvmPanelNavigation'
import { buildAssessmentFindingFilters, type UvmFindingFilters } from './uvmPanelHelpers'

export function createUvmPanelHistoryActions({
    data, findingScope, getRunAction, findingHistoryAction, getAssessmentReportAction,
    setBusy, setMessage, setSelectedRun, setAssessmentReport, setView, setData, setFindingScope, setFindingSyncState, setFindingFilters,
}: {
    data: UvmDashboard
    findingScope: UvmFindingHistoryScope | null
    getRunAction: (runId: string, engine: string) => Promise<UvmRun>
    findingHistoryAction: (cursor: string | null, scope?: UvmFindingHistoryScope) => Promise<UvmFindingHistoryPage>
    getAssessmentReportAction: (assessmentId: string) => Promise<{ assessment: UvmAssessmentReport }>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setSelectedRun: Dispatch<SetStateAction<UvmRun | null>>
    setAssessmentReport: Dispatch<SetStateAction<UvmAssessmentReport | null>>
    setView: Dispatch<SetStateAction<UvmPanelView>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
    setFindingScope: Dispatch<SetStateAction<UvmFindingHistoryScope | null>>
    setFindingSyncState: Dispatch<SetStateAction<UvmFindingHistoryPage['syncState']>>
    setFindingFilters: Dispatch<SetStateAction<UvmFindingFilters>>
}) {
    async function loadOlderFindings(cursor: string | null) {
        const page = await findingHistoryAction(cursor, findingScope || undefined)
        setData(current => ({ ...current,
            findings: [...current.findings, ...page.findings.filter(finding => !current.findings.some(existing => existing.id === finding.id))],
            findingsNextCursor: page.nextCursor,
        }))
        setFindingSyncState(page.syncState)
        return page
    }

    async function openAssessmentFindings(assessmentId: string, stepId: string, assetId: string, engine: string) {
        const scope = { assessmentId, stepId }
        setBusy(`assessment-findings:${stepId}`); setMessage('')
        try {
            const page = await findingHistoryAction(null, scope)
            setData(current => ({ ...current, findings: page.findings, findingsNextCursor: page.nextCursor }))
            setFindingScope(scope); setFindingSyncState(page.syncState)
            setFindingFilters(buildAssessmentFindingFilters(assetId, engine))
            setAssessmentReport(null); setView('findings')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Assessment findings could not be loaded.') }
        finally { setBusy('') }
    }

    async function showAllFindings() {
        setBusy('finding-history'); setMessage('')
        try {
            const page = await findingHistoryAction(null)
            setData(current => ({ ...current, findings: page.findings, findingsNextCursor: page.nextCursor }))
            setFindingScope(null); setFindingSyncState(undefined)
            setFindingFilters({ query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Finding history could not be loaded.') }
        finally { setBusy('') }
    }

    async function retryAssessmentFindings() {
        if (!findingScope) return
        setBusy(`assessment-findings:${findingScope.stepId}`); setMessage('')
        try {
            const page = await findingHistoryAction(null, findingScope)
            setData(current => ({ ...current, findings: page.findings, findingsNextCursor: page.nextCursor }))
            setFindingSyncState(page.syncState)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Assessment findings could not be loaded.') }
        finally { setBusy('') }
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

    return { loadOlderFindings, openAssessmentFindings, openAssessmentReport, openRun, retryAssessmentFindings, showAllFindings }
}
