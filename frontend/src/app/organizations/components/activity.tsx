import type { AlertTerm, WatchlistItem } from '../types/watchlists'
import type { ScopedAlert, ScopedCase, ActivityItem, ActivitySubject, RowMessage } from '../types/activity'
import type { DeliveryRow, WebhookDestination } from '../types/delivery'
import type { OrganizationMember, OrganizationSummary } from '../types/organization'
import { visibilityRows, activitySubjectTypeLabel, activitySourceLabel } from '../model/activityLabels'
import { watchlistsWithOwnDestination, organizationDestinationConfigured } from '../model/watchlists'
import { SectionTitle, RowStatus, EmptyLine } from './shared'
import { ScopeColumn } from './scopeColumn'
import { ActionAnchor } from './security'
import { compactReference } from '../model/references'
import { matchReasonForRecord } from '../model/deliveries'
import { organizationMemberLabel, destinationDisplayState, organizationDisplayName } from '../model/organization'
import type { OrgBundle } from '../types/bundle'
import { activityRowsForSubject, organizationWorkspaceSelectionHref, activitySubjectFromItem } from '../model/activityNavigation'
import { selectedContextRows, selectedSubjectLabel } from '../model/activityContext'
import { ORG_ACTIVITY_PREVIEW_ROWS } from '../constants/activity'
import { selectedSubjectActions } from '../model/activityActions'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { formatDate } from '../model/labels'
import { secondaryButtonClass } from '../constants/styles'
import { BellRing, CheckCircle2, CircleAlert, Copy, ExternalLink, ShieldCheck, Webhook } from 'lucide-react'
import { useState } from 'react'

export function ScopePanel({ alertTerms, alerts, cases, deliveries, members, watchlists, webhooks, alertCaseVisibility, organizationId }: { alertTerms: AlertTerm[], alerts: ScopedAlert[], cases: ScopedCase[], deliveries: DeliveryRow[], members: OrganizationMember[], watchlists: WatchlistItem[], webhooks: WebhookDestination[], alertCaseVisibility: Record<string, unknown> | null, organizationId: string }) {
    const route = `/api/organizations/${encodeURIComponent(organizationId)}`
    const visibility = visibilityRows(alertCaseVisibility)
    const watchlistDestinationRows = watchlistsWithOwnDestination(watchlists, webhooks)
    const configuredDestinations = webhooks.filter(organizationDestinationConfigured).length + watchlistDestinationRows.length
    const hasScopeRows = Boolean(alertTerms.length || alerts.length || cases.length || webhooks.length || watchlistDestinationRows.length || visibility.length)
    const failedDeliveries = deliveries.filter(delivery => delivery.status?.toLowerCase() === 'failed' || Boolean(delivery.error)).length
    if (!hasScopeRows) {
        return (
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-scope-empty='true'>
                <SectionTitle icon={<ExternalLink className='h-4 w-4' />} title='Monitoring records' detail='Events, cases, destinations.' />
                <div className='mt-4 grid gap-3 rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 dark:border-ui-border dark:bg-ui-canvas sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
                    <div className='min-w-0'>
                        <p className='text-sm font-semibold text-ui-text dark:text-ui-text'>No monitoring records yet</p>
                        <div className='mt-2 flex flex-wrap gap-2 text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 dark:border-ui-border dark:bg-ui-panel'>Add watchlist</span>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 dark:border-ui-border dark:bg-ui-panel'>Configure integration</span>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 dark:border-ui-border dark:bg-ui-panel'>Route event</span>
                        </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <ActionAnchor href='/organizations/watchlists#watchlists' icon={<BellRing className='h-4 w-4' />} label='Add watchlist' />
                        <ActionAnchor href='/findings/delivery' icon={<Webhook className='h-4 w-4' />} label='Open integrations' />
                    </div>
                </div>
            </section>
        )
    }
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-scope-records='true'>
            <SectionTitle icon={<ExternalLink className='h-4 w-4' />} title='Event, case, and destination records' detail='Matched records for this organization.' />
            <div className='mt-3 flex flex-wrap gap-2' data-org-scope-record-counts='true'>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>Terms: {alertTerms.length}</span>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>Events: {alerts.length}</span>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>Cases: {cases.length}</span>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>Destinations: {configuredDestinations}</span>
                <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>Failures: {failedDeliveries}</span>
            </div>
            <div className='mt-4 grid gap-3 lg:grid-cols-2'>
                <ScopeColumn icon={<BellRing className='h-4 w-4' />} title='Watchlist terms' route={`${route}/watchlists/alert-terms`} rows={alertTerms.map(term => ({
                    id: term.watchlistItemId || term.watchlistId || term.alertGenerationRef || term.term || term.value || 'term',
                    primary: term.term || term.value || 'Watchlist term',
                    secondary: term.matchReason || compactReference(term.alertGenerationRef, 'watch') || term.kind || term.family || 'Shared watchlist match',
                    href: term.watchlistItemId || term.watchlistId ? `/organizations/watchlists#watchlist-${encodeURIComponent(term.watchlistItemId || term.watchlistId || '')}` : undefined,
                }))} empty='Add an active shared watchlist term to create organization terms.' />
                <ScopeColumn icon={<CircleAlert className='h-4 w-4' />} title='Events' route={`/api/findings/alerts?organizationId=${encodeURIComponent(organizationId)}`} rows={alerts.map(alert => {
                    const matchReason = matchReasonForRecord(alert.id, deliveries)
                    return {
                        id: alert.id,
                        primary: alert.title || compactReference(alert.id, 'event') || 'Event',
                        secondary: [alert.severity || 'severity', alert.status || 'status', compactReference(alert.watchlistItemId || alert.watchlistItemIds?.[0] || alert.watchlistIds?.[0], 'watchlist'), matchReason ? `Match: ${matchReason}` : undefined].filter(Boolean).join(' · '),
                        href: `/ti/workbench?alertId=${encodeURIComponent(alert.id)}&organizationId=${encodeURIComponent(organizationId)}`,
                    }
                })} empty='Events appear after a live capture matches an active org watchlist term.' rowPrefix='event-record' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Cases' route={`/api/cases?organizationId=${encodeURIComponent(organizationId)}`} rows={cases.map(item => {
                    const matchReason = matchReasonForRecord(item.id, deliveries)
                    return {
                        id: item.id,
                        primary: item.title || compactReference(item.id, 'case') || 'Case',
                        secondary: [item.status || 'status', organizationMemberLabel(item.assignedOwner, members), matchReason ? `Match: ${matchReason}` : undefined].filter(Boolean).join(' · '),
                        href: `/cases/${encodeURIComponent(item.id)}?organizationId=${encodeURIComponent(organizationId)}`,
                    }
                })} empty='Cases appear after an event is opened from exposure monitoring.' rowPrefix='case-record' />
                <ScopeColumn icon={<ShieldCheck className='h-4 w-4' />} title='Visibility' route={`${route}/alert-case-visibility`} rows={visibility} empty='Visibility decisions appear after events are reviewed or opened as cases.' />
                <ScopeColumn icon={<Webhook className='h-4 w-4' />} title='Destinations' route={`${route}/webhooks`} rows={[
                    ...webhooks.map(destination => ({
                        id: destination.id,
                        primary: destination.name || compactReference(destination.id, 'destination') || 'Destination',
                        secondary: `${destination.status || 'unknown'} · ${destinationDisplayState(destination)}`,
                        href: '/findings/delivery',
                    })),
                    ...watchlistDestinationRows.map(item => ({
                        id: `watchlist-${item.id}`,
                        primary: item.value || compactReference(item.id, 'watchlist') || 'Watchlist route',
                        secondary: `${item.status || 'active'} · ${destinationDisplayState(item)}`,
                        href: `/organizations/watchlists#watchlist-${encodeURIComponent(item.id)}`,
                    })),
                ]} empty='Save a watchlist destination to make customer delivery available here.' />
            </div>
        </section>
    )
}
