import { useState, type SyntheticEvent, type Dispatch, type SetStateAction } from 'react'
import { minimumAuditReasonMessage, supportReasonIsSpecific } from './shared'
import type { ImpersonationPayload } from './types'

export function useImpersonationActions(setSubmitting: Dispatch<SetStateAction<string>>) {
    const [impersonationResult, setImpersonationResult] = useState<ImpersonationPayload | null>(null)
    const [impersonationMessage, setImpersonationMessage] = useState<string>('')

    async function submitImpersonation(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const scope = form.getAll('scope').map(value => String(value)).filter(Boolean)
        const payload = {
            target_id: String(form.get('targetId') || '').trim(),
            organizationId: String(form.get('organizationId') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            durationMinutes: String(form.get('durationMinutes') || '').trim(),
            scope,
            reason: String(form.get('reason') || '').trim(),
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setImpersonationMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('impersonation')
        setImpersonationMessage('')
        setImpersonationResult(null)
        try {
            const response = await fetch('/api/impersonation/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as ImpersonationPayload
            if (!response.ok) {
                setImpersonationMessage(body.error || body.detail?.message || 'Impersonation start failed.')
                setImpersonationResult(body)
                return
            }
            setImpersonationResult(body)
            setImpersonationMessage('Scoped impersonation started.')
        } catch (error) {
            setImpersonationMessage(error instanceof Error ? error.message : 'Impersonation start failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function stopImpersonation(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const reason = String(form.get('reason') || '').trim()
        if (!supportReasonIsSpecific(reason)) {
            setImpersonationMessage(minimumAuditReasonMessage)
            return
        }
        setSubmitting('stop')
        setImpersonationMessage('')
        try {
            const response = await fetch('/api/impersonation', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason,
                    context: String(form.get('context') || '').trim(),
                }),
            })
            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string }
                setImpersonationMessage(body.error || 'Impersonation stop failed.')
                return
            }
            setImpersonationMessage('Scoped session ended.')
        } catch (error) {
            setImpersonationMessage(error instanceof Error ? error.message : 'Impersonation stop failed.')
        } finally {
            setSubmitting('')
        }
    }

    return { impersonationResult, impersonationMessage, submitImpersonation, stopImpersonation }
}
