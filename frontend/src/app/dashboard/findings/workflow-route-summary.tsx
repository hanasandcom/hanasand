import Link from '@/components/organizations/workspaceLink'
import type { WorkflowRouteSummary as WorkflowRouteSummaryData } from './workflow-types'

export function deliverySetupHref(organizationId?: string) {
    return organizationId ? `/findings/actions?org=${encodeURIComponent(organizationId)}` : '#dwm-inline-webhook'
}

export function deliveryLogHref(organizationId: string, alertId?: string) {
    const params = new URLSearchParams({ org: organizationId })
    if (alertId) params.set('alert', alertId)
    return `/findings/delivery?${params.toString()}`
}

export function RouteRunSummary({ route, organizationId }: { route: WorkflowRouteSummaryData, organizationId?: string }) {
    const deliveryHref = organizationId ? deliveryLogHref(organizationId, route.alertId) : undefined
    const cells = [
        { label: 'Watch terms', value: String(route.watchTerms) },
        { label: 'Sources', value: route.sourceCount === undefined ? 'unchanged' : String(route.sourceCount) },
        { label: 'Captures', value: route.captureCount === undefined ? 'pending' : String(route.captureCount) },
        { label: 'Events', value: route.alertCount === undefined ? 'pending' : String(route.alertCount) },
        { label: 'Case', value: route.caseId ? 'case linked' : 'not opened' },
        { label: 'Delivery', value: route.deliveryAttempts === undefined ? route.deliveryState || 'not run' : `${route.deliveryAttempts} attempt${route.deliveryAttempts === 1 ? '' : 's'}` },
    ]
    return (
        <section data-dwm-route-run-summary className='mt-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Last route run</p>
                    <h4 className='mt-1 text-sm font-semibold text-ui-text'>{route.label}</h4>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {route.caseHref ? <Link href={route.caseHref} className='inline-flex h-8 items-center rounded-lg border border-ui-primary bg-ui-primary/10 px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>Open case</Link> : null}
                    {deliveryHref ? <Link href={deliveryHref} className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>Open delivery log</Link> : null}
                    {route.alertId ? <span className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-muted'>event linked</span> : null}
                </div>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6'>
                {cells.map(cell => <div key={cell.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
                    <p className='text-[10px] font-semibold uppercase text-ui-subtle'>{cell.label}</p>
                    <p className='mt-1 truncate text-sm font-semibold text-ui-text' title={cell.value}>{cell.value}</p>
                </div>)}
            </div>
            {route.deliveryState ? <p className='mt-2 text-xs leading-5 text-ui-subtle'>{route.deliveryState}</p> : null}
        </section>
    )
}
