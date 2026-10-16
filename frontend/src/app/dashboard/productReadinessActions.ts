import type { WorkbenchAction, WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import type { DwmOrganizationSummary, DwmOrganizationWebhookDestination, OperatorScope, DwmDeliveryItem } from './operatorConsoleTypes'
import { caseReadinessMutationActions } from './productReadinessCaseActions'
import { alertsHref, deliveryLedgerHref, sourceInventoryHref, watchlistCoverageHref, watchlistsHref } from './readinessCaseLinks'
import { actionScope } from './operatorContextUtils'

export function withProductReadinessActions(item: WorkbenchProductReadinessItem, context: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
    }
    liveAlertCount: number
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
}): WorkbenchProductReadinessItem {
    const actions = productReadinessActions(item, context)
    return actions.length ? { ...item, actions } : item
}

function productReadinessActions(item: WorkbenchProductReadinessItem, context: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
    }
    liveAlertCount: number
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
}): WorkbenchAction[] {
    const actions: WorkbenchAction[] = []
    const organization = context.organization
    const destination = context.activeWebhooks[0]
    switch (item.id) {
        case 'org_members':
            actions.push({ id: 'inspect_org_members', label: 'Inspect members', method: 'GET', href: organization ? `/api/organizations/${encodeURIComponent(organization.id)}/members` : '/api/organizations' })
            if (organization) actions.push({ id: 'inspect_org_webhooks', label: 'Inspect webhooks', method: 'GET', href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks` })
            break
        case 'shared_watchlists':
        case 'org_alert_export':
            actions.push({ id: 'inspect_watchlist_coverage', label: 'Inspect coverage', method: 'GET', href: watchlistCoverageHref(context.scope, organization) })
            actions.push({ id: 'open_watchlists_api', label: 'Watchlists API', method: 'GET', href: watchlistsHref(context.scope) })
            if (context.activeWatchlistCount && context.termCount) actions.push({ id: 'rebuild_alerts', label: 'Rebuild alerts', method: 'POST', href: '/api/findings/alerts/rebuild', body: actionScope(context.scope) })
            break
        case 'source_coverage':
        case 'source_inventory_probe':
        case 'end_to_end_workflow':
            actions.push({ id: 'inspect_source_inventory', label: 'Inspect inventory', method: 'GET', href: sourceInventoryHref(context.scope) })
            actions.push({
                id: 'run_canary_collection',
                label: 'Run canary',
                method: 'POST',
                href: '/api/findings/canary/run',
                body: {
                    operatorApproval: true,
                    approvedBy: 'dashboard',
                    maxSources: 12,
                    maxTasks: 24,
                },
            })
            if (item.id === 'end_to_end_workflow') {
                actions.push({ id: 'open_watchlists_api', label: 'Watchlists API', method: 'GET', href: watchlistsHref(context.scope) })
                actions.push({ id: 'open_alert_queue', label: 'Open alerts', method: 'GET', href: alertsHref(context.scope) })
                actions.push({ id: 'open_delivery_history', label: 'Delivery history', method: 'GET', href: deliveryLedgerHref(context.scope, context.dashboardAlertDelivery || context.latestDelivery) })
            }
            break
        case 'dashboard_alert':
        case 'dashboard_evidence':
        case 'alert_generation':
        case 'dwm_product_snapshot':
            actions.push({ id: 'open_alert_queue', label: 'Open alerts', method: 'GET', href: alertsHref(context.scope) })
            actions.push({ id: 'open_alert_generation_readiness', label: 'Generation status', method: 'GET', href: '/api/findings/alerts/generation-readiness' })
            actions.push({
                id: 'rebuild_alerts',
                label: 'Rebuild alerts',
                method: 'POST',
                href: '/api/findings/alerts/rebuild',
                body: actionScope(context.scope),
                disabledReason: context.activeWatchlistCount && context.sourceCoverage?.activeSourceCount ? undefined : 'Rebuild requires active watchlist terms and source coverage.',
            })
            break
        case 'webhook_delivery':
        case 'webhook_health':
            actions.push({ id: 'open_delivery_history', label: 'Delivery history', method: 'GET', href: deliveryLedgerHref(context.scope, context.dashboardAlertDelivery || context.latestDelivery) })
            if (organization && destination) {
                actions.push({
                    id: 'test_org_webhook',
                    label: 'Test webhook',
                    method: 'POST',
                    href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`,
                    body: { webhookDestinationId: destination.id, dryRun: true },
                })
            }
            actions.push({
                id: 'replay_latest_delivery',
                label: 'Replay latest',
                method: 'POST',
                href: '/api/findings/webhooks/deliver',
                body: context.latestDelivery?.alertId ? { ...actionScope(context.scope), alertId: context.latestDelivery.alertId, limit: 1 } : actionScope(context.scope),
                disabledReason: context.activeWebhookCount && context.latestDelivery?.alertId ? undefined : 'Replay requires an active webhook destination and a delivery row with alertId.',
            })
            actions.push({
                id: 'send_queued_alerts',
                label: 'Send queued',
                method: 'POST',
                href: '/api/findings/webhooks/deliver',
                body: { ...actionScope(context.scope), limit: 25 },
                disabledReason: context.activeWebhookCount ? undefined : 'Sending requires an active webhook destination.',
            })
            break
        case 'analyst_workflow':
            actions.push({ id: 'open_case_workflow', label: 'Case workflow', method: 'GET', href: item.href || '/ti/workbench' })
            if (item.caseDetailHref) actions.push({ id: 'open_case_detail', label: 'Case detail', method: 'GET', href: item.caseDetailHref })
            actions.push(...caseReadinessMutationActions(item))
            break
        case 'helpdesk_audit':
            actions.push({ id: 'inspect_support_recovery', label: 'Recovery queue', method: 'GET', href: '/api/backend/admin/support/access-recovery' })
            actions.push({ id: 'inspect_admin_audit', label: 'Audit events', method: 'GET', href: '/api/backend/admin/audit-events?limit=50' })
            break
        case 'public_ti_provenance':
            actions.push({ id: 'open_public_ti', label: 'Open public TI', method: 'GET', href: item.href || '/ti' })
            break
        case 'deploy_probe':
            actions.push({ id: 'open_deploy_status', label: 'Deploy status', method: 'GET', href: '/status' })
            break
        case 'entitlement_readiness':
            actions.push({ id: 'open_dwm_console', label: 'DWM console', method: 'GET', href: item.href || '/findings' })
            break
        default:
            if (item.href) actions.push({ id: 'open_workflow', label: 'Open workflow', method: 'GET', href: item.href })
            break
    }
    return actions
}
