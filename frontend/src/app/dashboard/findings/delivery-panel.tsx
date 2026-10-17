import Link from '@/components/organizations/workspaceLink'
import { Loader2, RotateCcw, Send } from 'lucide-react'
import { safeEvidenceExcerpt } from '@/utils/dwm/display'
import type { PortalAlert, DeliveryItem } from './types'
import { caseDetailHref, deliveryClass, relativeTimeLabel, retryStateLabel, stateLabel } from './case-format'
import { alertOrganizationId } from './portal-data'
import { orderDeliveries } from '../deliveryOrdering'

const DWM_DELIVERY_PREVIEW_ROWS = 3

export function DeliveryPanel({ organizationId, alert, deliveries, busyAction, onTest, onSend }: { organizationId?: string, alert?: PortalAlert, deliveries: DeliveryItem[], busyAction: string | null, onTest: (alertId: string) => Promise<void>, onSend: (alertId: string) => Promise<void> }) {
    const visible = orderDeliveries(alert ? deliveries.filter(delivery => delivery.alertId === alert.id || delivery.alertId === 'webhook_test') : deliveries)
    const orgId = alert ? alertOrganizationId(alert, organizationId) : organizationId
    const caseId = alert ? alertCaseId(alert) : undefined
    const caseHref = alert && caseId ? caseDetailHref(caseId, alert.id, orgId, 'delivery_history') : undefined
    const latestDelivery = visible[0]
    const lastFailedDelivery = visible.find(delivery => delivery.status === 'failed')
    const lastSuccessfulDelivery = visible.find(delivery => delivery.status === 'delivered' && delivery.dryRun !== true)
    const orgHref = organizationDeliveryWorkspaceHref({ organizationId: orgId })
    const testBusy = alert ? busyAction === `test:${alert.id}` : false
    const sendBusy = alert ? busyAction === `send:${alert.id}` : false
    if (!orgId) {
        return (
            <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-6 text-center'>
                <h2 className='text-base font-semibold text-ui-text'>Create an organization to set up integrations</h2>
                <p className='mx-auto max-w-md text-sm leading-6 text-ui-muted'>Send events and case updates to the tools your organization already uses.</p>
                <div><Link href='/organizations' className='inline-flex min-h-9 items-center rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'>Create organization</Link></div>
                <div className='grid gap-2 text-left sm:grid-cols-3'>
                    {['Slack', 'Microsoft Teams', 'Webhook'].map(preset => <Link key={preset} href='/organizations' className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted'>{preset}<span className='mt-1 block font-normal'>Available after setup</span></Link>)}
                </div>
            </section>
        )
    }
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-col gap-3 border-b border-ui-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <h3 className='text-sm font-semibold text-ui-text'>Customer delivery</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Webhook attempts, retry state, and linked case context.</p>
                </div>
                <div className='flex shrink-0 flex-wrap gap-2' data-dwm-delivery-panel-actions='true'>
                    <button type='button' disabled={!alert || testBusy || sendBusy} onClick={() => alert ? void onTest(alert.id) : undefined} className='inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas disabled:cursor-not-allowed disabled:opacity-60'>
                        {testBusy ? <Loader2 className='h-4 w-4 animate-spin' /> : <RotateCcw className='h-4 w-4' />}
                        Test
                    </button>
                    <button type='button' disabled={!alert || testBusy || sendBusy} onClick={() => alert ? void onSend(alert.id) : undefined} className='inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                        {sendBusy ? <Loader2 className='h-4 w-4 animate-spin' /> : latestDelivery?.status === 'failed' ? <RotateCcw className='h-4 w-4' /> : <Send className='h-4 w-4' />}
                        {latestDelivery?.status === 'failed' ? 'Retry' : 'Send'}
                    </button>
                </div>
            </div>
            <div className='grid gap-2 p-3'>
                <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs sm:grid-cols-3' data-dwm-delivery-latest='true'>
                    <DeliveryFact label='Last attempt' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : 'No delivery yet'} tone={latestDelivery?.status === 'failed' ? 'bad' : latestDelivery ? 'good' : 'neutral'} />
                    <DeliveryFact label='Last success' value={lastSuccessfulDelivery ? `${stateLabel(lastSuccessfulDelivery.status)} · ${relativeTimeLabel(lastSuccessfulDelivery.attemptedAt)}` : 'Not recorded'} />
                    <DeliveryFact label='Needs review' value={lastFailedDelivery ? `${stateLabel(lastFailedDelivery.status)} · ${relativeTimeLabel(lastFailedDelivery.attemptedAt)}` : 'No failed attempt'} tone={lastFailedDelivery ? 'warn' : 'neutral'} />
                </div>
                <div className='grid grid-cols-2 gap-2 text-[11px]'>
                    <a href={orgHref} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-text transition hover:bg-ui-canvas'>
                        Destinations
                        <span className='mt-0.5 block truncate font-normal text-ui-muted'>{organizationScopeLabel(orgId)}</span>
                    </a>
                    {caseHref ? (
                        <a href={caseHref} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-text transition hover:bg-ui-canvas'>
                            Case trail
                            <span className='mt-0.5 block truncate font-normal text-ui-muted'>{caseLinkLabel(caseId)}</span>
                        </a>
                    ) : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-muted'>
                            Case trail
                            <span className='mt-0.5 block font-normal'>Open a case to attach delivery audit.</span>
                        </div>
                    )}
                </div>
                <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'>
                    <div>
                        <p className='text-sm font-semibold text-ui-text'>Integration presets</p>
                        <p className='mt-1 text-xs text-ui-muted'>Start with a common destination, then test it before sending events.</p>
                    </div>
                    <div className='grid gap-2 sm:grid-cols-3'>
                        {['Slack', 'Microsoft Teams', 'Webhook'].map(preset => <a key={preset} href={orgHref} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>{preset}<span className='mt-1 block font-normal text-ui-muted'>Open delivery setup</span></a>)}
                    </div>
                </div>
                {visible.slice(0, DWM_DELIVERY_PREVIEW_ROWS).map(delivery => {
                    const deliveryOrgHref = organizationDeliveryWorkspaceHref({ organizationId: orgId })
                    return (
                        <div key={delivery.id} className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <span className={deliveryClass(delivery.status)}>{stateLabel(delivery.status)}</span>
                                <div className='flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-semibold text-ui-muted'>
                                    <span>{relativeTimeLabel(delivery.attemptedAt)}</span>
                                    <span className='rounded-full border border-ui-border px-1.5 py-0.5'>{delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'send'}</span>
                                </div>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-[11px] text-ui-muted'>
                                <p><span className='font-semibold text-ui-muted'>HTTP:</span> {delivery.httpStatus ?? (delivery.dryRun ? 'dry run' : 'pending')}</p>
                                <p><span className='font-semibold text-ui-muted'>Attempt:</span> {delivery.attemptCount ?? 1}</p>
                                <p className='col-span-2 wrap-break-word'><span className='font-semibold text-ui-muted'>Destination:</span> {delivery.endpointHint || delivery.endpointHash ? 'configured destination' : delivery.webhookDestinationId || delivery.destinationId ? 'saved destination' : 'redacted destination'}</p>
                                <p><span className='font-semibold text-ui-muted'>Request:</span> {delivery.requestId || delivery.auditEventId ? 'linked' : 'pending'}</p>
                                <p><span className='font-semibold text-ui-muted'>Alert:</span> {delivery.dedupeKey ? 'deduplicated' : 'pending'}</p>
                                <p><span className='font-semibold text-ui-muted'>Payload:</span> {delivery.payloadHash ? 'signed' : 'pending'}</p>
                                <p><span className='font-semibold text-ui-muted'>Retry:</span> {delivery.nextRetryAt ? relativeTimeLabel(delivery.nextRetryAt) : retryStateLabel(delivery)}</p>
                                <p><span className='font-semibold text-ui-muted'>Audit:</span> {delivery.auditEventId || 'pending'}</p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-[11px] font-semibold'>
                                <a href={deliveryOrgHref} className='inline-flex h-7 items-center rounded-lg border border-ui-border bg-ui-panel px-2 text-ui-text transition hover:bg-ui-canvas'>Manage destination</a>
                                {caseHref ? <a href={caseHref} className='inline-flex h-7 items-center rounded-lg border border-ui-border bg-ui-panel px-2 text-ui-text transition hover:bg-ui-canvas'>Open case trail</a> : null}
                            </div>
                            {(delivery.error || delivery.errorClass) && <p className='rounded-lg border border-ui-danger/35 bg-ui-raised/10 px-2 py-1.5 text-xs text-ui-text'>{delivery.error ? safeEvidenceExcerpt(delivery.error) : stateLabel(delivery.errorClass || 'delivery failed')}</p>}
                        </div>
                    )
                })}
                {!visible.length && (
                    <div className='grid gap-3 rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center' data-dwm-delivery-empty='true'>
                        <div className='min-w-0'>
                            <p className='text-sm font-semibold text-ui-text'>No delivery attempt yet</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>Configure or test a destination before sending this event to a customer process.</p>
                        </div>
                        <a href={orgHref} className='inline-flex min-h-9 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas'>
                            Configure delivery
                        </a>
                    </div>
                )}
            </div>
        </section>
    )
}

function DeliveryFact({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
    const toneClass = tone === 'good'
        ? 'text-ui-success'
        : tone === 'warn'
            ? 'text-ui-warning'
            : tone === 'bad'
                ? 'text-ui-text'
                : 'text-ui-text'
    return (
        <div className='min-w-0'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-1 truncate font-semibold ${toneClass}`}>{value}</p>
        </div>
    )
}


export function alertCaseId(alert: PortalAlert) {
    return alert.caseId || alert.workflowContext?.caseId || alert.webhookContext?.caseId
}

function organizationScopeLabel(value?: string | null) {
    return value ? 'Organization workspace' : 'Default workspace'
}

function caseLinkLabel(value?: string | null) {
    return value ? 'Case linked' : 'Case pending'
}

export function organizationDeliveryWorkspaceHref(input: { organizationId?: string }) {
    return input.organizationId
        ? `/findings/actions?org=${encodeURIComponent(input.organizationId)}`
        : '/findings/actions'
}
