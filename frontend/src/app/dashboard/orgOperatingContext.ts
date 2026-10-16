import type { ProductReadinessExternalState } from '@/utils/productProgress/sourceGrowthTypes'
import type { DwmDeliveryItem, DwmOperationsSnapshot, DwmOrganizationState, DwmWatchlistSummary, OperatorScope } from './operatorConsoleTypes'
import { buildProductReadiness } from './productReadinessModel'
import { latestTimestamp } from './operatorModelUtils'
import { actionScope, derivedWatchlistMatchCount } from './operatorContextUtils'
import { PRODUCT_READINESS_FULL_CHAIN_GATE_IDS } from '@/utils/productProgress/readinessLabels'

export function buildOrgOperatingContext(input: {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    organizationState: DwmOrganizationState
    operations?: DwmOperationsSnapshot | null
    deliveries?: DwmDeliveryItem[]
    liveAlertCount?: number
    liveAlertIds?: string[]
    externalReadiness?: ProductReadinessExternalState
}) {
    const organization = input.organizationState.selectedOrganization
    const activeMembers = input.organizationState.members.filter(item => item.status === 'active')
    const pendingInvites = input.organizationState.pendingInvites.filter(item => item.status === 'pending')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const activeWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const latestWatchlistAt = latestTimestamp(activeWatchlists.map(item => item.updatedAt))
    const latestWebhookAt = latestTimestamp(activeWebhooks.map(item => item.updatedAt))
    const termCount = activeWatchlists.reduce((sum, item) => sum + (item.terms || []).length, 0)
    const latestDelivery = (input.deliveries || [])[0]
    const liveAlertIds = new Set(input.liveAlertIds || [])
    const dashboardAlertDelivery = (input.deliveries || []).find(item => liveAlertIds.has(item.alertId) && item.status !== 'failed' && item.status !== 'skipped')
    const watchlistMatchCount = derivedWatchlistMatchCount(input.operations)
    const blockedReasons = [
        !input.backendConfigured ? 'TI scraper organization stream is syncing.' : '',
        !organization ? 'Organization context is syncing.' : '',
        organization && !activeMembers.length ? `Member state is loading for ${organization.id}.` : '',
        organization && !activeWatchlists.length ? 'Shared DWM watchlist state is loading for this organization.' : '',
        organization && !activeWebhooks.length ? 'Organization webhook destination state is loading.' : '',
    ].filter(Boolean)
    const productReadiness = buildProductReadiness({
        backendConfigured: input.backendConfigured,
        scope: input.scope,
        organization,
        activeWebhooks,
        activeMemberCount: activeMembers.length,
        pendingInviteCount: pendingInvites.length,
        activeWatchlistCount: activeWatchlists.length,
        termCount,
        activeWebhookCount: activeWebhooks.length,
        latestWatchlistAt,
        latestWebhookAt,
        sourceCoverage: input.operations ? {
            sourceCount: input.operations.counts.sourceCount,
            activeSourceCount: input.operations.counts.activeSourceCount,
            captureCount: input.operations.counts.captureCount,
            watchlistMatchCount,
            latestRunStatus: input.operations.latestRun?.status,
            latestRunAt: input.operations.latestRun?.updatedAt,
        } : undefined,
        liveAlertCount: input.liveAlertCount ?? 0,
        liveAlertIds: [...liveAlertIds],
        dashboardAlertDelivery,
        latestDelivery,
        externalReadiness: input.externalReadiness,
    })
    const fullChainBlockedBy = productReadiness
        .filter(item => item.status !== 'ready' && PRODUCT_READINESS_FULL_CHAIN_GATE_IDS.includes(item.id as typeof PRODUCT_READINESS_FULL_CHAIN_GATE_IDS[number]))
        .map(item => `${item.label}: ${item.detail}`)
    const fullChainReady = fullChainBlockedBy.length === 0

    return {
        scope: input.scope,
        organization,
        members: input.organizationState.members,
        pendingInvites,
        watchlists: input.watchlists,
        webhookDestinations: input.organizationState.webhooks,
        readiness: {
            activeMemberCount: activeMembers.length,
            pendingInviteCount: pendingInvites.length,
            activeWatchlistCount: activeWatchlists.length,
            termCount,
            activeWebhookCount: activeWebhooks.length,
            alertVisibilityPolicy: organization?.alertVisibilityPolicy || 'members',
            blockedReasons,
            liveAlertCount: input.liveAlertCount ?? 0,
            sourceCoverage: input.operations ? {
                sourceCount: input.operations.counts.sourceCount,
                activeSourceCount: input.operations.counts.activeSourceCount,
                captureCount: input.operations.counts.captureCount,
                watchlistMatchCount,
                latestRunStatus: input.operations.latestRun?.status,
                latestRunAt: input.operations.latestRun?.updatedAt,
            } : undefined,
            latestDelivery: latestDelivery ? {
                id: latestDelivery.id,
                alertId: latestDelivery.alertId,
                status: latestDelivery.status,
                deliveryKind: latestDelivery.deliveryKind,
                attemptedAt: latestDelivery.attemptedAt,
                webhookDestinationId: latestDelivery.webhookDestinationId,
                endpointHash: latestDelivery.endpointHash,
                payloadHash: latestDelivery.payloadHash,
                httpStatus: latestDelivery.httpStatus,
                error: latestDelivery.error,
            } : undefined,
            fullChainReady,
            fullChainBlockedBy,
            productReadiness,
        },
        links: organization ? [
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members API' },
            { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks API' },
            { href: '/api/findings/watchlists', label: 'Watchlists API' },
            { href: '/findings', label: 'DWM console' },
        ] : [
            { href: '/api/organizations', label: 'Organizations API' },
            { href: '/findings', label: 'DWM console' },
        ],
        createWatchlistAction: input.backendConfigured && organization ? {
            id: 'create_shared_watchlist_term',
            label: 'Create shared term',
            method: 'POST' as const,
            href: '/api/findings/watchlists',
            body: {
                ...actionScope(input.scope),
                name: organization ? `${organization.name} shared exposure watchlist` : 'Shared exposure watchlist',
                webhookDestinationId: activeWebhooks[0]?.id,
            },
        } : undefined,
    }
}
