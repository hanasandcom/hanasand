import type { ProductReadinessExternalState } from '../../src/utils/productProgress/sourceGrowthTypes'
import type { DwmDeliveryItem, DwmOrganizationState, DwmWatchlistSummary, OperatorScope } from '../../src/app/dashboard/operatorConsoleTypes'
import type { ProductReadinessInput } from '../../src/app/dashboard/productReadinessContext'

export const checkedAt = '2026-10-16T10:00:00.000Z'
export const organization = {
    id: 'org-1', tenantId: 'tenant-1', name: 'North', slug: 'north', status: 'active' as const,
    alertVisibilityPolicy: 'members' as const, createdAt: checkedAt, updatedAt: checkedAt,
}

export const watchlists: DwmWatchlistSummary[] = [{
    id: 'watchlist-1', tenantId: 'tenant-1', organizationId: organization.id, name: 'North terms',
    terms: [{ value: 'credential leak', kind: 'phrase' }], status: 'active', createdAt: checkedAt, updatedAt: checkedAt,
}]

export const delivered: DwmDeliveryItem = {
    id: 'delivery-1', alertId: 'alert-1', watchlistId: 'watchlist-1', organizationId: organization.id,
    endpointHash: 'endpoint-hash', attemptedAt: checkedAt, payloadHash: 'payload-hash', status: 'delivered',
    webhookDestinationId: 'webhook-1', httpStatus: 200,
}

export const externalReadiness: ProductReadinessExternalState = {
    publicTiProvenance: { schemaVersion: 'ti.public_provenance.readiness.v1', status: 'ready', checkedAt, artifactCount: 1 },
    helpdeskAudit: { schemaVersion: 'support.audit.readiness.v1', status: 'ready', checkedAt, auditedActions: 1 },
    deployProbe: { schemaVersion: 'product.deploy_probe.readiness.v1', status: 'ready', checkedAt, frontendHealthy: true, apiHealthy: true },
    sourceGrowth: {
        schemaVersion: 'dwm.source_inventory.v1', status: 'ready', checkedAt, proxyExposed: true, workerStatus: 'ready',
        endToEndWorkflow: { status: 'ready', schemaVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1', lastVerifiedAt: checkedAt, stepCount: 8 },
    },
    orgAlertExport: { schemaVersion: 'organization.watchlist_alert_terms_export.v1', status: 'ready', checkedAt, organizationId: organization.id, activeTermCount: 1, canGenerateAlerts: true },
    webhookHealth: { schemaVersion: 'dwm.webhook_health.readiness.v1', status: 'ready', checkedAt, destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 },
    dashboardEvidence: { schemaVersion: 'dashboard.alert_evidence.readiness.v1', status: 'ready', checkedAt, alertId: 'alert-1', deliveryId: delivered.id, visibleInDashboard: true, deliveryEvidenceMatched: true },
    analystWorkflow: { schemaVersion: 'analyst.workflow.readiness.v1', status: 'ready', checkedAt, caseId: 'case-1', alertId: 'alert-1', caseDetailReady: true, caseDetailTimelineCount: 1 },
    entitlement: { schemaVersion: 'dwm.entitlement.readiness.v1', status: 'ready', checkedAt, organizationId: organization.id, allowed: true, checkedRole: 'analyst' },
    dwmProduct: { schemaVersion: 'dwm.product_snapshot.readiness.v1', status: 'ready', checkedAt, alertCount: 1, watchlistTermCount: 1 },
    alertGeneration: { schemaVersion: 'dwm.alert_generation_readiness.v1', status: 'ready', checkedAt, candidateCount: 1, readyForCustomerDelivery: true },
}

export function organizationState(overrides: Partial<DwmOrganizationState> = {}): DwmOrganizationState {
    return {
        organizations: [organization], selectedOrganization: organization,
        members: [{ id: 'member-1', organizationId: organization.id, email: 'analyst@example.test', role: 'analyst', status: 'active', createdAt: checkedAt, updatedAt: checkedAt }],
        pendingInvites: [{ id: 'invite-1', organizationId: organization.id, email: 'pending@example.test', role: 'analyst', status: 'pending', invitedAt: checkedAt, expiresAt: checkedAt, updatedAt: checkedAt }],
        webhooks: [{ id: 'webhook-1', organizationId: organization.id, tenantId: organization.tenantId, name: 'North alerts', kind: 'generic', status: 'active', createdAt: checkedAt, updatedAt: checkedAt }],
        ...overrides,
    }
}

export function productInput(overrides: Partial<ProductReadinessInput> = {}): ProductReadinessInput {
    return {
        backendConfigured: true, scope: { tenantId: organization.tenantId, organizationId: organization.id } as OperatorScope,
        organization, activeWebhooks: organizationState().webhooks, activeMemberCount: 1, pendingInviteCount: 1,
        activeWatchlistCount: 1, termCount: 1, activeWebhookCount: 1, latestWatchlistAt: checkedAt,
        latestWebhookAt: checkedAt, sourceCoverage: { sourceCount: 3, activeSourceCount: 3, captureCount: 4, watchlistMatchCount: 2, latestRunStatus: 'completed', latestRunAt: checkedAt },
        liveAlertCount: 1, liveAlertIds: ['alert-1'], dashboardAlertDelivery: delivered, latestDelivery: delivered,
        externalReadiness, ...overrides,
    }
}

export function operationSnapshot() {
    return { counts: { sourceCount: 3, activeSourceCount: 3, captureCount: 4, watchlistMatchCount: 2 }, latestRun: { status: 'completed', updatedAt: checkedAt, captureCount: 4 } }
}
