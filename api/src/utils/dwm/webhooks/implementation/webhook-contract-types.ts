import { clean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery, toDwmWebhookDestination } from '../../webhookDestinationModels.ts'
import { validateOutboundThirdPartyReport } from '../../thirdPartyReport.ts'
import { type OrganizationVisibilityDecisionInput } from '#utils/organizations.ts'

export function outboundReportAuditMetadata(alert: Record<string, unknown>) {
    if (alert.report === undefined) return {}
    const validation = validateOutboundThirdPartyReport(alert.report)
    if (!validation.valid || !validation.report) return { reportValidation: 'invalid' }
    const policy = recordOrEmpty(validation.report.reportPolicy)
    return {
        reportDirection: clean(policy.direction),
        reportFormat: clean(policy.format),
        reportCaseId: clean(policy.caseId),
        reportAlertId: clean(policy.alertId),
        reportEvidenceCount: Number(policy.evidenceCount),
        reportExportChecksum: clean(validation.report.exportChecksum),
        reportValidation: 'valid'
    }
}

export type DwmWebhookDeliveryEvidenceFilters = {
    orgId?: unknown
    destinationId?: unknown
    alertId?: unknown
    casePath?: unknown
    caseActionId?: unknown
    caseActionPath?: unknown
    dedupeKey?: unknown
    requestId?: unknown
    deliveryId?: unknown
    idempotencyKey?: unknown
    action?: unknown
    status?: unknown
    timeFrom?: unknown
    timeTo?: unknown
    retryState?: unknown
    actorId?: unknown
    reportCaseId?: unknown
    reportExportChecksum?: unknown
}

export type DwmWebhookDeliveryEvidenceOptions = {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
}

export type DwmWebhookDeliveryEvidenceAccessOptions = DwmWebhookDeliveryEvidenceOptions & {
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

export type DwmWebhookDestinationDeliveryAccessOptions = {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

export type DwmWebhookDestinationVisibilityOptions = {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

export type DwmWebhookDestinationLifecycleOptions = Pick<
    DwmWebhookDestinationVisibilityOptions,
    'destinations' | 'deliveries' | 'auditEvents' | 'liveDeliveryEnabled' | 'viewerRole' | 'canManage'
>

export type DwmWebhookDeliveryAttemptState = 'queued' | 'sent' | 'failed' | 'skipped'

export type DwmWebhookDeliveryOperationBlockerCode =
    | 'missing_org'
    | 'missing_alert_context'
    | 'destination_unavailable'
    | 'destination_disabled'
    | 'destination_unhealthy'
    | 'missing_webhook_url'
    | 'dedupe_already_delivered'
    | 'retry_not_eligible'
    | 'live_delivery_disabled'
    | 'not_found'

export type DwmWebhookDestinationAdminProofBlockerCode =
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'no_live_endpoint'
    | 'destination_unhealthy'
    | 'missing_org_alert_context'
    | 'permission_denied'
    | 'dedupe_already_delivered'
    | 'audit_missing'
    | 'retry_not_eligible'

export type DwmWebhookDestinationCrudAction = 'create' | 'update' | 'disable' | 'delete' | 'enable' | 'test'

export type DwmWebhookDestinationCrudBlockerCode =
    | 'invalid_url'
    | 'unsupported_destination_type'
    | 'duplicate_destination'
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'unhealthy_destination'
    | 'entitlement_plan_denied'
    | 'permission_denied'
    | 'org_scope_mismatch'
    | 'audit_missing'
    | 'idempotency_duplicate'
    | 'retry_not_eligible'

export type DwmWebhookEvidenceVisibilityInput = OrganizationVisibilityDecisionInput

export type DwmWebhookDeliveryPublic = ReturnType<typeof toDwmWebhookDelivery>

export type DwmWebhookAuditPublic = ReturnType<typeof toDwmWebhookAuditEvent>

export type DwmWebhookDestinationPublic = ReturnType<typeof toDwmWebhookDestination>

export function isLiveDeliveredProof(test: { status?: string | null, dryRun?: boolean | null, live?: boolean | null } | null | undefined) {
    return test?.status === 'delivered' && test.dryRun === false && test.live !== false
}
