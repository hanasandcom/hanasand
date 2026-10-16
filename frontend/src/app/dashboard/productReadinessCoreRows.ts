import type { ProductReadinessContext } from './productReadinessContext'
import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import { entitlementDetail, dwmProductDetail } from '@/utils/productProgress/readinessDetails'

export function buildCoreProductReadinessRows(context: ProductReadinessContext): WorkbenchProductReadinessItem[] {
    const { input, organizationStatus, watchlistStatus, sourceStatus, alertStatus, deliveryStatus, readinessCheckedAt, dwmProduct, entitlement } = context
    return [
        {
            id: 'org_members',
            label: 'Org and members',
            status: organizationStatus,
            detail: input.organization
                ? `${input.organization.name}; ${input.activeMemberCount} active member${input.activeMemberCount === 1 ? '' : 's'}, ${input.pendingInviteCount} pending invite${input.pendingInviteCount === 1 ? '' : 's'}.`
                : input.backendConfigured ? 'Organization service is reachable; selected organization context is syncing.' : 'Organization state is syncing to collection.',
            source: 'Organization roster and members',
            href: input.organization ? `/api/organizations/${encodeURIComponent(input.organization.id)}/members` : '/dashboard',
            checkedAt: input.organization?.updatedAt,
            backendProofContractVersion: 'organization.lifecycle.readiness.v1',
        },
        {
            id: 'shared_watchlists',
            label: 'Shared watchlists',
            status: watchlistStatus,
            detail: `${input.activeWatchlistCount} active watchlist${input.activeWatchlistCount === 1 ? '' : 's'} with ${input.termCount} term${input.termCount === 1 ? '' : 's'}.`,
            source: 'Shared watchlists',
            href: '/findings',
            checkedAt: input.latestWatchlistAt,
            backendProofContractVersion: 'organization.watchlist_lifecycle.readiness.v1',
        },
        {
            id: 'entitlement_readiness',
            label: 'Entitlement status',
            status: entitlement?.status || 'unavailable',
            detail: entitlement
                ? entitlement.detail || entitlementDetail(entitlement)
                : 'DWM entitlement state is loading.',
            source: entitlement?.source || 'DWM entitlement status',
            href: entitlement?.href || '/findings',
            checkedAt: entitlement?.checkedAt,
            staleAfterSeconds: entitlement?.staleAfterSeconds,
            proofTimestamp: entitlement?.proofTimestamp,
            unavailableReason: entitlement?.unavailableReason,
            expectedDashboardRowId: entitlement?.expectedDashboardRowId,
            integrationProbeHint: entitlement?.integrationProbeHint,
            backendProofContractVersion: entitlement?.backendProofContractVersion || entitlement?.schemaVersion,
        },
        {
            id: 'source_coverage',
            label: 'Source coverage',
            status: sourceStatus,
            detail: input.sourceCoverage
                ? `${input.sourceCoverage.activeSourceCount}/${input.sourceCoverage.sourceCount} active sources; ${input.sourceCoverage.captureCount} captures; latest run ${input.sourceCoverage.latestRunStatus || 'checking'}.`
                : 'DWM operations source coverage is syncing.',
            source: 'DWM operations ledger',
            href: '/ti/sources',
            checkedAt: input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.operations.source_coverage.v1',
        },
        {
            id: 'dashboard_alert',
            label: 'Dashboard alert',
            status: alertStatus,
            detail: input.liveAlertCount
                ? `${input.liveAlertCount} live alert${input.liveAlertCount === 1 ? '' : 's'} surfaced in the dashboard queue${input.liveAlertIds.length ? `: ${input.liveAlertIds.slice(0, 3).join(', ')}` : ''}.`
                : 'Live DWM alert stream is syncing to the dashboard queue.',
            source: 'DWM alert stream',
            href: '/ti/workbench',
            checkedAt: input.dashboardAlertDelivery?.attemptedAt || input.sourceCoverage?.latestRunAt,
            backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
        },
        {
            id: 'dwm_product_snapshot',
            label: 'DWM monitor stream',
            status: dwmProduct?.status || 'unavailable',
            detail: dwmProduct
                ? dwmProduct.detail || dwmProductDetail(dwmProduct)
                : 'Live DWM monitor is syncing.',
            source: dwmProduct?.source || 'DWM monitor status',
            href: dwmProduct?.href || '/findings',
            checkedAt: dwmProduct?.checkedAt || dwmProduct?.latestAlertAt,
            staleAfterSeconds: dwmProduct?.staleAfterSeconds,
            proofTimestamp: dwmProduct?.proofTimestamp,
            unavailableReason: dwmProduct?.unavailableReason,
            expectedDashboardRowId: dwmProduct?.expectedDashboardRowId,
            integrationProbeHint: dwmProduct?.integrationProbeHint,
            backendProofContractVersion: dwmProduct?.backendProofContractVersion || dwmProduct?.schemaVersion,
        },
        {
            id: 'webhook_delivery',
            label: 'Webhook delivery',
            status: deliveryStatus,
            detail: input.dashboardAlertDelivery
                ? `${input.dashboardAlertDelivery.status} delivery ${input.dashboardAlertDelivery.id} for surfaced alert ${input.dashboardAlertDelivery.alertId}.`
                : input.latestDelivery ? `Latest delivery ${input.latestDelivery.id} is for ${input.latestDelivery.alertId}, but not for a dashboard-surfaced alert.` : 'Delivery ledger is syncing to a dashboard-surfaced alert.',
            source: 'Webhook delivery ledger',
            href: '/automation?setup=dwm',
            checkedAt: input.dashboardAlertDelivery?.attemptedAt || input.latestDelivery?.attemptedAt || readinessCheckedAt,
            backendProofContractVersion: 'dwm.webhook.delivery_ledger.v1',
        },
    ]
}
