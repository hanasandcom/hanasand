import { Copy, Loader2, RotateCcw, Send } from 'lucide-react'
import type { CaseDetailLoadState, CaseExport } from './contracts'
import type { DeliveryRow, ReceiverReceipt } from './evidenceTypes'
import { deliveryDestinationState, queryString, relativeTime, stateLabel } from './model'
import { CollapsiblePanel, CommandLink, EmptyLine, KeyValue } from './presentation'
import { findingsActionsHref } from '../../../findings/findings-routes'

export function CaseDeliveryPanel({ organizationId, alertId, state, latestDelivery, latestReceiverReceipt, selectedDestinationId, setSelectedDestinationId, readOnly, busy, webhookBlockedReason, onSendWebhook }: {
    organizationId?: string
    alertId?: string
    state: CaseDetailLoadState
    latestDelivery?: DeliveryRow
    latestReceiverReceipt?: ReceiverReceipt
    selectedDestinationId: string
    setSelectedDestinationId: (id: string) => void
    readOnly: boolean
    busy: string | null
    webhookBlockedReason?: string
    onSendWebhook: (dryRun: boolean) => void
}) {
    const latestDeliveryRetryable = latestDelivery?.status === 'failed' && latestDelivery.retryable === true
    const disabled = Boolean(readOnly || busy !== null || webhookBlockedReason)
    return (
        <CollapsiblePanel title='Third-party report delivery' action={state.detail?.deliveryContext?.retryable ? 'retryable' : latestDelivery?.status || 'pending'} defaultOpen>
            {state.deliveryError ? <p className='mb-3 rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-2 text-xs text-ui-text'>{state.deliveryError}</p> : null}
            {state.receiverError ? <p className='mb-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-2 text-xs text-ui-warning'>{state.receiverError}</p> : null}
            {state.destinationError ? <p className='mb-3 rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-2 text-xs text-ui-text'>{state.destinationError}</p> : null}
            <label className='mb-3 grid gap-1 text-xs font-semibold text-ui-muted'>
                External receiver
                <select value={selectedDestinationId} onChange={event => setSelectedDestinationId(event.target.value)} disabled={readOnly || busy !== null || latestDeliveryRetryable} className='h-9 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text disabled:cursor-not-allowed disabled:opacity-60'>
                    <option value=''>Select one configured receiver</option>
                    {(state.destinations || []).map(destination => <option key={destination.id} value={destination.id}>{destination.name || destination.endpointHint || destination.id}{destination.kind ? ` · ${destination.kind}` : ''}</option>)}
                </select>
            </label>
            {latestDelivery ? <div className='grid gap-2 text-xs text-ui-muted'>
                <KeyValue label='Status' value={stateLabel(latestDelivery.status)} />
                <KeyValue label='Attempted' value={relativeTime(latestDelivery.attemptedAt)} />
                <KeyValue label='Endpoint' value={deliveryDestinationState(latestDelivery)} />
                <KeyValue label='Dedupe' value={latestDelivery.dedupeKey ? 'dedupe linked' : 'pending'} />
                <div className='grid gap-2 sm:grid-cols-2'>
                    <KeyValue label='Request' value={latestDelivery.requestId || latestDelivery.auditEventId ? 'request linked' : 'pending'} />
                    <KeyValue label='Retry' value={latestDelivery.nextRetryAt ? relativeTime(latestDelivery.nextRetryAt) : latestDelivery.errorClass ? stateLabel(latestDelivery.errorClass) : `${latestDelivery.attemptCount ?? latestDelivery.retryCount ?? 0} attempts`} />
                </div>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <KeyValue label='Mode' value={latestDelivery.dryRun ? 'Dry run' : latestDelivery.httpStatus ? `HTTP ${latestDelivery.httpStatus}` : 'queued'} />
                    <KeyValue label='Case link' value='case linked' />
                </div>
                <KeyValue label='Hanasand receiver receipt' value={latestReceiverReceipt ? `stored ${relativeTime(latestReceiverReceipt.receivedAt || latestReceiverReceipt.persistedAt)}` : 'not recorded'} />
                {latestDelivery.error ? <p className='rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-2 text-ui-text'>{latestDelivery.error}</p> : null}
            </div> : <EmptyLine text='No webhook delivery attempt is attached to this case.' />}
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                <CommandLink href={findingsActionsHref(organizationId)}>Manage destination</CommandLink>
                <CommandLink href={`/findings/delivery${queryString({ org: organizationId, alert: alertId })}`}>Delivery history</CommandLink>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                <button type='button' onClick={() => onSendWebhook(true)} disabled={disabled} title={webhookBlockedReason || undefined} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
                    {busy === 'webhook-test' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RotateCcw className='h-4 w-4' />}Test STIX report
                </button>
                <button type='button' onClick={() => onSendWebhook(false)} disabled={disabled} title={webhookBlockedReason || undefined} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                    {busy === 'webhook-send' ? <Loader2 className='h-4 w-4 animate-spin' /> : latestDeliveryRetryable ? <RotateCcw className='h-4 w-4' /> : <Send className='h-4 w-4' />}{latestDeliveryRetryable ? 'Retry exact report' : 'Send STIX report'}
                </button>
            </div>
            {webhookBlockedReason ? <p className='mt-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-xs leading-5 text-ui-warning' data-dwm-webhook-action-blocker='true'>{webhookBlockedReason}</p> : null}
        </CollapsiblePanel>
    )
}

export function CaseReportPanel({ selectedEvidenceIds, exportPayload, alertDedupeKey, reportJsonHref, reportStixHref, copySummary }: {
    selectedEvidenceIds: string[]
    exportPayload?: CaseExport
    alertDedupeKey?: string
    reportJsonHref: string
    reportStixHref: string
    copySummary: () => void
}) {
    return (
        <CollapsiblePanel title='Case and evidence report' action={selectedEvidenceIds.length ? `${selectedEvidenceIds.length} selected` : 'selection required'}>
            <div className='grid gap-2 text-xs text-ui-muted'>
                <KeyValue label='Checksum' value={exportPayload?.exportChecksum ? 'export checksum linked' : 'not available'} />
                <KeyValue label='Dedupe' value={exportPayload?.summary?.dedupeKey || alertDedupeKey ? 'dedupe linked' : 'pending'} />
                <div className='grid gap-2 sm:grid-cols-2'>
                    {selectedEvidenceIds.length ? <CommandLink href={reportJsonHref}>Export JSON report</CommandLink> : <span className='inline-flex h-9 items-center rounded-lg border border-ui-border px-3 text-xs font-semibold text-ui-muted opacity-60'>Select evidence for JSON</span>}
                    {selectedEvidenceIds.length ? <CommandLink href={reportStixHref}>Export STIX 2.1</CommandLink> : <span className='inline-flex h-9 items-center rounded-lg border border-ui-border px-3 text-xs font-semibold text-ui-muted opacity-60'>Select evidence for STIX</span>}
                </div>
                <button type='button' onClick={copySummary} disabled={!exportPayload?.copyText} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
                    <Copy className='h-4 w-4' />Copy summary
                </button>
            </div>
        </CollapsiblePanel>
    )
}
