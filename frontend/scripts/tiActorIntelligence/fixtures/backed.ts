import { buildTiActionability } from '../../../src/utils/ti/actionability'
import { fixture, profile, victims } from '../runtimeContext'

export const backed = buildTiActionability({
    ...fixture,
    query: 'apt29 microsoft',
    actionability: {
        ...fixture.actionability,
        alertDisposition: 'case_ready',
        shouldAlert: true,
        watchlistMatches: [{
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            watchlistId: 'watchlist_1',
            watchlistItemId: 'watch_1',
            kind: 'company',
            value: 'Microsoft',
            route: 'organization_watchlist',
            casePath: '/findings?organizationId=org_1&watchlistItemId=watch_1',
        }],
        relatedAlerts: [{
            id: 'dwm_alert_1',
            title: 'Microsoft actor relevance matched watchlist',
            status: 'pending_review',
            severity: 'high',
            caseIdCandidate: 'case_1',
            casePath: '/v1/cases/case_1?alertId=dwm_alert_1',
            source: 'DWM alerts API',
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            dedupeKey: 'apt29:microsoft',
            recommendedRoute: 'analyst_review',
            captureIds: ['capture_1'],
            evidenceCount: 2,
            webhookDestinationIds: ['webhook_1'],
        }],
        relatedCases: [{
            id: 'case_1',
            title: 'Microsoft actor relevance',
            status: 'open',
            priority: 'high',
            path: '/v1/cases/case_1?alertId=dwm_alert_1',
        }],
        relatedWebhookDestinations: [{
            id: 'webhook_1',
            name: 'SOC incident intake',
            status: 'active',
            path: '/findings',
        }],
        sourceProvenance: [
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82, captureId: 'capture_1' },
        ],
        handoffs: {
            caseCreate: {
                method: 'POST',
                endpoint: '/v1/cases',
                payload: { alertId: 'dwm_alert_1', title: 'Microsoft actor relevance', priority: 'high' },
            },
        },
    },
}, profile, victims)
