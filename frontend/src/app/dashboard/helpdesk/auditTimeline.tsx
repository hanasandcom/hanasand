'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getCookie } from '@/utils/cookies/cookies'
import config from '@/config'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import type { AdminAuditEvent, AuditSearchParams } from './audit'
import { activeFilterEntries, auditQuietButtonClass, selectedAuditEvent } from './auditPresentation'
import AuditFilterPanel from './auditFilterPanel'
import AuditEventList from './auditEventList'

export default function AuditTimeline({ events: initialEvents, params, responseError }: {
    events: AdminAuditEvent[]
    params: AuditSearchParams
    responseError: string
}) {
    const [acknowledgments, setAcknowledgments] = useState<Record<number, Partial<AdminAuditEvent>>>({})
    const [pendingEvent, setPendingEvent] = useState<number | null>(null)
    const [acknowledgmentError, setAcknowledgmentError] = useState<{ id: number, message: string } | null>(null)
    const events = initialEvents.map(event => ({ ...event, ...acknowledgments[event.id] }))
    const searchParams = useSearchParams()
    const selectedEvent = selectedAuditEvent(events, { ...params, event: searchParams?.get('event') || undefined })
    const notificationPanel = useRef<HTMLDetailsElement>(null)
    const timeline = useRef<HTMLDivElement>(null)

    async function acknowledge(event: AdminAuditEvent) {
        if (pendingEvent !== null) return
        setPendingEvent(event.id)
        setAcknowledgmentError(null)
        try {
            const response = await fetch(`${config.url.api}/admin/audit-events/${event.id}/acknowledgment`, {
                method: event.acknowledged_at ? 'DELETE' : 'POST',
                headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' },
            })
            const result = await response.json()
            if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Could not save acknowledgment.')
            setAcknowledgments(current => ({ ...current, [event.id]: {
                acknowledged_at: result.acknowledged_at,
                acknowledged_by: result.acknowledged_by,
                acknowledged_by_name: null,
            } }))
        } catch (error) {
            setAcknowledgmentError({ id: event.id, message: error instanceof Error ? error.message : 'Could not save acknowledgment. Try again.' })
        } finally {
            setPendingEvent(null)
        }
    }

    function selectEvent(id: number, reveal = false) {
        const url = new URL(window.location.href)
        url.searchParams.set('event', String(id))
        // Native history updates Next's search params without fetching the page again.
        window.history.pushState(null, '', url)
        if (reveal) {
            if (notificationPanel.current) notificationPanel.current.open = false
            const row = timeline.current?.querySelector<HTMLElement>(`[data-audit-event-id="${id}"]`)
            row?.scrollIntoView({ block: 'nearest' })
            row?.querySelector('button')?.focus({ preventScroll: true })
        }
    }

    return <DashboardPage className='gap-3'>
        <DashboardHeader eyebrow='Support' title='Helpdesk operations' actions={(
            <div className='flex flex-wrap gap-2'>
                <Link className={auditQuietButtonClass} href='/dashboard'>Dashboard</Link>
            </div>
        )} />
        <section className='grid gap-3'>
            <div className='grid min-w-0 content-start gap-3'>
                <AuditFilterPanel
                    params={params}
                    events={events}
                    responseError={responseError}
                    notificationPanel={notificationPanel}
                    onSelectEvent={selectEvent}
                />
                <AuditEventList
                    events={events}
                    selectedEventId={selectedEvent?.id}
                    filterCount={activeFilterEntries(params).length}
                    responseError={responseError}
                    timeline={timeline}
                    pendingEvent={pendingEvent}
                    acknowledgmentError={acknowledgmentError}
                    onSelectEvent={id => selectEvent(id)}
                    onAcknowledge={event => void acknowledge(event)}
                />
            </div>
        </section>
    </DashboardPage>
}
