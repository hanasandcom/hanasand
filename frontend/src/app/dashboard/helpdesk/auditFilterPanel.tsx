import type { RefObject } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { param, type AdminAuditEvent, type AuditSearchParams } from './audit'
import { activeFilterEntries, auditDisplayText, auditFieldClass, auditLimits, auditOutcomes, auditQuietButtonClass, auditSelectClass, auditSeverities, auditTargetName } from './auditPresentation'

type FilterEntry = ReturnType<typeof activeFilterEntries>[number]

export default function AuditFilterPanel({ params, events, responseError, notificationPanel, onSelectEvent }: {
    params: AuditSearchParams
    events: AdminAuditEvent[]
    responseError: string
    notificationPanel: RefObject<HTMLDetailsElement | null>
    onSelectEvent: (id: number, reveal?: boolean) => void
}) {
    const filterEntries = activeFilterEntries(params)
    const reviewEvents = events.filter(event => !event.acknowledged_at && (event.severity === 'critical' || event.outcome === 'denied' || event.outcome === 'failed'))
    const primarySearch = param(params, 'q')
    const advancedFilterCount = filterEntries.filter(([key]) => key !== 'q').length

    return <DashboardPanel className='p-4'>
        <form className='grid gap-3' action='/helpdesk'>
            <div className='grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center'>
                <label className='sr-only' htmlFor='audit-search'>Search audit events</label>
                <input id='audit-search' className={`${auditFieldClass} col-span-3 md:col-span-1`} name='q' defaultValue={primarySearch} placeholder='Search audit events' />
                <button className='h-9 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90' type='submit'>Search</button>
                <Link className={auditQuietButtonClass} href='/helpdesk'>Clear</Link>
                <details className='relative' ref={notificationPanel} onKeyDown={event => {
                    if (event.key === 'Escape') {
                        event.currentTarget.open = false
                        event.currentTarget.querySelector('summary')?.focus()
                    }
                }}>
                    <summary aria-label={`Notifications: ${reviewEvents.length} event${reviewEvents.length === 1 ? '' : 's'} to review`} className='flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text transition hover:border-ui-primary hover:bg-ui-panel [&::-webkit-details-marker]:hidden'>
                        <span className='relative inline-flex'>
                            <Bell size={24} aria-hidden='true' />
                            {reviewEvents.length ? <span aria-hidden='true' className='absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-ui-danger/40 bg-ui-raised px-1 text-[10px] font-semibold leading-none text-ui-text'>{reviewEvents.length}</span> : null}
                        </span>
                    </summary>
                    <div className='absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-lg border border-ui-border bg-ui-panel p-3 shadow-lg' aria-label='Audit notifications'>
                        <h2 className='mb-3 text-sm font-semibold text-ui-text'>Notifications</h2>
                        <div className='grid max-h-72 gap-2 overflow-auto'>
                            {responseError ? <p className='text-sm text-ui-warning'>Events could not be loaded.</p> : reviewEvents.length ? reviewEvents.map(event => (
                                <button type='button' key={event.id} onClick={() => onSelectEvent(event.id, true)} className='grid gap-1 rounded-md border border-ui-border p-2 text-left text-sm hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                    <span className='font-semibold text-ui-text'>{event.event_type}</span>
                                    <span className='text-xs text-ui-warning'>{event.severity} · {event.outcome}</span>
                                    <span className='wrap-break-word text-xs text-ui-muted'>{auditTargetName(event) || auditDisplayText(event.reason)}</span>
                                </button>
                            )) : <p className='text-sm text-ui-muted'>No unread notifications.</p>}
                        </div>
                    </div>
                </details>
            </div>
            <details className='group rounded-lg border border-ui-border bg-ui-raised'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                    <span>Filters{advancedFilterCount ? ` (${advancedFilterCount})` : ''}</span>
                    <span className='text-xs font-medium text-ui-muted group-open:hidden'>Refine timeline</span>
                    <span className='hidden text-xs font-medium text-ui-muted group-open:inline'>Hide filters</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3'>
                    <div className='grid gap-2 lg:grid-cols-4'>
                        <input className={auditFieldClass} name='org' defaultValue={param(params, 'org')} placeholder='Organization' />
                        <input className={auditFieldClass} name='actor' defaultValue={param(params, 'actor')} placeholder='Actor' />
                        <input className={auditFieldClass} name='target' defaultValue={param(params, 'target')} placeholder='Target' />
                        <input className={auditFieldClass} name='action' defaultValue={param(params, 'action')} placeholder='Action type' />
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                        <input className={auditFieldClass} name='source' defaultValue={param(params, 'source')} placeholder='Source' />
                        <input className={auditFieldClass} name='service' defaultValue={param(params, 'service')} placeholder='Service' />
                        <input className={auditFieldClass} name='entity' defaultValue={param(params, 'entity')} placeholder='Entity id' />
                        <input className={auditFieldClass} name='request' defaultValue={param(params, 'request')} placeholder='Request id' />
                    </div>
                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_9rem_8rem_auto] lg:items-center'>
                        <select className={auditSelectClass} name='severity' defaultValue={param(params, 'severity').toLowerCase()}>
                            {auditSeverities.map(severity => <option key={severity} value={severity}>{severity || 'Severity'}</option>)}
                        </select>
                        <select className={auditSelectClass} name='outcome' defaultValue={param(params, 'outcome').toLowerCase()}>
                            {auditOutcomes.map(outcome => <option key={outcome} value={outcome}>{outcome || 'Outcome'}</option>)}
                        </select>
                        <input className={auditFieldClass} name='from' defaultValue={param(params, 'from')} type='datetime-local' aria-label='From' />
                        <input className={auditFieldClass} name='to' defaultValue={param(params, 'to')} type='datetime-local' aria-label='To' />
                        <select className={auditSelectClass} name='limit' defaultValue={param(params, 'limit') || '200'} aria-label='Result limit'>
                            {auditLimits.map(limit => <option key={limit} value={limit}>{limit}</option>)}
                        </select>
                        <button className='h-9 rounded-md border border-ui-border px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel' type='submit'>Apply filters</button>
                    </div>
                </div>
            </details>
            {filterEntries.length ? <div className='flex flex-wrap gap-2 border-t border-ui-border pt-3' aria-label='Active audit filters'>
                {filterEntries.map(([key, value]: FilterEntry) => <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs text-ui-muted' key={key}>{key}: {value}</span>)}
            </div> : null}
        </form>
    </DashboardPanel>
}
