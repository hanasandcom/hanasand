import Link from '@/components/organizations/workspaceLink'
import { Send } from 'lucide-react'
import type { RefObject } from 'react'
import { RouteQueueCard, type RouteQueueAction } from './workflow-route-card'
import { RouteRunSummary } from './workflow-route-summary'
import { RouteStateCard, WorkflowButton } from './workflow-controls'
import type { WorkflowResult, WorkflowRouteSummary } from './workflow-types'

export function WorkflowRouteDashboard({ heading: Heading, values, result, routeQueue, endpoint, endpointRef, onEndpointChange, onTest, onSend, busyAction, busy, testDisabledReason, sendDisabledReason, lastRoute, organizationId }: {
    heading: 'h1' | 'h2'
    values: { terms: number, termsTone: 'ok' | 'warn', sources: string, sourceTone: 'ok' | 'warn', captures: string, captureDetail: string, captureTone: 'ok' | 'neutral', alerts: string, alertDetail: string, alertTone: 'ok' | 'warn' | 'neutral', webhook: string, webhookDetail: string, webhookTone: 'ok' | 'warn', routeTitle: string, routeDetail: string }
    result: WorkflowResult | null
    routeQueue: RouteQueueAction[]
    endpoint: string
    endpointRef: RefObject<HTMLInputElement | null>
    onEndpointChange: (value: string) => void
    onTest: () => void
    onSend: () => void
    busyAction: string | null
    busy: boolean
    testDisabledReason: string
    sendDisabledReason: string
    lastRoute: WorkflowRouteSummary | null
    organizationId?: string
}) {
    return <>
        <section className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.62fr)] lg:items-start'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold uppercase text-ui-primary'>Monitoring workflow</p>
                <Heading className='mt-1 text-lg font-semibold tracking-normal text-ui-text'>Watchlist to case</Heading>
                <div className='mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5'>
                    <RouteStateCard label='Terms' value={String(values.terms)} detail={values.terms ? 'ready' : 'needed'} tone={values.termsTone} />
                    <RouteStateCard label='Sources' value={values.sources} detail={values.sources === '0/0' ? 'none configured' : 'executable'} tone={values.sourceTone} />
                    <RouteStateCard label='Captures' value={values.captures} detail={values.captureDetail} tone={values.captureTone} />
                    <RouteStateCard label='Alerts' value={values.alerts} detail={values.alertDetail} tone={values.alertTone} />
                    <RouteStateCard label='Webhook' value={values.webhook} detail={values.webhookDetail} tone={values.webhookTone} />
                </div>
            </div>
            {result ? <div data-dwm-workflow-result className={`rounded-lg border px-3 py-2 text-sm leading-5 ${result.ok ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'}`}>
                <p className='font-semibold'>{result.ok ? 'Workflow updated' : 'Action blocked'}</p>
                <p className='mt-1 text-xs leading-5'>{result.message}</p>
                {result.actionHref && result.actionLabel ? <Link href={result.actionHref} className='mt-2 inline-flex min-h-8 items-center rounded-lg border border-current px-3 text-xs font-semibold transition hover:opacity-80' data-dwm-workflow-result-action='true'>{result.actionLabel}</Link> : null}
            </div> : <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                <p className='text-[10px] font-semibold uppercase text-ui-subtle'>Route state</p>
                <p className='mt-1 text-sm font-semibold text-ui-text'>{values.routeTitle}</p>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>{values.routeDetail}</p>
            </div>}
        </section>
        <section data-dwm-route-queue className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-start justify-between gap-3'><div className='min-w-0'><h3 className='text-sm font-semibold text-ui-text'>Commands</h3><p className='mt-0.5 text-xs leading-5 text-ui-subtle'>Manage your watchlist, collect updates and send events.</p></div></div>
            <div className='mt-3 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3'>{routeQueue.map(action => <RouteQueueCard key={action.id} action={action} />)}</div>
            <div id='dwm-inline-webhook' data-dwm-inline-webhook className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end'>
                <label className='min-w-0'><span className='text-[10px] font-semibold uppercase text-ui-subtle'>Delivery endpoint</span><input ref={endpointRef} value={endpoint} onChange={event => onEndpointChange(event.target.value)} placeholder='https://discord.com/api/webhooks/...' className='mt-1 h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' /></label>
                <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busy || Boolean(testDisabledReason)} disabledReason={testDisabledReason || undefined} icon={<Send className='h-4 w-4' />} onClick={onTest}>Test destination</WorkflowButton>
                <WorkflowButton busy={busyAction === 'delivery'} disabled={busy || Boolean(sendDisabledReason)} disabledReason={sendDisabledReason || undefined} icon={<Send className='h-4 w-4' />} onClick={onSend}>Send queued</WorkflowButton>
                <p className='text-xs leading-5 text-ui-subtle lg:col-span-3'>{endpoint.trim() ? 'Test saves a delivery attempt without sending externally.' : 'Add an HTTPS Discord or webhook endpoint before testing customer delivery.'}</p>
            </div>
            {lastRoute ? <RouteRunSummary route={lastRoute} organizationId={organizationId} /> : null}
        </section>
    </>
}
