import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useAuditAcknowledgment as useAcknowledgmentLifecycle } from '../../audit/useAuditAcknowledgment'
import type { AuditAcknowledgment } from '../../audit/acknowledgment'
import { updateAuditAcknowledgment, type AuditEvent, type AuditPage } from './data'

export default function useAuditAcknowledgment(setAudit: Dispatch<SetStateAction<AuditPage>>) {
    const onSaved = useCallback((eventId: number, result: AuditAcknowledgment) => {
        setAudit(current => updateAuditAcknowledgment(current, eventId, result))
    }, [setAudit])
    const lifecycle = useAcknowledgmentLifecycle(onSaved, 'Could not save acknowledgment.')
    const acknowledge = useCallback((event: AuditEvent) => lifecycle.acknowledge(event.id, Boolean(event.acknowledgedAt)), [lifecycle.acknowledge])
    return { ...lifecycle, acknowledge }
}
