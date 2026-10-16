import { useState, type SyntheticEvent, type Dispatch, type SetStateAction } from 'react'
import { minimumAuditReasonMessage, supportReasonIsSpecific } from './shared'
import type { ApprovalSearchPayload, DecisionPayload, RecoveryPayload } from './types'

export function useRecoveryActions(setSubmitting: Dispatch<SetStateAction<string>>) {
    const [recoveryResult, setRecoveryResult] = useState<RecoveryPayload | null>(null)
    const [decisionResult, setDecisionResult] = useState<DecisionPayload | null>(null)
    const [searchResult, setSearchResult] = useState<ApprovalSearchPayload | null>(null)
    const [recoveryMessage, setRecoveryMessage] = useState<string>('')
    const [decisionMessage, setDecisionMessage] = useState<string>('')
    const [searchMessage, setSearchMessage] = useState<string>('')

    async function submitRecovery(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const payload = {
            email: String(form.get('email') || '').trim(),
            targetUserId: String(form.get('targetUserId') || '').trim() || undefined,
            role: String(form.get('role') || 'admin'),
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            caseId: String(form.get('caseId') || '').trim(),
            approvalRequired: form.get('approvalRequired') === 'on',
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setRecoveryMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('recovery')
        setRecoveryMessage('')
        setRecoveryResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/access-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as RecoveryPayload
            if (!response.ok) {
                setRecoveryMessage(body.error || 'Access recovery failed.')
                return
            }
            setRecoveryResult(body)
            setRecoveryMessage('Recovery invite generated.')
        } catch (error) {
            setRecoveryMessage(error instanceof Error ? error.message : 'Access recovery failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitDecision(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const requestId = String(form.get('requestId') || '').trim()
        const action = String(form.get('action') || 'approve') === 'deny' ? 'deny' : 'approve'
        const payload = {
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setDecisionMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('decision')
        setDecisionMessage('')
        setDecisionResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/access-recovery/${encodeURIComponent(requestId)}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as DecisionPayload
            if (!response.ok) {
                setDecisionMessage(body.error || 'Access recovery decision failed.')
                if (body.decision) setDecisionResult(body)
                return
            }
            setDecisionResult(body)
            setDecisionMessage(action === 'approve' ? 'Recovery approved.' : 'Recovery denied.')
        } catch (error) {
            setDecisionMessage(error instanceof Error ? error.message : 'Access recovery decision failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const query = new URLSearchParams()
        for (const key of ['request', 'org', 'status', 'outcome', 'requester', 'approver', 'from', 'to'] as const) {
            const value = String(form.get(key) || '').trim()
            if (value) query.set(key, value)
        }

        setSubmitting('search')
        setSearchMessage('')
        setSearchResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/access-recovery${query.toString() ? `?${query}` : ''}`)
            const body = await response.json().catch(() => ({})) as ApprovalSearchPayload
            if (!response.ok) {
                setSearchMessage(body.error || 'Approval search failed.')
                return
            }
            setSearchResult(body)
            setSearchMessage(`${body.approvals?.length || 0} approval records`)
        } catch (error) {
            setSearchMessage(error instanceof Error ? error.message : 'Approval search failed.')
        } finally {
            setSubmitting('')
        }
    }

    return { recoveryResult, decisionResult, searchResult, recoveryMessage, decisionMessage, searchMessage, submitRecovery, submitDecision, submitSearch }
}
