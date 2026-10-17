import type { OrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationRolesFor } from './roleActions.ts'

export function organizationSettingsMutationDenial(input: {
    organizationId: string
    actorId: string
    actorRole?: OrganizationRole | null
    attemptedFields: string[]
    requestId?: string | null
    message: string
}) {
    const attemptedFields = [...new Set(input.attemptedFields)].sort()
    return {
        schemaVersion: 'organization.settings_mutation_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        attemptedFields,
        denialReason: 'role_not_allowed' as const,
        message: input.message,
        statusCode: 403,
        allowedRoles: organizationRolesFor('managers'),
        readableRoles: organizationRolesFor('sharedWatchlistReaders'),
        editableFields: ['name', 'slug', 'defaultWebhookPolicy', 'alertVisibilityPolicy', 'retentionDays', 'auditSafeMetadata'] as const,
        memberCanReadSettings: true,
        memberCanUpdateSettings: false,
        viewerCanReadSettings: true,
        viewerCanUpdateSettings: false,
        nonmemberEnumeration: false as const,
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'actorRole',
            'attemptedFields',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'auditSafeMetadata.sensitive',
            'otherOrg.settings',
            'destination.secret',
            'member.email',
        ],
        serviceLogAction: 'organization_settings_mutation_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

export function organizationAccessDenial(input: {
    organizationId: string
    actorId: string
    route:
        | 'GET /api/organizations/:id'
        | 'GET /api/organizations/:id/watchlists'
        | 'GET /api/organizations/:id/alert-readiness'
        | 'GET /api/organizations/:id/watchlists/alert-terms'
        | 'GET /api/organizations/:id/alert-case-visibility'
    requestId?: string | null
}) {
    return {
        schemaVersion: 'organization.access_denial.v1' as const,
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        actorId: input.actorId,
        route: input.route,
        blockerCode: 'nonmember_denied' as const,
        denialReason: 'not_member' as const,
        statusCode: 404,
        nonmemberEnumeration: false as const,
        message: 'Organization not found.',
        safeFields: [
            'schemaVersion',
            'organizationId',
            'tenantId',
            'route',
            'blockerCode',
            'denialReason',
            'requestId',
        ],
        noLeakFields: [
            'organization.members',
            'organization.invites',
            'watchlistScope.alertGeneratorKeys',
            'activeTerms[]',
            'otherOrg.caseIds',
            'otherOrg.destinationIds',
            'destination.secret',
        ],
        downstreamRoutes: {
            watchlists: 'GET /api/organizations/:id/watchlists',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
        },
        downstreamRefs: {
            sharedWatchlistReadiness: 'organization.shared_watchlist_readiness_export.v1' as const,
            alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1' as const,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1' as const,
            webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
            webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1' as const,
        },
        serviceLogAction: 'organization_access_denied' as const,
        requestId: input.requestId ?? null,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts' as const,
    }
}

