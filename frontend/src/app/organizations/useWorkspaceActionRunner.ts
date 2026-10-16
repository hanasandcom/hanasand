import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { ActivityItem, ActivitySubject, RowMessage } from './types/activity'
import type { OrganizationSummary } from './types/organization'
import { actionLabel, errorMessage } from './model/labels'
import { activityItemSubject, activitySubjectFromRowKey } from './model/activityNavigation'
import { trimActivityRows } from './model/activityLabels'

export type WorkspaceActionResult = string | { message?: string, organizationId?: string, warning?: boolean } | void
export type WorkspaceAction = (label: string, action: () => Promise<WorkspaceActionResult>, rowKey?: string, subjectOverride?: ActivitySubject | null) => Promise<void>

type ActionRunnerOptions = {
    selectedOrganization?: OrganizationSummary
    setBusy: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string>>
    setMessage: Dispatch<SetStateAction<string>>
    setMessageTone: Dispatch<SetStateAction<'success' | 'warning'>>
    setRowMessages: Dispatch<SetStateAction<Record<string, RowMessage>>>
    setActivity: Dispatch<SetStateAction<ActivityItem[]>>
    selectActivitySubject: (subject: ActivitySubject) => void
    loadOrganizationBundle: (organizationId: string) => Promise<void>
    loadOrganizations: (organizationId?: string) => Promise<void>
}

export function useWorkspaceActionRunner(options: ActionRunnerOptions): WorkspaceAction {
    const {
        selectedOrganization, setBusy, setError, setMessage, setMessageTone,
        setRowMessages, setActivity, selectActivitySubject, loadOrganizationBundle, loadOrganizations,
    } = options

    return useCallback(async (label, action, rowKey, subjectOverride) => {
        setBusy(label)
        setError('')
        setMessage('')
        setMessageTone('success')
        const actionSubject = subjectOverride ?? activitySubjectFromRowKey(rowKey, selectedOrganization?.id)
        if (rowKey) setRowMessages(current => {
            const next = { ...current }
            delete next[rowKey]
            return next
        })
        try {
            const result = await action()
            const nextMessage = typeof result === 'string' ? result : result?.message
            const reloadId = typeof result === 'object' ? result?.organizationId : undefined
            const organizationId = reloadId || selectedOrganization?.id
            const warning = typeof result === 'object' && Boolean(result?.warning)
            setMessage(nextMessage || 'Saved.')
            setMessageTone(warning ? 'warning' : 'success')
            if (rowKey) setRowMessages(current => ({ ...current, [rowKey]: { ok: !warning, text: nextMessage || 'Saved.' } }))
            if (actionSubject) selectActivitySubject(actionSubject)
            setActivity(current => trimActivityRows([{
                id: `${label}-${Date.now()}`, at: new Date().toISOString(), title: actionLabel(label),
                detail: nextMessage || 'Saved.', ok: !warning, organizationId,
                source: 'session', ...activityItemSubject(actionSubject),
            }, ...current]))
            if (organizationId) {
                await loadOrganizationBundle(organizationId)
                await loadOrganizations(organizationId)
            } else await loadOrganizations()
        } catch (err) {
            const detail = errorMessage(err)
            if (err && typeof err === 'object' && 'code' in err && err.code === 'dwm_watchlist_sync_failed' && selectedOrganization?.id) {
                await loadOrganizationBundle(selectedOrganization.id)
            }
            setError(detail)
            if (rowKey) setRowMessages(current => ({ ...current, [rowKey]: { ok: false, text: detail } }))
            if (actionSubject) selectActivitySubject(actionSubject)
            setActivity(current => trimActivityRows([{
                id: `${label}-${Date.now()}`, at: new Date().toISOString(), title: actionLabel(label),
                detail, ok: false, organizationId: selectedOrganization?.id,
                source: 'session', ...activityItemSubject(actionSubject),
            }, ...current]))
        } finally { setBusy('') }
    }, [selectedOrganization, setBusy, setError, setMessage, setMessageTone, setRowMessages,
        setActivity, selectActivitySubject, loadOrganizationBundle, loadOrganizations])
}
