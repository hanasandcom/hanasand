import { useState, type SyntheticEvent, type Dispatch, type SetStateAction } from 'react'
import { minimumAuditReasonMessage, supportReasonIsSpecific } from './shared'
import type { InspectionPayload } from './types'

export function useInspectionActions(setSubmitting: Dispatch<SetStateAction<string>>) {
    const [inspectionResult, setInspectionResult] = useState<InspectionPayload | null>(null)
    const [inspectionMessage, setInspectionMessage] = useState<string>('')

    async function submitInspection(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const targetType = String(form.get('targetType') || 'organization')
        const targetId = String(form.get('targetId') || '').trim()
        const reason = String(form.get('reason') || '').trim()
        const context = String(form.get('context') || '').trim()
        if (!supportReasonIsSpecific(reason)) {
            setInspectionMessage(minimumAuditReasonMessage)
            return
        }
        const query = new URLSearchParams()
        if (reason) query.set('reason', reason)
        if (context) query.set('context', context)
        const path = targetType === 'user'
            ? `/api/backend/admin/support/users/${encodeURIComponent(targetId)}`
            : `/api/backend/admin/support/organizations/${encodeURIComponent(targetId)}`

        setSubmitting('inspect')
        setInspectionMessage('')
        setInspectionResult(null)
        try {
            const response = await fetch(`${path}${query.toString() ? `?${query}` : ''}`)
            const body = await response.json().catch(() => ({})) as InspectionPayload
            if (!response.ok) {
                setInspectionMessage(body.error || 'Inspection failed.')
                setInspectionResult(body)
                return
            }
            setInspectionResult(body)
            setInspectionMessage(`${targetType === 'user' ? 'User' : 'Organization'} inspection loaded.`)
        } catch (error) {
            setInspectionMessage(error instanceof Error ? error.message : 'Inspection failed.')
        } finally {
            setSubmitting('')
        }
    }

    return { inspectionResult, inspectionMessage, submitInspection }
}
