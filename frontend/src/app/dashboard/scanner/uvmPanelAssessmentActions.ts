import type { UvmAssessment } from '@/utils/monitoring/types'

export function createUvmPanelAssessmentActions({ cancelAssessmentAction, setBusy, setMessage, refresh }: {
    cancelAssessmentAction: (assessmentId: string) => Promise<{ assessment: UvmAssessment }>
    setBusy: (value: string) => void
    setMessage: (value: string) => void
    refresh: () => Promise<void>
}) {
    return {
        async cancelAssessment(assessment: UvmAssessment) {
            setBusy(`assessment:${assessment.id}`); setMessage('')
            try { await cancelAssessmentAction(assessment.id); await refresh(); setMessage('Assessment cancellation requested.') }
            catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not be cancelled.') }
            finally { setBusy('') }
        },
    }
}
