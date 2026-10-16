import type { ReactNode, RefObject } from 'react'
import Link from '@/components/organizations/workspaceLink'
import { ActorDirectory, MonitoringOverview } from './monitoring-overview'
import { WatchlistsView } from './watchlists-view'
import { CaseOverview } from './case-overview'
import { DwmPanelPage } from './panel-page'
import { SourcePosture } from './source-posture'
import { DeliveryPanel, alertCaseId } from './delivery-panel'
import { alertOrganizationId } from './portal-data'
import { caseDetailHref } from './case-format'
import type { PortalAlert, OperationsSnapshot, DeliveryItem, CasesState, WatchlistOverviewState } from './types'
import type { DwmDataHealth, FindingsView as FindingsViewType } from './view-types'

export function FindingsView({ view, organizationId, activeSourceCount, sourceCount, sharedCaptureCount, snapshot, operations, deliveries, busyAction, testDelivery, sendAlert, selectedAlert, selectedOrganizationId, webhookState, alerts, dataHealth, initialAlertId, actionMessage, onRefresh, caseHref, actorSearchRef, actorQuery, onActorQuery, onRetry, casesState, isAdmin, watchlistState, workflowActions }: {
    view: FindingsViewType
    organizationId?: string
    activeSourceCount: number
    sourceCount: number
    sharedCaptureCount: number
    snapshot: import('@/utils/dwm/product').DwmProductSnapshot
    operations: OperationsSnapshot | null
    deliveries: DeliveryItem[]
    busyAction: string | null
    testDelivery: (id: string) => Promise<void>
    sendAlert: (id: string) => Promise<void>
    selectedAlert?: PortalAlert
    selectedOrganizationId?: string
    webhookState: string
    alerts: PortalAlert[]
    dataHealth: DwmDataHealth
    initialAlertId?: string
    actionMessage: { ok: boolean, text: string } | null
    onRefresh: () => void
    caseHref: (alert: PortalAlert) => string | undefined
    actorSearchRef: RefObject<HTMLInputElement | null>
    actorQuery: string
    onActorQuery: (value: string) => void
    onRetry: () => void
    casesState: CasesState
    isAdmin: boolean
    watchlistState: WatchlistOverviewState
    workflowActions: ReactNode
}) {
    if (view === 'watchlists') return <WatchlistsView organizationId={organizationId} state={watchlistState} workflowActions={workflowActions} />

    if (view === 'sources') {
        return (
            <DwmPanelPage title='Sources' meta={`${activeSourceCount}/${sourceCount} shared active sources · ${sharedCaptureCount} shared captures`}>
                <SourcePosture snapshot={snapshot} operations={operations} />
            </DwmPanelPage>
        )
    }

    if (view === 'delivery') {
        return (
            <DwmPanelPage title='Integrations' meta={selectedOrganizationId ? `${deliveries.length} delivery attempts · webhook ${webhookState}` : undefined}>
                <DeliveryPanel organizationId={organizationId} alert={selectedAlert} deliveries={deliveries} busyAction={busyAction} onTest={testDelivery} onSend={sendAlert} />
            </DwmPanelPage>
        )
    }

    if (view === 'overview') {
        return <MonitoringOverview alerts={alerts} dataHealth={dataHealth}
            organizationId={organizationId} initialAlertId={initialAlertId} actionMessage={actionMessage}
            onRefresh={onRefresh}
            caseHref={alert => { const id = alertCaseId(alert); return id ? caseDetailHref(id, alert.id, alertOrganizationId(alert, organizationId), 'alert_queue') : undefined }} />
    }

    if (view === 'actors') {
        return (
            <DwmPanelPage title='Actors' meta={<div className='flex flex-wrap items-center gap-3'>
                <span className='whitespace-nowrap'>{dataHealth.snapshot.state === 'live' ? `${snapshot.actorOverviews.length} actor profiles` : dataHealth.snapshot.state === 'error' ? 'Actor profiles unavailable' : 'Loading actor profiles…'}</span>
                {dataHealth.snapshot.state === 'live' && <label className='flex h-9 w-60 max-w-full items-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-3 focus-within:ring-2 focus-within:ring-ui-primary'>
                    <input ref={actorSearchRef} aria-label='Search actors' aria-keyshortcuts='Meta+J Control+J' placeholder='Search actors' className='min-w-0 flex-1 bg-transparent text-sm font-normal text-ui-text outline-none' value={actorQuery} onChange={event => setActorQuery(event.target.value)} />
                    <kbd className='shrink-0 rounded border border-ui-border bg-ui-panel px-1 py-0.5 text-[10px] font-semibold text-ui-muted'>⌘ J</kbd>
                </label>}
            </div>}>
                <ActorDirectory key={actorQuery} query={actorQuery} actors={snapshot.actorOverviews} state={dataHealth.snapshot.state} onRetry={onRetry} />
            </DwmPanelPage>
        )
    }

    if (view === 'actions') return <Link href='/findings/actions'>Delivery</Link>

    if (view === 'cases') {
        return <CaseOverview organizationId={organizationId} state={casesState} alerts={alerts} operations={operations} isAdmin={isAdmin} />
    }

    return null
}
