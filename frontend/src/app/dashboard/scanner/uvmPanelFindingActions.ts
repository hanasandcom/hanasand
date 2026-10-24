import type { Dispatch, SetStateAction } from 'react'
import type { UvmDashboard, UvmFinding, UvmFindingUpdate } from '@/utils/monitoring/types'

export function createUvmPanelFindingActions({ findingUpdates, updateFindingAction, refresh, setBusy, setMessage, setData }: {
    findingUpdates: Record<string, UvmFindingUpdate>
    updateFindingAction: (findingId: string, input: UvmFindingUpdate) => Promise<unknown>
    refresh: () => Promise<unknown>
    setBusy: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setData: Dispatch<SetStateAction<UvmDashboard>>
}) {
    return {
        async updateFinding(finding: UvmFinding) {
            const update = findingUpdates[finding.id] || {
                status: finding.status,
                note: finding.triageNote || '',
                remediationOwner: finding.remediationOwner || '',
                remediationDueDate: finding.remediationDueDate || '',
            }
            setBusy(`finding:${finding.id}`); setMessage('')
            try {
                await updateFindingAction(finding.id, update)
                await refresh()
                setData(current => ({ ...current, findings: current.findings.map(item => item.id === finding.id ? {
                    ...item, status: update.status, triageNote: update.note.trim() || null,
                    remediationOwner: update.remediationOwner.trim() || null, remediationDueDate: update.remediationDueDate || null,
                } : item) }))
                setMessage('Finding updated.')
            } catch (error) { setMessage(error instanceof Error ? error.message : 'Finding could not be updated.') }
            finally { setBusy('') }
        },
    }
}
