import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { saveAuditAcknowledgment } from '../../audit/acknowledgment'
import type { AuditEvent, AuditPage } from './data'

export default function useAuditAcknowledgment(setAudit: Dispatch<SetStateAction<AuditPage>>) {
    const [pendingEvent, setPendingEvent] = useState<number | null>(null)
    const [acknowledgmentError, setAcknowledgmentError] = useState<{ id: number, message: string } | null>(null)

    async function acknowledge(event: AuditEvent) {
        if (pendingEvent !== null) return
        setPendingEvent(event.id)
        setAcknowledgmentError(null)
        try {
            const result = await saveAuditAcknowledgment(event.id, Boolean(event.acknowledgedAt), 'Could not save acknowledgment.')
            setAudit(current => ({ ...current, events: current.events.map(item => item.id === event.id ? {
                ...item, acknowledgedAt: result.acknowledgedAt, acknowledgedBy: result.acknowledgedBy,
            } : item) }))
        } catch (cause) {
            setAcknowledgmentError({ id: event.id, message: cause instanceof Error ? cause.message : 'Could not save acknowledgment.' })
        } finally {
            setPendingEvent(null)
        }
    }

    return { pendingEvent, acknowledgmentError, acknowledge }
}
