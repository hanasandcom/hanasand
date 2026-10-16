import type { FastifyReply, FastifyRequest } from 'fastify'
import { withTransaction } from '#db'
import { activeOrganizationOwnerCount } from '#utils/organizationMemberships.ts'
import {
    normalizeOrganizationSettingsInput,
    organizationLifecycleReadiness,
    organizationSettingsFromRow,
    organizationSettingsMutationDenial,
    roleCanManageOrganization,
    toOrganization,
    type OrganizationSettingsInput,
} from '#utils/organizations.ts'
import { logOrganizationEvent } from './audit.ts'
import { organizationSettingsPermissions, privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from './lifecycle.ts'
import { loadOrganizationForMember, loadRequiredOrganizationMemberRequest, uniqueOrganizationSlug } from './requestContext.ts'

type OrganizationParams = { id: string }

export async function putOrganizationSettings(req: FastifyRequest<{ Params: OrganizationParams, Body: OrganizationSettingsInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'update organization settings')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanManageOrganization(organization.role)) {
        const attemptedFields = Object.entries({
            name: req.body?.name,
            slug: req.body?.slug,
            defaultWebhookPolicy: req.body?.defaultWebhookPolicy ?? req.body?.default_webhook_policy,
            alertVisibilityPolicy: req.body?.alertVisibilityPolicy ?? req.body?.alert_visibility_policy,
            lifecycleStatus: req.body?.lifecycleStatus ?? req.body?.lifecycle_status,
            retentionDays: req.body?.retentionDays ?? req.body?.retention_days,
            auditSafeMetadata: req.body?.auditSafeMetadata ?? req.body?.audit_safe_metadata,
        }).filter(([, value]) => value !== undefined).map(([key]) => key)
        const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null
        const message = 'Only organization owners and admins can update settings.'
        const denial = organizationSettingsMutationDenial({
            organizationId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            attemptedFields,
            requestId,
            message,
        })
        logOrganizationEvent(req, denial.serviceLogAction, req.params.id, userId, {
            requestId: denial.requestId,
            actorRole: organization.role,
            attemptedFields: denial.attemptedFields,
            denialReason: denial.denialReason,
        })
        return res.status(403).send({ error: message, settingsMutationDenial: denial })
    }

    let input: ReturnType<typeof normalizeOrganizationSettingsInput>
    try {
        input = normalizeOrganizationSettingsInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid organization settings.' })
    }

    const slug = input.slug ? await uniqueOrganizationSlug(input.slug, req.params.id) : undefined
    const lifecycleUpdate = await withTransaction(async query => {
        await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [req.params.id])
        const lockedOrganization = await loadOrganizationForMember(req.params.id, userId, query)
        if (!lockedOrganization) return { error: 'organization_not_found' as const }
        if (privacyDeletionMutationBlocker(lockedOrganization, 'update organization settings')) {
            return { error: 'organization_deletion_in_progress' as const, organization: lockedOrganization }
        }
        if (!roleCanManageOrganization(lockedOrganization.role)) {
            return { error: 'organization_role_forbidden' as const, organization: lockedOrganization }
        }
        if (input.lifecycleStatus === 'active' && await activeOrganizationOwnerCount(req.params.id, query) < 1) {
            return { error: 'organization_owner_required' as const, organization: lockedOrganization }
        }
        await query(`
            UPDATE organizations
            SET name = COALESCE($2, name),
                slug = COALESCE($3, slug),
                default_webhook_policy = COALESCE($4, default_webhook_policy),
                alert_visibility_policy = COALESCE($5, alert_visibility_policy),
                status = COALESCE($6, status),
                retention_days = COALESCE($7, retention_days),
                audit_safe_metadata = COALESCE($8::jsonb, audit_safe_metadata),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [
            req.params.id,
            input.name ?? null,
            slug ?? null,
            input.defaultWebhookPolicy ?? null,
            input.alertVisibilityPolicy ?? null,
            input.lifecycleStatus ?? null,
            input.retentionDays ?? null,
            input.auditSafeMetadata === undefined ? null : JSON.stringify(input.auditSafeMetadata),
        ])
        return { error: null, organization: lockedOrganization }
    })
    if (lifecycleUpdate.error === 'organization_not_found') return res.status(404).send({ error: 'Organization not found.' })
    if (lifecycleUpdate.error === 'organization_deletion_in_progress') {
        const blocker = privacyDeletionMutationBlocker(lifecycleUpdate.organization!, 'update organization settings')
        return sendOrganizationLifecycleBlocker(req, res, blocker!, userId, lifecycleUpdate.organization!.role)
    }
    if (lifecycleUpdate.error === 'organization_role_forbidden') return res.status(403).send({ error: 'Only organization owners and admins can update settings.' })
    if (lifecycleUpdate.error === 'organization_owner_required') return res.status(409).send({ error: 'Add or transfer ownership to an active member before reactivating the organization.' })
    const authorizedOrganization = lifecycleUpdate.organization!
    const mutatedFields = Object.entries({
        name: input.name,
        slug,
        defaultWebhookPolicy: input.defaultWebhookPolicy,
        alertVisibilityPolicy: input.alertVisibilityPolicy,
        lifecycleStatus: input.lifecycleStatus,
        retentionDays: input.retentionDays,
        auditSafeMetadata: input.auditSafeMetadata === undefined ? undefined : Object.keys(input.auditSafeMetadata),
    }).filter(([, value]) => value !== undefined).map(([key]) => key)

    logOrganizationEvent(req, 'organization_settings_updated', req.params.id, userId, { fields: [...mutatedFields] })

    const updated = await loadOrganizationForMember(req.params.id, userId)
    return res.send({
        organization: updated ? toOrganization(updated) : null,
        settings: updated ? organizationSettingsFromRow(updated) : null,
        permissions: organizationSettingsPermissions(updated?.role),
        lifecycleReadiness: updated ? organizationLifecycleReadiness(updated) : null,
        settingsMutationReceipt: updated ? {
            schemaVersion: 'organization.lifecycle_settings_mutation_receipt.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            actorId: userId,
            actorRole: authorizedOrganization.role,
            previousLifecycleStatus: authorizedOrganization.status ?? 'active',
            lifecycleStatus: updated.status ?? 'active',
            lifecycleChanged: (authorizedOrganization.status ?? 'active') !== (updated.status ?? 'active'),
            mutatedFields: [...mutatedFields],
            blockerReason: updated.status === 'deleted' ? 'org_deleted' as const : updated.status === 'archived' ? 'org_archived' as const : null,
            downstreamReadiness: {
                inviteMutationAllowed: updated.status === 'active',
                watchlistMutationAllowed: updated.status === 'active',
                alertGenerationReady: updated.status === 'active',
                caseVisibilityReady: updated.status === 'active',
                webhookDeliveryReady: updated.status === 'active',
                dashboardReadinessReady: updated.status === 'active',
                supportRedactedReadReady: true,
            },
            downstreamRoutes: {
                invites: 'POST /api/organizations/:id/invites',
                sharedWatchlists: 'GET /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                alertReadiness: 'GET /api/organizations/:id/alert-readiness',
                webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
            },
            downstreamContracts: [
                'organization.watchlist_alert_generation_consumer.v1',
                'organization.case_visibility_consumer.v1',
                'organization.webhook_destination_delivery_consumer.v1',
                'organization.shared_watchlist_readiness_export.v1',
                'organization.lifecycle_downstream_receipt.v1',
            ],
            lifecycleCleanup: {
                activeMembershipRequired: true,
                archivedBlocker: 'org_archived' as const,
                deletedBlocker: 'org_deleted' as const,
                noOrphanedWatchlistAlerts: true,
                noCrossOrgLeakage: true,
                cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup' as const,
            },
            destinationReadiness: {
                destinationOwnerField: 'destination.org_id' as const,
                selectedDestinationIdField: 'webhookDestinationIds[]' as const,
                deliveryBlockedByLifecycle: updated.status !== 'active',
                crossOrgDestinationAllowed: false,
                nonmemberDestinationEnumeration: false,
            },
            noLeakFields: ['activeTerms[]', 'watchlistScope.alertGeneratorKeys', 'destination.secret', 'case.evidence.rawContent', 'otherOrg.watchlistItemIds'],
        } : null,
    })
}
