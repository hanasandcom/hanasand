import { clean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { buildDwmWebhookDeliveryRetryPersistenceFromProjection } from '../../webhookDeliveryRetryPersistence.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic, type DwmWebhookEvidenceVisibilityInput } from './webhook-contract-types.ts'
import { webhookVisibilityDecision } from './webhook-visibility-decision.ts'
import { dashboardReadinessBlocker, uniqueDashboardReadinessBlockers, dashboardLifecycleActionSummary } from './webhook-setup-routes.ts'
import { prepareDwmWebhookDestinationProjection, buildDwmWebhookDestinationHealthFromProjection } from './dwm-webhook-destination-projection.ts'
import { type buildDwmWebhookDeliveryRetryPersistence } from './delivery-read-projections.ts'
import { buildDashboardReadinessRow } from './dashboard-readiness-row.ts'

export function buildDwmWebhookDashboardReadinessAdapter({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    visibility = null,
    orgStatus = 'active',
    watchlistStatus = 'active',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
    orgStatus?: unknown
    watchlistStatus?: unknown
}) {
    const visibilityDecision = webhookVisibilityDecision(visibility)
    const orgLifecycleStatus = clean(orgStatus).toLowerCase() || 'active'
    const watchlistLifecycleStatus = clean(watchlistStatus).toLowerCase() || 'active'
    const orgBlocked = ['archived', 'disabled', 'deleted', 'suspended'].includes(orgLifecycleStatus)
    const watchlistBlocked = ['archived', 'retired', 'deleted'].includes(watchlistLifecycleStatus)
    const policyBlockers = [
        visibilityDecision.allowed ? null : dashboardReadinessBlocker('policy_blocked', 'Destination readiness is not visible for this actor.', null, visibilityDecision.reason || 'permission_denied'),
        orgBlocked ? dashboardReadinessBlocker('policy_blocked', 'Organization lifecycle blocks webhook delivery.', null, 'org_archived') : null,
        watchlistBlocked ? dashboardReadinessBlocker('policy_blocked', 'Retired or archived watchlist blocks alert delivery.', null, 'watchlist_retired') : null,
    ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]

    if (!visibilityDecision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
            liveDeliveryEnabled,
            visibility: visibilityDecision,
            orgStatus: orgLifecycleStatus,
            watchlistStatus: watchlistLifecycleStatus,
            summary: {
                destinationCount: 0,
                verifiedCount: 0,
                blockedCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
                disabledCount: 0,
                policyBlockedCount: 1,
                lifecycleCounts: {
                    active: 0,
                    disabled: 0,
                    failed: 0,
                    revokedOwner: 0,
                    secretRotated: 0,
                    testRequired: 0,
                },
                lifecycleActions: [],
            },
            blockers: policyBlockers,
            destinations: [],
        }
    }

    const now = new Date()
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        now,
    })
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistenceFromProjection({
        destinations,
        filters: {},
        liveDeliveryEnabled,
        ledger: projection.deliveryLedger,
        auditContracts: projection.auditContracts,
    })
    const deliveriesById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const auditContracts = projection.auditContracts
    const auditByDestination = new Map<string, typeof auditContracts>()
    const dashboardCanManage = ['owner', 'admin'].includes(clean(recordOrEmpty(visibility).role).toLowerCase())
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
    const retryKeysByDestination = new Map<string, ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys']>()
    for (const key of retryPersistence.deliveryKeys) {
        if (!key.destinationId) continue
        const keys = retryKeysByDestination.get(key.destinationId) || []
        keys.push(key)
        retryKeysByDestination.set(key.destinationId, keys)
    }
    const rows = destinationHealth.map(health => buildDashboardReadinessRow({
        health,
        policyBlockers,
        deliveriesById,
        destinationById,
        auditByDestination,
        dashboardCanManage,
        retryKeysByDestination,
        liveDeliveryEnabled,
    }))

    return {
        schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
        liveDeliveryEnabled,
        visibility: visibilityDecision,
        orgStatus: orgLifecycleStatus,
        watchlistStatus: watchlistLifecycleStatus,
        summary: {
            destinationCount: rows.length,
            verifiedCount: rows.filter(row => row.healthStates.includes('verified')).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
            retryScheduledCount: rows.filter(row => row.healthStates.includes('retry_scheduled')).length,
            terminalFailureCount: rows.filter(row => row.healthStates.includes('terminal_failure')).length,
            disabledCount: rows.filter(row => row.healthStates.includes('disabled')).length,
            policyBlockedCount: rows.filter(row => row.healthStates.includes('policy_blocked')).length,
            lifecycleCounts: {
                active: rows.filter(row => row.lifecycleState.active).length,
                disabled: rows.filter(row => row.lifecycleState.disabled).length,
                failed: rows.filter(row => row.lifecycleState.failed).length,
                revokedOwner: rows.filter(row => row.lifecycleState.revokedOwner).length,
                secretRotated: rows.filter(row => row.lifecycleState.secretRotated).length,
                testRequired: rows.filter(row => row.lifecycleState.testRequired).length,
            },
            lifecycleActions: dashboardLifecycleActionSummary(rows),
        },
        blockers: uniqueDashboardReadinessBlockers([
            ...policyBlockers,
            ...rows.flatMap(row => row.blockers),
        ]),
        destinations: rows,
    }
}
