import type { ReactNode } from 'react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { formatOsloShortDateTime } from '@/utils/date/formatOsloShortDateTime'
import type { AuditEvent } from './data'

export function Metric({ title, value, icon, tone = 'neutral' }: {
    title: string
    value: string
    icon: ReactNode
    tone?: 'neutral' | 'ok' | 'watch' | 'bad'
}) {
    return <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
        <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
            <p className='text-[10px] font-semibold text-ui-muted'>{title}</p>
            {icon}
        </div>
        <p className='mt-2 truncate text-lg font-semibold text-ui-text'>{value}</p>
    </DashboardPanel>
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/15', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/15', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-raised/15', text: 'text-ui-text' }
    return { bg: 'bg-ui-primary/15', text: 'text-ui-primary' }
}

export const compactTime = formatOsloShortDateTime

export function isFailed(event: AuditEvent) {
    return !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase())
}

export function AuditRows({ event, open, pending, acknowledgmentError, toggle, acknowledge }: {
    event: AuditEvent
    open: boolean
    pending: boolean
    acknowledgmentError: string
    toggle: () => void
    acknowledge: () => void
}) {
    return <>
        <tr id={`event-${event.id}`} className='align-top hover:bg-ui-raised'>
            <td colSpan={7} className='border-b border-ui-border p-0'>
                <button type='button' onClick={toggle} aria-expanded={open} className='grid w-full grid-cols-[minmax(8rem,1fr)_minmax(5rem,.7fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_auto] gap-3 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    <span>{compactTime(event.happenedAt)}</span>
                    <span>{event.service}</span>
                    <span>{event.actor}</span>
                    <span>{event.action}</span>
                    <span>{event.target}</span>
                    <span><StatusPill label={event.result} tone={isFailed(event) ? 'bad' : 'ok'} /></span>
                    <span className='col-span-full text-ui-muted'>{event.detail}</span>
                </button>
            </td>
        </tr>
        {open ? <tr>
            <td colSpan={7} className='border-b border-ui-border bg-ui-raised/50 px-4 py-3'>
                <dl className='grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4'>
                    <div><dt>Actor ID</dt><dd>{event.actorId}</dd></div>
                    <div><dt>Target</dt><dd>{event.targetName || event.target}</dd></div>
                    <div><dt>Organization</dt><dd>{event.organization}</dd></div>
                    <div><dt>Entity</dt><dd>{event.entity}</dd></div>
                    <div><dt>Request</dt><dd>{event.request}</dd></div>
                    <div><dt>Source</dt><dd>{event.source}/{event.service}</dd></div>
                    <div><dt>IP</dt><dd>{event.ip}</dd></div>
                    <div><dt>Details</dt><dd>{event.detail}</dd></div>
                </dl>
                <button type='button' disabled={pending} onClick={acknowledge} className='mt-3 rounded-md border border-ui-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50'>
                    {pending ? 'Saving…' : event.acknowledgedAt ? 'Mark unread' : 'Acknowledge'}
                </button>
                {event.acknowledgedAt ? <span className='ml-3 text-xs text-ui-muted'>Acknowledged by {event.acknowledgedByName || event.acknowledgedBy || 'an administrator'}</span> : null}
                {acknowledgmentError ? <p role='alert' className='mt-2 text-xs text-ui-text'>{acknowledgmentError}</p> : null}
            </td>
        </tr> : null}
    </>
}
