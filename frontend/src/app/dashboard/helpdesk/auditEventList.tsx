import type { RefObject } from 'react'
import Link from 'next/link'
import { DashboardPanel } from '@/components/dashboard/ui'
import type { HelpdeskAuditEvent } from './audit'
import { auditDetailRows, auditQuietButtonClass, auditTargetName, auditDisplayText, formatAuditTime, outcomeClass, severityClass } from './auditPresentation'

export default function AuditEventList({ events, selectedEventId, filterCount, responseError, timeline, pendingEvent, acknowledgmentError, onSelectEvent, onAcknowledge }: {
    events: HelpdeskAuditEvent[]
    selectedEventId?: number
    filterCount: number
    responseError: string
    timeline: RefObject<HTMLDivElement | null>
    pendingEvent: number | null
    acknowledgmentError: { id: number, message: string } | null
    onSelectEvent: (id: number) => void
    onAcknowledge: (event: HelpdeskAuditEvent) => void
}) {
    return <>
        {responseError ? <DashboardPanel className='border-ui-warning/35 bg-ui-warning/10 p-4 text-sm text-ui-warning'>
            {responseError} Check API availability or narrow the query.
        </DashboardPanel> : null}
        <DashboardPanel className='overflow-hidden'>
            <div className='border-b border-ui-border px-4 py-3'>
                <div className='flex flex-wrap items-center gap-2'>
                    <h2 className='text-sm font-semibold text-ui-text'>Audit timeline</h2>
                    <span className='rounded-md bg-ui-raised px-2 py-1 text-xs font-medium text-ui-muted'>{events.length} events</span>
                </div>
            </div>
            <div className='grid max-h-[72vh] gap-0 divide-y divide-ui-border overflow-auto' ref={timeline}>
                {!events.length ? <div className='grid gap-3 p-5 text-sm text-ui-muted'>
                    <p className='font-medium text-ui-text'>No matching support events</p>
                    {filterCount ? <Link className={auditQuietButtonClass} href='/helpdesk'>Clear filters</Link> : null}
                </div> : events.map(event => <AuditEventRow
                    key={event.id}
                    event={event}
                    focused={selectedEventId === event.id}
                    pending={pendingEvent !== null}
                    saving={pendingEvent === event.id}
                    acknowledgmentError={acknowledgmentError?.id === event.id ? acknowledgmentError.message : ''}
                    onSelect={() => onSelectEvent(event.id)}
                    onAcknowledge={() => onAcknowledge(event)}
                />)}
            </div>
        </DashboardPanel>
    </>
}

function AuditEventRow({ event, focused, pending, saving, acknowledgmentError, onSelect, onAcknowledge }: {
    event: HelpdeskAuditEvent
    focused: boolean
    pending: boolean
    saving: boolean
    acknowledgmentError: string
    onSelect: () => void
    onAcknowledge: () => void
}) {
    return <article data-audit-event-id={event.id} data-helpdesk-focused-event={focused ? 'true' : undefined}>
        <button type='button' onClick={onSelect} aria-expanded={focused} aria-controls={`audit-detail-${event.id}`} className={`grid w-full gap-3 text-left p-4 transition hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-primary md:grid-cols-[minmax(0,1fr)_11rem] md:items-start ${focused ? 'bg-ui-primary/5 ring-1 ring-inset ring-ui-primary/25' : ''}`}>
            <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2 text-sm text-ui-text'>
                    <strong className='min-w-0 truncate'>{event.event_type}</strong>
                    {event.acknowledged_at ? <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass('success')}`}>Acknowledged</span> : null}
                    {focused ? <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold uppercase text-ui-primary'>Selected</span> : null}
                    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(event.severity)}`}>{event.severity}</span>
                    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(event.outcome)}`}>{event.outcome}</span>
                    <span className='rounded-md bg-ui-raised px-2 py-1 text-xs text-ui-muted'>{event.source}/{event.service}</span>
                </div>
                <div className='mt-2 flex flex-wrap gap-2 text-xs text-ui-muted'>
                    {event.actor_name || event.actor_id ? <span className='rounded-md bg-ui-raised px-2 py-1'>actor {event.actor_name ? auditDisplayText(event.actor_name) : event.actor_id}</span> : null}
                    {event.object_id || event.target_name || event.context?.targetId || event.context?.targetName ? <span className='rounded-md bg-ui-raised px-2 py-1'>{event.object_type || 'target'} {auditTargetName(event)}</span> : null}
                    {event.organization_id && !(event.object_type === 'organization' && event.object_id === event.organization_id) ? <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-ui-primary'>{event.organization_name ? auditDisplayText(event.organization_name, 'organization') : event.organization_id}</span> : null}
                    {event.subject_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>entity {event.subject_id}</span> : null}
                    {event.request_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                </div>
                {event.reason ? <p className='mt-2 text-sm text-ui-muted'>{auditDisplayText(event.reason, event.object_type || undefined)}</p> : null}
            </div>
            <div className='text-left text-xs text-ui-muted md:text-right'>
                <time dateTime={event.created_at} suppressHydrationWarning>{formatAuditTime(event.created_at)}</time>
                <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                <span className='mt-2 inline-flex rounded-md border border-ui-border px-2 py-1 font-semibold text-ui-text'>Details</span>
            </div>
        </button>
        <div id={`audit-detail-${event.id}`} hidden={!focused}>
            {focused ? <dl className='grid gap-2 border-t border-ui-border bg-ui-raised/50 px-4 py-3 text-xs text-ui-muted sm:grid-cols-2 lg:grid-cols-3' aria-label='Event details'>
                {auditDetailRows(event).map(([label, value]) => <div className='min-w-0' key={label}>
                    <dt className='font-semibold'>{label}</dt>
                    <dd className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-text'>{value}</dd>
                </div>)}
            </dl> : null}
            {focused ? <div className='flex flex-wrap items-center gap-3 border-t border-ui-border px-4 py-3'>
                <button type='button' disabled={pending} onClick={onAcknowledge} className={`${auditQuietButtonClass} disabled:opacity-50`}>
                    {saving ? 'Saving…' : event.acknowledged_at ? 'Mark unread' : 'Acknowledge'}
                </button>
                {event.acknowledged_at ? <span className='text-xs text-ui-muted'>Acknowledged by {event.acknowledged_by_name || event.acknowledged_by || 'an administrator'} · <time dateTime={event.acknowledged_at} suppressHydrationWarning>{formatAuditTime(event.acknowledged_at)}</time></span> : null}
                {acknowledgmentError ? <p role='alert' className='text-sm text-ui-text'>{acknowledgmentError}</p> : null}
            </div> : null}
        </div>
    </article>
}
