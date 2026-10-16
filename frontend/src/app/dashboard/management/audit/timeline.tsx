'use client'

import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AlertTriangle, ClipboardList, Clock3 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { param, type AuditPage, type AuditSearchParams } from './data'
import useAuditTimeline from './useAuditTimeline'
import useAuditAcknowledgment from './useAuditAcknowledgment'
import AuditTimelinePanel from './auditTimelinePanel'
import { compactTime, Metric } from './timelineRows'

export default function AuditTimeline({ initialAudit, filters }: { initialAudit: AuditPage, filters: AuditSearchParams }) {
    const model = useAuditTimeline(initialAudit, filters)
    const acknowledgment = useAuditAcknowledgment(model.setAudit)
    const timeline = <AuditTimelinePanel
        model={model}
        pendingEvent={acknowledgment.pendingEvent}
        acknowledgmentError={acknowledgment.acknowledgmentError}
        onAcknowledge={acknowledgment.acknowledge}
    />

    return <DashboardPage>
        <div className={model.fullscreen ? 'hidden' : 'contents'}>
            <DashboardHeader
                eyebrow='Management'
                title='Audit log'
                description='Audit events across all services, including account access, infrastructure, and threat intelligence.'
            />
            {!model.queryResult && model.analyticsOpen ? <div className='grid gap-2 sm:grid-cols-3'>
                <Metric title='Events' value={`${model.sortedEvents.length}/${model.audit.total ?? '—'}`} icon={<ClipboardList className='h-4 w-4' />} />
                <Metric title='Failures' value={`${model.failedCount}`} tone={model.failedCount ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Last action' value={model.lastEvent ? compactTime(model.lastEvent.happenedAt) : '—'} icon={<Clock3 className='h-4 w-4' />} />
            </div> : null}
            <div id='audit-filters' hidden={!model.filtersOpen}>
                <DashboardPanel className='p-3'>
                    <form className='grid gap-2 sm:grid-cols-2 lg:grid-cols-8' action='/management/audit'>
                        <input type='hidden' name='q' value={param(model.activeFilters, 'q')} />
                        <input type='hidden' name='hql' value={param(model.activeFilters, 'hql')} />
                        <input aria-label='Service' className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='service' defaultValue={param(filters, 'service')} placeholder='All services' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='actor' defaultValue={param(filters, 'actor')} placeholder='Actor' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='action' defaultValue={param(filters, 'action')} placeholder='Action' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='target' defaultValue={param(filters, 'target')} placeholder='Target' />
                        <select className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='outcome' defaultValue={param(filters, 'outcome')}>
                            <option value=''>Any result</option><option value='success'>Success</option><option value='denied'>Denied</option><option value='failed'>Failed</option>
                        </select>
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='from' defaultValue={param(filters, 'from')} placeholder='From (ISO time)' />
                        <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='to' defaultValue={param(filters, 'to')} placeholder='To (ISO time)' />
                        <div className='flex gap-2'>
                            <button className='h-9 flex-1 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary' type='submit'>Filter</button>
                            <Link className='grid h-9 place-items-center rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text' href='/management/audit'>Clear</Link>
                        </div>
                    </form>
                </DashboardPanel>
            </div>
        </div>
        {model.fullscreen && model.dialog.current ? createPortal(timeline, model.dialog.current) : timeline}
        <dialog ref={model.dialog} aria-label='Fullscreen audit timeline' onCancel={event => {
            event.preventDefault()
            model.toggleFullscreen()
        }} className='fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ui-panel p-0 text-ui-text backdrop:bg-ui-canvas' />
    </DashboardPage>
}
