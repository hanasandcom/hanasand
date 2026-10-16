'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DwmWorkflowActions } from './workflow-actions'
import { FindingsView } from './findings-view'
import { filterAlerts, normalizeQueueFilter, orderAlerts } from './queue-model'
import { alertWatchlistMatchCount, latestCaptureWatchlistMatchCount } from './watchlist-counts'
import { alertOrganizationId, dwmScopeSearchParams, isAbortError, refreshCases, refreshDwmAlerts, refreshDwmDeliveries, refreshDwmOperations, refreshDwmProduct, requestFailureDetail, responseProblem } from './portal-data'
import { useFindingsActions } from './use-findings-actions'
import { caseDetailHref, deliverySummaryLabel } from './case-format'
import { alertCaseId } from './delivery-panel'
import type { PortalAlert, OperationsSnapshot, DeliveryItem, CasesState, WatchlistOverview, WatchlistOverviewState } from './types'
import type { PortalProps, DwmDataHealth, QueueFilter } from './view-types'
export type { PortalAlert, OperationsSnapshot } from './types'
export type { FindingsView, DwmDataHealth } from './view-types'

const watchlistOverviewCache = new Map<string, { expiresAt: number, data: WatchlistOverview }>()
const WATCHLIST_OVERVIEW_CACHE_TTL_MS = 30_000

function watchlistOverviewCacheKey(tenantId: string, organizationId?: string) {
    return `${tenantId}\u0000${organizationId ?? ''}`
}

export function Findings({
    tenantId,
    organizationId,
    snapshot: initialSnapshot,
    operations: initialOperations,
    alerts: initialAlerts,
    deliveries: initialDeliveries,
    dataHealth: initialDataHealth,
    initialAlertId,
    isAdmin = false,
    view = 'cases',
}: PortalProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [actorQuery, setActorQuery] = useState('')
    const actorSearchRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (view !== 'actors') return
        const focusActorSearch = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'j' && actorSearchRef.current) {
                event.preventDefault()
                actorSearchRef.current.focus()
                actorSearchRef.current.select()
            }
        }
        window.addEventListener('keydown', focusActorSearch)
        return () => window.removeEventListener('keydown', focusActorSearch)
    }, [view])
    const [snapshot, setSnapshot] = useState(initialSnapshot)
    const [operations, setOperations] = useState(initialOperations)
    const [alerts, setAlerts] = useState(initialAlerts)
    const [dataHealth, setDataHealth] = useState(initialDataHealth)
    const [casesState, setCasesState] = useState<CasesState>(() => ({ status: view === 'cases' || view === 'watchlists' ? 'loading' : 'ready', rows: [] }))
    const [watchlistOverviewState, setWatchlistOverviewState] = useState<WatchlistOverviewState>(() => {
        const cached = watchlistOverviewCache.get(watchlistOverviewCacheKey(tenantId, organizationId))
        return view === 'watchlists'
            ? cached ? { status: 'ready', data: cached.data } : { status: 'loading' }
            : { status: 'ready' }
    })
    const [selectedId, setSelectedId] = useState(initialAlertId && alerts.some(alert => alert.id === initialAlertId) ? initialAlertId : alerts[0]?.id ?? '')
    const [localDeliveries, setLocalDeliveries] = useState<DeliveryItem[]>(initialDeliveries)
    const [refreshVersion, setRefreshVersion] = useState(0)
    const { busyAction, actionMessage, sendAlert, testDelivery } = useFindingsActions({ tenantId, organizationId, alerts, setLocalDeliveries, setRefreshVersion, refreshPage: () => router.refresh() })
    const pendingInitialAlertId = useRef(initialAlertId)
    const [queueFilter, setQueueFilter] = useState<QueueFilter>(() => normalizeQueueFilter(searchParams.get('filter')))
    const [queueQuery] = useState(() => searchParams.get('q')?.slice(0, 120) ?? '')
    const queue = useMemo(() => filterAlerts(orderAlerts(alerts), queueFilter, queueQuery), [alerts, queueFilter, queueQuery])
    const selectedAlert = queue.find(alert => alert.id === selectedId) ?? queue[0]
    const selectedOrganizationId = selectedAlert ? alertOrganizationId(selectedAlert, organizationId) : organizationId
    const latestCaptures = operations?.latestCaptures ?? []
    const activeSourceCount = operations?.counts.activeSourceCount ?? 0
    const sourceCount = operations?.counts.sourceCount ?? 0
    const sharedCaptureCount = operations?.counts.captureCount ?? latestCaptures.length
    const tenantRunCaptureCount = operations?.latestRun?.captureCount || operations?.counts.captureCount || 0
    const watchlistMatchCount = operations?.counts.watchlistMatchCount || latestCaptureWatchlistMatchCount(latestCaptures) || alertWatchlistMatchCount(alerts)
    const watchlistEditorTarget = watchlistOverviewState.data?.watchlists.find(item => item.name === 'Default company exposure watchlist') ?? watchlistOverviewState.data?.watchlists[0]
    const watchlistEditorTerms = view === 'watchlists' ? watchlistEditorTarget?.terms.map(term => term.value) ?? [] : snapshot.watchlist.map(term => term.value)
    const webhookState = deliverySummaryLabel(localDeliveries)
    const workflowTelemetry = {
        activeSourceCount,
        sourceCount,
        captureCount: tenantRunCaptureCount,
        watchlistMatchCount,
        latestRunStatus: operations?.latestRun?.status,
        latestRunCaptureCount: operations?.latestRun?.captureCount,
        alertCount: alerts.length,
        deliveryCount: localDeliveries.length,
    }
    const workflowActions = view === 'cases' ? null : (
        <DwmWorkflowActions
            headingLevel={view === 'actions' ? 1 : 2}
            key={`${tenantId}:${watchlistEditorTarget?.id ?? ''}:${watchlistEditorTerms.join('\u0000')}`}
            tenantId={tenantId}
            organizationId={view === 'watchlists' ? organizationId : selectedOrganizationId}
            initialTerms={watchlistEditorTerms}
            watchlistId={view === 'watchlists' ? watchlistEditorTarget?.id : undefined}
            telemetry={workflowTelemetry}
            variant={view === 'watchlists' ? 'watchlist-editor' : 'workflow'}
            onSaved={view === 'watchlists' ? () => setRefreshVersion(version => version + 1) : undefined}
        />
    )

    useEffect(() => {
        const requestedAlertId = pendingInitialAlertId.current
        if (requestedAlertId && alerts.some(alert => alert.id === requestedAlertId)) {
            if (!queue.some(alert => alert.id === requestedAlertId)) setQueueFilter('all')
            setSelectedId(requestedAlertId)
            pendingInitialAlertId.current = undefined
            return
        }
        if (queue.length && !queue.some(alert => alert.id === selectedId)) {
            setSelectedId(queue[0].id)
        }
    }, [alerts, queue, selectedId])

    useEffect(() => {
        const controller = new AbortController()
        const params = dwmScopeSearchParams(tenantId, organizationId)
        if (view === 'watchlists') {
            const key = watchlistOverviewCacheKey(tenantId, organizationId)
            const cached = watchlistOverviewCache.get(key)
            if (refreshVersion === 0 && cached && cached.expiresAt > Date.now()) {
                setWatchlistOverviewState({ status: 'ready', data: cached.data })
                return () => controller.abort()
            }
            if (cached) setWatchlistOverviewState({ status: 'loading', data: cached.data })
            else setWatchlistOverviewState(current => ({ status: 'loading', data: current.data }))
            void (async () => {
                try {
                    const response = await fetch(`/api/findings/watchlist-overview?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
                    if (!response.ok) throw new Error(await responseProblem(response))
                    const data = await response.json() as WatchlistOverview
                    watchlistOverviewCache.set(key, { expiresAt: Date.now() + WATCHLIST_OVERVIEW_CACHE_TTL_MS, data })
                    setWatchlistOverviewState({ status: 'ready', data })
                } catch (error) {
                    if (isAbortError(error)) return
                    setWatchlistOverviewState(current => current.data
                        ? { status: 'ready', data: current.data, error: requestFailureDetail(error) }
                        : { status: 'error', error: requestFailureDetail(error) })
                }
            })()
            return () => controller.abort()
        }
        if (view === 'cases') {
            void refreshCases(params, controller.signal, setCasesState)
            void refreshDwmOperations(params, controller.signal, setOperations, setDataHealth)
            void refreshDwmAlerts(params, controller.signal, setAlerts, setDataHealth)
        } else {
            void refreshDwmProduct(params, controller.signal, setSnapshot, setDataHealth)
            void refreshDwmOperations(params, controller.signal, setOperations, setDataHealth)
            void refreshDwmAlerts(params, controller.signal, setAlerts, setDataHealth)
            void refreshDwmDeliveries(params, controller.signal, setLocalDeliveries, setDataHealth)
        }
        return () => {
            controller.abort()
        }
    }, [tenantId, organizationId, refreshVersion, view])

    return <FindingsView
        view={view} organizationId={organizationId} activeSourceCount={activeSourceCount} sourceCount={sourceCount}
        sharedCaptureCount={sharedCaptureCount} snapshot={snapshot} operations={operations} deliveries={localDeliveries}
        busyAction={busyAction} testDelivery={testDelivery} sendAlert={sendAlert} selectedAlert={selectedAlert}
        selectedOrganizationId={selectedOrganizationId} webhookState={webhookState} alerts={alerts} dataHealth={dataHealth}
        initialAlertId={initialAlertId} actionMessage={actionMessage} onRefresh={() => setRefreshVersion(version => version + 1)}
        caseHref={alert => { const id = alertCaseId(alert); return id ? caseDetailHref(id, alert.id, alertOrganizationId(alert, organizationId), 'alert_queue') : undefined }}
        actorSearchRef={actorSearchRef} actorQuery={actorQuery} onActorQuery={setActorQuery}
        onRetry={() => setRefreshVersion(version => version + 1)} casesState={casesState} isAdmin={isAdmin}
        watchlistState={watchlistOverviewState} workflowActions={workflowActions}
    />
}
