import type { DwmDeliveryItem, DwmOrganizationSummary, DwmOrganizationWebhookDestination, DwmWatchlistSummary, OperatorScope } from './operatorConsoleTypes'
import type { WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'
import type { WorkbenchAction } from './ti/workbench/types/evidence'
import { actionScope } from './operatorContextUtils'

export function operatorPath(input: {
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWatchlists: DwmWatchlistSummary[]
    orgWebhooks: DwmOrganizationWebhookDestination[]
    sourceCount: number
    activeSources: number
    liveAlertCount: number
    latestDelivery?: DwmDeliveryItem
}): WorkbenchWorkflowStep[] {
    const watchlistIds = input.activeWatchlists.map(item => item.id)
    const webhookIds = input.orgWebhooks.map(item => item.id)
    return [
        {
            id: 'path_org',
            label: 'Organization',
            status: input.organization ? 'ready' : 'blocked',
            owner: input.organization ? 'operator' : 'platform',
            source: 'Organization roster',
            entityId: input.organization?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/api/organizations',
            detail: input.organization ? `${input.organization.name}; tenant ${input.organization.tenantId}` : 'Organization record is syncing.',
        },
        {
            id: 'path_watchlist',
            label: 'Shared watchlist',
            status: input.activeWatchlists.length ? 'ready' : 'needs_action',
            owner: 'operator',
            source: 'Shared watchlists',
            entityId: watchlistIds.join(', ') || undefined,
            href: '/findings',
            detail: input.activeWatchlists.length ? `${input.activeWatchlists.length} active; ${input.activeWatchlists.flatMap(item => item.terms || []).length} terms.` : 'Active watchlist state is loading for the selected workspace.',
        },
        {
            id: 'path_alert_case',
            label: 'Alert/case',
            status: input.liveAlertCount ? 'ready' : 'needs_action',
            owner: 'analyst',
            source: 'Alert and case workflow',
            entityId: input.liveAlertCount ? `${input.liveAlertCount} alert candidates` : undefined,
            href: '/api/findings/alerts',
            detail: input.liveAlertCount ? 'Select a DWM alert and open/update the backed analyst case.' : `Rebuild alerts after source coverage (${input.activeSources}/${input.sourceCount}) and watchlist terms exist.`,
        },
        {
            id: 'path_webhook',
            label: 'Webhook delivery',
            status: input.orgWebhooks.length ? input.latestDelivery?.status === 'failed' ? 'blocked' : 'ready' : 'needs_action',
            owner: 'operator',
            source: 'Webhook delivery',
            entityId: webhookIds.join(', ') || input.latestDelivery?.id,
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/webhooks` : '/findings',
            detail: input.latestDelivery ? `${input.latestDelivery.id}: ${input.latestDelivery.status}` : input.orgWebhooks.length ? 'Destination active; run a test or send queued alerts.' : 'Webhook destination is syncing.',
        },
    ]
}

export function webhookActions(scope: OperatorScope, organization: DwmOrganizationSummary | undefined, orgWebhooks: DwmOrganizationWebhookDestination[], hasWebhookDestination: boolean, latestDelivery?: DwmDeliveryItem): WorkbenchAction[] {
    const actions: WorkbenchAction[] = [{
        id: 'open_delivery_history',
        label: 'Open delivery history',
        method: 'GET',
        href: deliveryLedgerHref(scope, latestDelivery),
    }]
    const destination = orgWebhooks[0]
    if (organization && destination) {
        actions.push({
            id: 'test_org_webhook',
            label: 'Test org webhook',
            method: 'POST',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`,
            body: { webhookDestinationId: destination.id, dryRun: true },
        })
    }
    if (hasWebhookDestination && latestDelivery?.alertId) {
        actions.push({
            id: 'replay_latest_delivery',
            label: 'Replay latest alert',
            method: 'POST',
            href: '/api/findings/webhooks/deliver',
            body: { ...actionScope(scope), alertId: latestDelivery.alertId, limit: 1 },
        })
    }
    if (hasWebhookDestination) {
        actions.push({
            id: 'deliver_webhooks',
            label: 'Send queued alerts',
            method: 'POST',
            href: '/api/findings/webhooks/deliver',
            body: { ...actionScope(scope), limit: 25 },
        })
    }
    return actions
}

export function deliveryLedgerHref(scope: OperatorScope, latestDelivery?: DwmDeliveryItem) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    if (latestDelivery?.alertId) {
        params.set('alertId', latestDelivery.alertId)
    }
    return `/api/findings/webhooks/deliveries?${params.toString()}`
}

export function sourceInventoryHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    params.set('q', scope.organizationId || scope.tenantId)
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/ti/scraper/control?${params.toString()}`
}

export function watchlistCoverageHref(scope: OperatorScope, organization?: DwmOrganizationSummary) {
    if (organization) {
        return `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`
    }
    return watchlistsHref(scope)
}

export function watchlistsHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/findings/watchlists?${params.toString()}`
}

export function alertsHref(scope: OperatorScope) {
    const params = new URLSearchParams()
    if (scope.organizationId) {
        params.set('organizationId', scope.organizationId)
    } else {
        params.set('tenantId', scope.tenantId)
    }
    return `/api/findings/alerts?${params.toString()}`
}
