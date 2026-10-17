import { clean } from '../../webhookValueUtils.ts'
import { buildDwmWebhookDeliveryEvidenceProjection } from '../../webhookDeliveryEvidence.ts'
import { organizationVisibilityDecision, type OrganizationRole } from '#utils/organizations.ts'
import { type DwmWebhookEvidenceVisibilityInput, type DwmWebhookDeliveryEvidenceOptions } from './webhook-contract-types.ts'
import { buildDwmWebhookDeliveryHistoryWithRetryPersistence } from './delivery-history-with-retry-persistence.ts'

export function webhookVisibilityDecision(visibility: DwmWebhookEvidenceVisibilityInput | null) {
    return visibility
        ? organizationVisibilityDecision(visibility)
        : {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members' as const,
            allowedRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] as OrganizationRole[],
        }
}

export type DwmWebhookAccessCapability = 'canManage' | 'canReplay' | 'canTest' | 'canRetry' | 'canCreate' | 'canUpdate' | 'canDelete' | 'canDeliver'

export type DwmWebhookAccess<Capabilities extends readonly DwmWebhookAccessCapability[]> = {
    role: string | null
    canRead: boolean
    memberSafe: boolean
} & Record<Capabilities[number], boolean>

export function webhookAccess<Capabilities extends readonly DwmWebhookAccessCapability[]>(
    decision: ReturnType<typeof webhookVisibilityDecision>,
    viewerRole: string | null,
    canManage: boolean,
    capabilities: Capabilities,
): DwmWebhookAccess<Capabilities> {
    const canManageResource = decision.allowed && canManage
    return {
        role: clean(viewerRole) || null,
        canRead: decision.allowed,
        ...Object.fromEntries(capabilities.map(capability => [capability, canManageResource])),
        memberSafe: decision.allowed && !canManage,
    } as DwmWebhookAccess<Capabilities>
}

export function webhookDeliveryVisibilityAccess(
    visibility: DwmWebhookEvidenceVisibilityInput | null,
    viewerRole: string | null,
    canManage: boolean,
) {
    const decision = webhookVisibilityDecision(visibility)
    return {
        decision,
        access: webhookAccess(decision, viewerRole, canManage, ['canManage', 'canRetry'] as const),
    }
}

export function buildDwmWebhookDeliveryHistory({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    return buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now: new Date(),
    }).history
}

export type DwmWebhookDeliveryProjectionContext = {
    projection: ReturnType<typeof buildDwmWebhookDeliveryEvidenceProjection>
    now: Date
}

export function prepareDwmWebhookDeliveryProjectionContext({
    deliveries,
    auditEvents,
    filters,
    now = new Date(),
}: Pick<DwmWebhookDeliveryEvidenceOptions, 'deliveries' | 'auditEvents' | 'filters'> & { now?: Date }): DwmWebhookDeliveryProjectionContext {
    return {
        projection: buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents, filters }),
        now,
    }
}
