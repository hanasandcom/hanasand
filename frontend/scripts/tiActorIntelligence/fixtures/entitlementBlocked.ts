import { buildTiActionability } from '../../../src/utils/ti/actionability'
import { fixture, profile, victims } from '../runtimeContext'

export const entitlementBlocked = buildTiActionability({
    ...fixture,
    query: 'apt29 entitlement blocked',
    actionability: {
        ...fixture.actionability,
        watchlistMatches: [{
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            watchlistId: 'watchlist_1',
            watchlistItemId: 'watch_1',
            kind: 'company',
            value: 'Microsoft',
        }],
        sourceProvenance: [
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82, captureId: 'capture_1' },
        ],
        relatedAlerts: [{
            id: 'dwm_alert_1',
            title: 'Microsoft actor relevance matched watchlist',
            status: 'pending_review',
            severity: 'high',
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            captureIds: ['capture_1'],
            webhookDestinationIds: ['webhook_1'],
            deliveryReadinessContext: {
                schemaVersion: 'dwm.alert_delivery_persistence.v1',
                state: 'blocked',
                ready: false,
                blockerCodes: ['entitlement_denied'],
                selectedCaptureIds: ['capture_1'],
                webhookDestinationIds: ['webhook_1'],
                entitlement: { status: 'active', blockedReasons: ['alert_rebuilds_today'] },
            },
        }],
        relatedWebhookDestinations: [{ id: 'webhook_1', name: 'SOC incident intake', status: 'active' }],
        entitlementReadiness: {
            schemaVersion: 'dwm.entitlement_readiness.v1',
            actions: {
                alert_rebuild: {
                    ownerLane: 'alert-workflow',
                    status: 'blocked',
                    blockerCodes: ['alert_rebuilds_today'],
                    route: '/v1/dwm/alerts/rebuild',
                    dashboardText: 'This organization has reached the alert rebuild limit.',
                    helpdeskText: 'Raise the alert rebuild limit or retry after the daily window resets.',
                },
            },
        },
    },
}, profile, victims)
