import type { FormEvent } from 'react'
import type { NetworkScanProfile, UvmAssessment, UvmEngineSelection } from '@/utils/monitoring/types'
import { buildUvmAssessmentEnginePlan } from './uvmPanelEnginePlans'

export function createUvmPanelAssessmentActions({ cancelAssessmentAction, startAssessmentAction, assetIds, engines, scanId, nmapProfile, setAssetIds, setBusy, setMessage, refresh }: {
    cancelAssessmentAction: (assessmentId: string) => Promise<{ assessment: UvmAssessment }>
    startAssessmentAction: (input: { requestId: string, assetIds: string[], engines: UvmEngineSelection[], authorized: boolean }) => Promise<{ assessment: UvmAssessment }>
    assetIds: string[]
    engines: UvmEngineSelection['engine'][]
    scanId: string
    nmapProfile: NetworkScanProfile
    setAssetIds: (value: string[]) => void
    setBusy: (value: string) => void
    setMessage: (value: string) => void
    refresh: () => Promise<unknown>
}) {
    return {
        async cancelAssessment(assessment: UvmAssessment) {
            setBusy(`assessment:${assessment.id}`); setMessage('')
            try { await cancelAssessmentAction(assessment.id); await refresh(); setMessage('Assessment cancellation requested.') }
            catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not be cancelled.') }
            finally { setBusy('') }
        },
        async startAssessment(event: FormEvent<HTMLFormElement>) {
            event.preventDefault(); setBusy('assessment'); setMessage('')
            if (!assetIds.length || !engines.length) { setMessage('Choose at least one verified asset and one available engine.'); setBusy(''); return }
            if (engines.includes('tenable-vm') && !scanId) { setMessage('Choose an enabled Tenable scan configuration.'); setBusy(''); return }
            try {
                const enginePlan = buildUvmAssessmentEnginePlan(engines, scanId, nmapProfile)
                await startAssessmentAction({ requestId: crypto.randomUUID(), assetIds, engines: enginePlan, authorized: true })
                setAssetIds([]); await refresh(); setMessage('Authorized assessment queued. Scanner results will update as each job completes.')
            } catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not start.') }
            finally { setBusy('') }
        },
    }
}
