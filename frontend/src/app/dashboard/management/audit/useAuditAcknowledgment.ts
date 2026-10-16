import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import config from '@/config'
import type { AuditEvent, AuditPage } from './data'

export default function useAuditAcknowledgment(setAudit: Dispatch<SetStateAction<AuditPage>>) {
    const [pendingEvent, setPendingEvent] = useState<number | null>(null)
    const [acknowledgmentError, setAcknowledgmentError] = useState<{ id: number, message: string } | null>(null)

    async function acknowledge(event: AuditEvent) {
        if (pendingEvent !== null) return
        setPendingEvent(event.id)
        setAcknowledgmentError(null)
        try {
            const response = await fetch(config.url.api + '/admin/audit-events/' + event.id + '/acknowledgment', {
                method: event.acknowledgedAt ? 'DELETE' : 'POST',
                headers: { Authorization: 'Bearer ' + (getCookie('access_token') || ''), id: getCookie('id') || '' },
            })
            const result = await response.json()
            if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Could not save acknowledgment.')
            setAudit(current => ({ ...current, events: current.events.map(item => item.id === event.id ? {
                ...item, acknowledgedAt: result.acknowledged_at || null, acknowledgedBy: result.acknowledged_by || null,
            } : item) }))
        } catch (cause) {
            setAcknowledgmentError({ id: event.id, message: cause instanceof Error ? cause.message : 'Could not save acknowledgment.' })
        } finally {
            setPendingEvent(null)
        }
    }

    return { pendingEvent, acknowledgmentError, acknowledge }
}
