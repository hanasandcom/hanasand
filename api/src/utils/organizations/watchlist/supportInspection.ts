import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistSupportInspection } from '../contracts/supportInspection.ts'
import type { OrganizationWatchlistAlertBridgeContract } from '../contracts/alertBridge.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationSharedWatchlistSupportInspection(input: {
    organizationId: string
    tenantId: string
    redactedSummary: OrganizationWatchlistAlertBridgeContract['redactedSummary']
    supportVisibility: OrganizationWatchlistAlertBridgeContract['supportVisibility']
    supportAccess: OrganizationWatchlistAlertBridgeContract['supportAccess']
    audit: OrganizationSharedWatchlistDownstreamProof['audit']
}): OrganizationSharedWatchlistSupportInspection {
    const safeFields = input.supportVisibility.safeFields
    const redactedFields = [
        ...new Set([
            ...input.supportVisibility.redactedFields,
            'sharedWatchlistDownstreamProof.activeTerms',
            'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys',
        ]),
    ].sort()
    const auditFields = [
        ...input.audit.requiredMetadataFields,
        ...input.audit.actorFields,
    ].sort()
    const guardrails = organizationSharedWatchlistSupportGuardrails({
        safeFields,
        redactedFields,
        auditFields,
        canInspectRawTerms: false,
    })

    return {
        schemaVersion: 'organization.shared_watchlist_support_inspection.v1',
        ...organizationTenantIdentity(input.organizationId, input.tenantId),
        supportMode: 'redacted_summary_only',
        route: 'GET /api/admin/support/organizations/:id',
        supportActionContract: input.supportVisibility.contract,
        redactionRequired: true,
        canInspectRawTerms: false,
        containsRawTerms: false,
        summary: {
            activeTermCount: input.redactedSummary.activeTermCount,
            pausedCount: input.redactedSummary.pausedCount,
            archivedCount: input.redactedSummary.archivedCount,
            termFamilies: input.redactedSummary.termFamilies,
            visibilityPolicy: input.redactedSummary.visibilityPolicy,
            allowedViewerRoles: input.redactedSummary.allowedViewerRoles,
            cleanupRequired: input.redactedSummary.cleanupRequired,
        },
        safeFields,
        redactedFields,
        auditFields,
        downstreamCorrelationFields: input.audit.downstreamCorrelationFields,
        blockerCodes: ['support_redaction_required', input.supportAccess.blockerCode],
        guardrails,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}

function organizationSharedWatchlistSupportGuardrails(input: {
    safeFields: string[]
    redactedFields: string[]
    auditFields: string[]
    canInspectRawTerms: boolean
}): OrganizationSharedWatchlistSupportInspection['guardrails'] {
    const requiredSafeFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredSafeFields'] = [
        'activeTermCount',
        'termFamilies',
        'visibilityPolicy',
        'allowedViewerRoles',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredRedactedFields'] = [
        'activeTerms[].term',
        'member.userId',
        'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys',
    ]
    const requiredAuditFields: OrganizationSharedWatchlistSupportInspection['guardrails']['requiredAuditFields'] = [
        'requestId',
        'actor.role',
    ]
    const blockerCodes: OrganizationSharedWatchlistSupportInspection['guardrails']['blockerCodes'] = []

    if (!requiredSafeFields.every(field => input.safeFields.includes(field))) {
        blockerCodes.push('support_safe_fields_missing')
    }
    if (!requiredRedactedFields.every(field => input.redactedFields.includes(field))) {
        blockerCodes.push('support_redaction_missing')
    }
    if (!requiredAuditFields.every(field => input.auditFields.includes(field))) {
        blockerCodes.push('support_audit_missing')
    }
    if (input.canInspectRawTerms) {
        blockerCodes.push('support_raw_access_enabled')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_support_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredSafeFields,
        requiredRedactedFields,
        requiredAuditFields,
        rawTermAccessAllowed: false,
        blockerCodes,
    }
}
