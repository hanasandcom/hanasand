import type { OrganizationRow, OrganizationVisibilityDecision } from '#utils/organizations.ts'
import { organizationAlertCaseVisibilityRoutes as routes } from './caseVisibilityRoutes.ts'

export function buildOrganizationAlertCaseVisibilityDenial(input: {
    organization: OrganizationRow
    userId: string
    visibility: OrganizationVisibilityDecision
    requestId: string | null
}) {
    const { organization, userId, visibility } = input
    const role = organization.role ?? 'viewer'
    const reason = visibility.reason ?? 'role_not_allowed'
    const redactedFields = [
        'activeTerms[]',
        'watchlistScope.alertGeneratorKeys',
        'case.evidence.rawContent',
        'destination.secret',
    ]

    return {
        schemaVersion: 'organization.alert_case_visibility_denial.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        member: { userId, role, status: 'active' },
        visibility,
        routes,
        requiredQueryFields: ['organizationId'],
        safeFields: [
            'organizationId',
            'tenantId',
            'member.role',
            'visibility.allowedRoles',
            'visibility.reason',
            'routes',
            'blockerCodes',
        ],
        redactedFields: [
            'activeTerms[]',
            'watchlistScope.alertGeneratorKeys',
            'case.evidence.rawContent',
            'member.userId',
        ],
        blockerCodes: [reason],
        readinessRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1',
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
            alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1',
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1',
        },
        deniedReadDoesNotAffectCases: true,
        deniedReadDoesNotAffectActiveTerms: true,
        nonmemberEnumeration: false,
        analystPortalAdapter: {
            schemaVersion: 'organization.analyst_portal_visibility_denial_adapter.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            memberRole: role,
            visibility,
            routeBindings: routes,
            allowedActions: [],
            actionMatrix: {
                review_alert: { allowed: false, denialReason: reason },
                acknowledge_alert: { allowed: false, denialReason: reason },
                assign_case: { allowed: false, denialReason: reason },
                link_case: { allowed: false, denialReason: reason },
                replay_alert: { allowed: false, denialReason: reason },
                deliver_webhook: { allowed: false, denialReason: reason },
            },
            redactedFields,
            nonmemberEnumeration: false,
        },
        auditProof: {
            schemaVersion: 'organization.alert_case_visibility_denial_audit.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            memberRole: role,
            serviceLogAction: 'organization_alert_case_visibility_denied',
            requestId: input.requestId,
            requiredMetadataFields: ['requestId', 'role', 'allowedRoles', 'denialReason', 'blockerCodes'],
            redactedFields,
            proofLogQuery: 'GET /api/logs?service=api&message=organization_alert_case_visibility_denied',
        },
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}
