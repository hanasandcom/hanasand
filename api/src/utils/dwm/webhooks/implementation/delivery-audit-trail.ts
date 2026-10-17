import { buildDwmWebhookDeliveryAuditTrailProjection } from '../deliveryAuditTrailProjection.ts'
import { buildDwmWebhookDeliveryEvidence, normalizeWebhookEvidenceFilters } from '../../webhookDeliveryEvidence.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { organizationVisibilityDecision } from '#utils/organizations.ts'
import { type DwmWebhookAuditPublic, type DwmWebhookDeliveryPublic, type DwmWebhookDestinationPublic, type DwmWebhookDeliveryEvidenceFilters, type DwmWebhookEvidenceVisibilityInput } from './webhook-contract-types.ts'
import { webhookVisibilityDecision, webhookAccess } from './webhook-visibility-decision.ts'
import { auditTrailBlocker } from './retry-queue-blocker.ts'
import { buildDwmWebhookDeliveryRetryWorkOrders } from './delivery-retry-work-orders.ts'

export function buildDwmWebhookDeliveryAuditTrail({
    auditEvents,
    deliveries = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    auditEvents: DwmWebhookAuditPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage'] as const)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const deniedBlocker = auditTrailBlocker('permission_denied', 'Webhook delivery audit trail is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.audit_trail.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                destination: 0,
                delivery: 0,
                failed: 0,
                retryable: 0,
                replay: 0,
                memberSafe: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const retryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
        auditEvents,
        deliveries,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    return buildDwmWebhookDeliveryAuditTrailProjection({
        auditContracts,
        retryWorkOrders,
        filters: normalizedFilters,
        liveDeliveryEnabled,
        decision,
        access,
    })
}

export function filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence,
    visibility,
}: {
    evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>
    visibility: DwmWebhookEvidenceVisibilityInput
}) {
    const decision = organizationVisibilityDecision(visibility)
    return {
        decision,
        deliveryEvidence: decision.allowed ? evidence : [],
    }
}
