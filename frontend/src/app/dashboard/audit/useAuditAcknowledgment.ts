import { useCallback, useState } from 'react'
import { saveAuditAcknowledgment, type AuditAcknowledgment } from './acknowledgment'

export type AuditAcknowledgmentError = { id: number; message: string } | null
type SaveAcknowledgmentInput = {
    eventId: number
    acknowledged: boolean
    onSaved: (eventId: number, result: AuditAcknowledgment) => void
    setPendingEvent: (eventId: number | null) => void
    setAcknowledgmentError: (error: AuditAcknowledgmentError) => void
    errorFallback: string
}

export async function performAuditAcknowledgment(input: SaveAcknowledgmentInput) {
    const { eventId, acknowledged, onSaved, setPendingEvent, setAcknowledgmentError, errorFallback } = input
    setPendingEvent(eventId)
    setAcknowledgmentError(null)
    try {
        const result = await saveAuditAcknowledgment(eventId, acknowledged, 'Could not save acknowledgment.')
        onSaved(eventId, result)
    } catch (cause) {
        setAcknowledgmentError({ id: eventId, message: cause instanceof Error ? cause.message : errorFallback })
    } finally {
        setPendingEvent(null)
    }
}

export function useAuditAcknowledgment(onSaved: SaveAcknowledgmentInput['onSaved'], errorFallback: string) {
    const [pendingEvent, setPendingEvent] = useState<number | null>(null)
    const [acknowledgmentError, setAcknowledgmentError] = useState<AuditAcknowledgmentError>(null)

    const acknowledge = useCallback(async (eventId: number, acknowledged: boolean) => {
        if (pendingEvent !== null) return
        await performAuditAcknowledgment({
            eventId, acknowledged, onSaved, setPendingEvent, setAcknowledgmentError, errorFallback,
        })
    }, [errorFallback, onSaved, pendingEvent])

    return { pendingEvent, acknowledgmentError, acknowledge }
}
