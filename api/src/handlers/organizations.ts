import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import run from '#db'
import { touchOrganization } from '#utils/db/identityDataWrites.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { checkBillingCapacity } from './billing.ts'
import {
    buildOrganizationBridgeContext,
    buildOrganizationDwmAlertReference,
    normalizeWatchlistActionInput,
    normalizeWatchlistCleanupInput,
    normalizeWatchlistInput,
    normalizeWatchlistRequestId,
    organizationAnalystPortalVisibilityAdapter,
    organizationAlertCaseWorkflowState,
    organizationLifecycleReadiness,
    organizationReadinessProof,
    organizationSharedWatchlistProjection,
    roleCanWriteWatchlist,
    organizationVisibilityDecision,
    organizationWatchlistOwnerContext,
    organizationWatchlistAlertTermsExport,
    organizationWatchlistAlertTermsExportDenial,
    organizationWatchlistMutationDenial,
    roleCanManageOrganization,
    toOrganization,
    toWatchlistItem,
    type OrganizationRow,
    type WatchlistActionInput,
    type WatchlistCleanupInput,
    type WatchlistInput,
    type OrganizationWatchlistRow,
} from '#utils/organizations.ts'
import { logOrganizationEvent, sendOrganizationAccessDenial } from './organizations/audit.ts'
import { sendWatchlistLookupDenial } from './organizations/watchlists/lookupDenial.ts'
import { organizationTeamOnboardingReadiness } from './organizations/watchlists/readContract.ts'
import { inactiveOrganizationMutationBlocker, privacyDeletionMutationBlocker, sendOrganizationLifecycleBlocker } from './organizations/lifecycle.ts'
import {
    loadOrganizationMemberRequest,
    loadRequiredOrganizationMemberRequest,
} from './organizations/requestContext.ts'
export { getOrganization, postOrganization } from './organizations/core.ts'
export { deleteOrganizationApiKey, getOrganizationApiKeys, postOrganizationApiKey } from './organizations/apiKeys.ts'
export { getOrganizationSettings } from './organizations/settingsRead.ts'
export { putOrganizationSettings } from './organizations/settingsUpdate.ts'
export { postOrganizationOwnershipTransfer } from './organizations/ownershipTransfer.ts'
export { getOrganizationInvites } from './organizations/invites/read.ts'
export { postOrganizationInvites } from './organizations/invites/create.ts'
export { postOrganizationInviteAction } from './organizations/invites/action.ts'
export { postOrganizationInviteAccept } from './organizations/invites/accept.ts'
export { getOrganizationMembers } from './organizations/members/read.ts'
export { deleteOrganizationMember } from './organizations/members/remove.ts'
export { patchOrganizationMemberRole } from './organizations/members/role.ts'
export { getOrganizationWatchlists, getOrganizationWatchlist } from './organizations/watchlists/read.ts'

type OrganizationParams = {
    id: string
}

type WatchlistParams = {
    organizationId: string
    itemId: string
}

type WatchlistMutationBody = WatchlistInput & {
    requestId?: unknown
    request_id?: unknown
}


export async function getOrganizationAlertReadiness(req: FastifyRequest<{ Params: OrganizationParams }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/alert-readiness',
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
          AND status = 'active'
        ORDER BY kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const bridgeContext = buildOrganizationBridgeContext({
        ...organization,
        shared_watchlist_count: watchlistItems.length,
    })
    const bridgeOrganization = {
        ...organization,
        shared_watchlist_count: bridgeContext.sharedWatchlistCount,
    }
    const generatedAlertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(bridgeOrganization, item))
    const teamOnboardingReadiness = organizationTeamOnboardingReadiness(bridgeContext)
    const sharedProjection = organizationSharedWatchlistProjection(bridgeOrganization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const alertGenerationBridge = sharedProjection.alertGeneration
    const downstreamAuthorization = sharedProjection.downstreamAuthorization
    const lifecycleReadiness = organizationLifecycleReadiness(bridgeOrganization)
    const readinessProof = organizationReadinessProof({
        lifecycleReadiness,
        alertGenerationBridge,
        downstreamAuthorization,
    })
    const sharedWatchlistDownstreamProof = sharedProjection.sharedWatchlistDownstreamProof

    return res.send({
        organization: toOrganization(organization),
        alertReadiness: {
            schemaVersion: 'organization.dwm_alert_readiness.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            defaultWebhookPolicy: bridgeContext.defaultWebhookPolicy,
            alertVisibilityPolicy: bridgeContext.alertVisibilityPolicy,
            memberCount: bridgeContext.memberCount,
            activeMemberCount: bridgeContext.activeMemberCount,
            ownerCount: bridgeContext.ownerCount,
            allowedViewerRoles: bridgeContext.allowedViewerRoles,
            removedMemberDenialReason: bridgeContext.removedMemberDenialReason,
            deactivatedMemberDenialReason: bridgeContext.deactivatedMemberDenialReason,
            pendingInviteCount: bridgeContext.pendingInviteCount,
            sharedWatchlistCount: bridgeContext.sharedWatchlistCount,
            readinessStatus: bridgeContext.readinessStatus,
            ready: generatedAlertReferences.length > 0,
            teamOnboardingReadiness,
            lifecycleReadiness,
            readinessProof,
            sharedWatchlistDownstreamProof,
            alertGenerationBridge,
            downstreamAuthorization,
            watchlistItemCount: generatedAlertReferences.length,
            generatedAlertReferences,
            downstreamFields: [
                'organizationId',
                'tenantId',
                'watchlistItemId',
                'watchlist.id',
                'watchlist.terms',
                'watchlist.status',
                'watchlist.createdBy',
                'watchlist.updatedBy',
                'matchedTerm',
                'route',
                'casePath',
                'dedupeKey',
                'defaultWebhookPolicy',
                'alertVisibilityPolicy',
                'memberCount',
                'activeMemberCount',
                'ownerCount',
                'allowedViewerRoles',
                'removedMemberDenialReason',
                'deactivatedMemberDenialReason',
                'pendingInviteCount',
                'sharedWatchlistCount',
                'readinessStatus',
                'teamOnboardingReadiness',
                'lifecycleReadiness',
                'readinessProof',
                'readinessProof.routes',
                'readinessProof.worker3Proof',
                'readinessProof.uiProof',
                'readinessProof.blockers',
                'alertGenerationBridge',
                'alertGenerationBridge.activeWatchlistTerms',
                'alertGenerationBridge.activeWatchlistTerms.status',
                'alertGenerationBridge.activeWatchlistTerms.createdBy',
                'alertGenerationBridge.activeWatchlistTerms.updatedBy',
                'alertGenerationBridge.termFamilies',
                'alertGenerationBridge.blockedReasons',
                'downstreamAuthorization.organizationId',
                'downstreamAuthorization.member.role',
                'downstreamAuthorization.watchlists.states',
                'downstreamAuthorization.allowedActions',
                'downstreamAuthorization.downstream.alertGeneration.blockerCodes',
            ],
        },
    })
}

export async function getOrganizationWatchlistAlertTerms(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
        })
    }

    const requestId = normalizeWatchlistRequestId(req.query?.requestId ?? req.query?.request_id)
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    if (!visibility.allowed) {
        const deniedExport = organizationWatchlistAlertTermsExportDenial({
            organizationId: organization.id,
            tenantId: organization.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
            },
            visibility,
            requestId,
        })
        logOrganizationEvent(req, 'organization_watchlist_alert_terms_export_denied', req.params.id, userId, {
            requestId,
            role: organization.role,
            alertVisibilityPolicy: visibility.alertVisibilityPolicy,
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason,
            blockerCodes: deniedExport.blockerCodes,
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to export alert terms.',
            organization: toOrganization(organization),
            alertTermsExportDenial: deniedExport,
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const exportContract = organizationWatchlistAlertTermsExport(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })

    logOrganizationEvent(req, 'organization_watchlist_alert_terms_exported', req.params.id, userId, {
        requestId,
        activeTermCount: exportContract.activeTerms.length,
        pausedCount: exportContract.excluded.pausedCount,
        archivedCount: exportContract.excluded.archivedCount,
        canGenerateAlerts: exportContract.canGenerateAlerts,
    })

    return res.send({
        organization: toOrganization(organization),
        alertTermsExport: exportContract,
    })
}

export async function getOrganizationAlertCaseVisibility(req: FastifyRequest<{ Params: OrganizationParams, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext
    if (!organization) {
        return sendOrganizationAccessDenial(req, res, {
            organizationId: req.params.id,
            actorId: userId,
            route: 'GET /api/organizations/:id/alert-case-visibility',
            requestId: req.query?.requestId ?? req.query?.request_id ?? (req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null),
        })
    }

    const result = await run(`
        SELECT *
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND archived_at IS NULL
        ORDER BY status ASC, kind ASC, value ASC
    `, [req.params.id])
    const watchlistItems = result.rows as OrganizationWatchlistRow[]
    const sharedProjection = organizationSharedWatchlistProjection(organization, watchlistItems, {
        userId,
        role: organization.role ?? 'viewer',
    })
    const downstreamAuthorization = sharedProjection.downstreamAuthorization
    const downstreamProof = sharedProjection.sharedWatchlistDownstreamProof
    const visibility = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    const routes = {
        alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId',
        alertDetail: 'GET /v1/dwm/alerts/:id',
        caseList: 'GET /v1/cases?organizationId=:organizationId',
        caseDetail: 'GET /v1/cases/:id',
        webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
    } as const

    if (!visibility.allowed) {
        const requestId = typeof req.query?.requestId === 'string' ? req.query.requestId : typeof req.query?.request_id === 'string' ? req.query.request_id : null
        logOrganizationEvent(req, 'organization_alert_case_visibility_denied', organization.id, userId, {
            requestId,
            role: organization.role ?? 'viewer',
            allowedRoles: visibility.allowedRoles,
            denialReason: visibility.reason ?? 'role_not_allowed',
            blockerCodes: [visibility.reason ?? 'role_not_allowed'],
        })
        return res.status(403).send({
            error: 'Organization alert visibility does not allow this member to list org alerts or cases.',
            organization: toOrganization(organization),
            alertCaseVisibility: {
                schemaVersion: 'organization.alert_case_visibility_denial.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                member: {
                    userId,
                    role: organization.role ?? 'viewer',
                    status: 'active',
                },
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
                blockerCodes: [visibility.reason ?? 'role_not_allowed'],
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
                    memberRole: organization.role ?? 'viewer',
                    visibility,
                    routeBindings: routes,
                    allowedActions: [],
                    actionMatrix: {
                        review_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        acknowledge_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        assign_case: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        link_case: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        replay_alert: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        deliver_webhook: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                        open_audit_timeline: { allowed: false, denialReason: visibility.reason ?? 'role_not_allowed' },
                    },
                    redactedFields: [
                        'activeTerms[]',
                        'watchlistScope.alertGeneratorKeys',
                        'case.evidence.rawContent',
                        'destination.secret',
                    ],
                    nonmemberEnumeration: false,
                },
                auditProof: {
                    schemaVersion: 'organization.alert_case_visibility_denial_audit.v1',
                    organizationId: organization.id,
                    tenantId: organization.id,
                    memberRole: organization.role ?? 'viewer',
                    serviceLogAction: 'organization_alert_case_visibility_denied',
                    requestId,
                    requiredMetadataFields: ['requestId', 'role', 'allowedRoles', 'denialReason', 'blockerCodes'],
                    redactedFields: [
                        'activeTerms[]',
                        'watchlistScope.alertGeneratorKeys',
                        'case.evidence.rawContent',
                        'destination.secret',
                    ],
                    proofLogQuery: 'GET /api/logs?service=api&message=organization_alert_case_visibility_denied',
                },
                proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            },
        })
    }

    const alertQueue = downstreamProof.alertBridge.queueVisibilityContract
    const caseWorkflow = downstreamProof.caseBridge.caseWorkflowContract
    const analystPortalAdapter = organizationAnalystPortalVisibilityAdapter(downstreamProof, downstreamAuthorization)
    const alertCaseWorkflowState = organizationAlertCaseWorkflowState(downstreamProof, downstreamAuthorization, analystPortalAdapter)
    return res.send({
        organization: toOrganization(organization),
        alertCaseVisibility: {
            schemaVersion: 'organization.alert_case_visibility.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            member: {
                userId,
                role: organization.role ?? 'viewer',
                status: 'active',
            },
            visibility,
            routes,
            requiredQueryFields: ['organizationId'],
            allowedActions: downstreamAuthorization.allowedActions,
            analystPortalAdapter,
            workflowState: alertCaseWorkflowState,
            alertQueue: {
                route: alertQueue.routes.list,
                requiredQueryFields: alertQueue.requiredQueryFields,
                watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
                actionGates: alertQueue.actionGates,
                blockerCodes: alertQueue.blockerCodes,
            },
            caseWorkflow: {
                route: caseWorkflow.routes.list,
                casePathTemplate: caseWorkflow.casePathTemplate,
                requiredQueryFields: caseWorkflow.requiredQueryFields,
                watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                actorActions: caseWorkflow.actorActions,
                blockerCodes: caseWorkflow.blockerCodes,
            },
            caseVisibilityConsumer: {
                schemaVersion: 'organization.case_visibility_consumer.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                route: 'GET /api/organizations/:id/alert-case-visibility',
                downstreamRoutes: {
                    caseList: caseWorkflow.routes.list,
                    caseOpen: caseWorkflow.routes.open,
                    caseDetail: caseWorkflow.routes.detail,
                    caseUpdate: caseWorkflow.routes.update,
                    alertList: alertQueue.routes.list,
                },
                requiredQueryFields: caseWorkflow.requiredQueryFields,
                casePathTemplate: caseWorkflow.casePathTemplate,
                member: {
                    userId,
                    role: organization.role ?? 'viewer',
                    status: 'active',
                    canReadCases: caseWorkflow.actorActions.canReadCases,
                    canOpenCase: caseWorkflow.actorActions.canOpenCase,
                    canAssignCase: caseWorkflow.actorActions.canAssignCase,
                    denialReason: caseWorkflow.actorActions.denialReason,
                },
                watchlistScope: {
                    ownerOrganizationId: organization.id,
                    watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                    alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                    evidenceRefField: caseWorkflow.watchlistScope.evidenceRefField,
                    crossTenantCollisionAllowed: false,
                    lifecycleStatuses: ['active'],
                },
                requiredPersistedFields: [
                    'organizationId',
                    'tenantId',
                    'alertId',
                    'casePath',
                    'watchlistItemIds',
                    'alertGeneratorKeys',
                    'allowedActions',
                    'visibilityDecision',
                    'evidence.provenance',
                ],
                denialContract: {
                    statusCode: 403,
                    nonmemberEnumeration: false,
                    redactedFields: [
                        'activeTerms[]',
                        'watchlistScope.alertGeneratorKeys',
                        'case.evidence.rawContent',
                        'otherOrg.caseIds',
                    ],
                    blockerCodes: caseWorkflow.blockerCodes,
                },
                noLeakFields: [
                    'otherOrg.watchlistItemIds',
                    'otherOrg.alertGeneratorKeys',
                    'otherOrg.caseIds',
                    'case.evidence.rawContent',
                ],
                proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            },
            alertCasePersistenceReadiness: {
                schemaVersion: 'organization.alert_case_persistence_readiness.v1',
                organizationId: organization.id,
                tenantId: organization.id,
                sourceFamily: 'organization_watchlist',
                alertPersistenceContract: downstreamProof.alertBridge.persistenceContract.schemaVersion,
                caseWorkflowContract: caseWorkflow.schemaVersion,
                storageModule: downstreamProof.alertBridge.persistenceContract.storageModule,
                alertUpsertFunction: downstreamProof.alertBridge.persistenceContract.upsertFunction,
                alertRoute: downstreamProof.alertBridge.route,
                caseRoute: downstreamProof.caseBridge.route,
                casePathTemplate: caseWorkflow.casePathTemplate,
                watchlistScope: {
                    watchlistItemIds: downstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds,
                    alertGeneratorKeys: downstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys,
                    crossTenantCollisionAllowed: downstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed,
                },
                requiredAlertFields: downstreamProof.alertBridge.persistenceContract.persistedAlertFields,
                requiredCaseFields: caseWorkflow.requiredCaseFields,
                workflowContextFields: downstreamProof.alertBridge.persistenceContract.workflowContextFields,
                dedupe: downstreamProof.alertBridge.persistenceContract.dedupe,
                lifecycleBlockers: downstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
                actorActions: caseWorkflow.actorActions.allowedActions,
                blockerCodes: Array.from(new Set([
                    ...downstreamProof.alertBridge.persistenceContract.blockerCodes,
                    ...caseWorkflow.blockerCodes,
                ])),
                readyForPersistence: downstreamProof.alertBridge.persistenceContract.blockerCodes.length === 0 && caseWorkflow.blockerCodes.length === 0,
                nonmemberEnumeration: false,
                proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
            },
            guardrails: {
                schemaVersion: 'organization.alert_case_visibility_guardrails.v1',
                partitionKey: 'organizationId',
                tenantIdField: 'tenantId',
                requiredWorkflowContextFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemIds',
                    'workflowContext.visibilityDecision',
                ],
                crossTenantCollisionAllowed: false,
                nonmemberEnumeration: false,
                noLeakFields: [
                    'otherOrg.watchlistItemIds',
                    'otherOrg.alertGeneratorKeys',
                    'case.evidence.rawContent',
                    'destination.secret',
                ],
                lifecycleBlockers: downstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
            },
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    })
}

export async function postOrganizationWatchlist(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'create_watchlist',
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'create shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input: ReturnType<typeof normalizeWatchlistInput>
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const existing = await run(`
        SELECT id
        FROM organization_watchlist_items
        WHERE organization_id = $1
          AND kind = $2
          AND lower(value) = lower($3)
          AND archived_at IS NULL
          AND status <> 'archived'
        LIMIT 1
    `, [req.params.id, input.kind, input.value])

    if (!existing.rows[0]) {
        const usage = await run(`
            SELECT COUNT(*)::int AS used
            FROM organization_watchlist_items
            WHERE organization_id IN (
                SELECT organization_id
                FROM organization_members
                WHERE user_id = $1 AND status = 'active'
            )
              AND archived_at IS NULL
              AND status <> 'archived'
        `, [userId])
        const quota = await checkBillingCapacity(userId, 'watchTerms', Number(usage.rows[0]?.used || 0))
        if (!quota.allowed) return res.status(quota.subscriptionRequired ? 402 : 409).send({ error: quota.subscriptionRequired ? 'subscription_required' : 'quota_exhausted', message: quota.subscriptionRequired ? 'A Dark Web Monitoring plan is required to create watch terms.' : 'Your watch-term quota has been reached.', quota })
    }

    const result = existing.rows[0]
        ? await run(`
            UPDATE organization_watchlist_items
            SET value = $3,
                notes = $4,
                status = 'active',
                updated_by = $5,
                lifecycle_reason = $6,
                lifecycle_request_id = $7,
                updated_at = NOW()
            WHERE id = $1
              AND organization_id = $2
            RETURNING *
        `, [existing.rows[0].id, req.params.id, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])
        : await run(`
        INSERT INTO organization_watchlist_items (id, organization_id, kind, value, notes, status, created_by, updated_by, lifecycle_reason, lifecycle_request_id)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $6, $7, $8)
        RETURNING *
    `, [randomUUID(), req.params.id, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    await touchOrganization(req.params.id)
    const serviceLogAction = 'organization_watchlist_upserted'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        watchlistItemId: result.rows[0]?.id,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: existing.rows[0] ? 'watchlist.updated' : 'watchlist.created',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: result.rows[0]?.id,
        organizationId: req.params.id,
        requestId: input.requestId,
        reason: input.reason,
        context: { kind: input.kind, status: result.rows[0]?.status },
    })
    return res.status(201).send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: existing.rows[0] ? 'updated' : 'created',
            watchlistItemId: result.rows[0]?.id,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
            existingItemId: existing.rows[0]?.id ?? null,
            duplicateTermMatched: Boolean(existing.rows[0]),
        }),
    })
}

export async function putOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const lifecycleBlocker = inactiveOrganizationMutationBlocker(organization, 'update shared watchlists')
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    let input: ReturnType<typeof normalizeWatchlistInput>
    try {
        input = normalizeWatchlistInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist item.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET kind = $3,
            value = $4,
            notes = $5,
            updated_by = $6,
            lifecycle_reason = $7,
            lifecycle_request_id = $8,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
          AND status <> 'archived'
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, input.kind, input.value, input.notes, userId, input.reason ?? null, input.requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'update_watchlist',
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_updated'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        watchlistItemId: req.params.itemId,
        kind: input.kind,
        value: input.value,
        reason: input.reason,
    })
    await recordSystemEvent(req, {
        actionType: 'watchlist.updated',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        context: { kind: input.kind, status: result.rows[0]?.status },
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'updated',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            serviceLogAction,
        }),
    })
}

export async function deleteOrganizationWatchlist(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistMutationBody, Querystring: { requestId?: string, request_id?: string } }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'archive shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id ?? req.query?.requestId ?? req.query?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    const requestId = normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id ?? req.query?.requestId ?? req.query?.request_id)
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : undefined

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = NOW(),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, userId, reason ?? null, requestId ?? null])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: 'archive_watchlist',
            itemId: req.params.itemId,
            requestId,
            reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId,
        reason,
        watchlistItemId: req.params.itemId,
    })
    await recordSystemEvent(req, {
        actionType: 'watchlist.deleted',
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId,
        reason,
    })
    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: 'disabled',
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId,
            reason,
            serviceLogAction,
        }),
    })
}

export async function postOrganizationWatchlistAction(req: FastifyRequest<{ Params: WatchlistParams, Body: WatchlistActionInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.organizationId)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'change shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanWriteWatchlist(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'watchlist_lifecycle_action',
            itemId: req.params.itemId,
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners, admins, and editors can update watchlists.',
        })
    }

    let input: ReturnType<typeof normalizeWatchlistActionInput>
    try {
        input = normalizeWatchlistActionInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist action.' })
    }

    const lifecycleBlocker = input.action === 'archive'
        ? null
        : inactiveOrganizationMutationBlocker(organization, `${input.action} shared watchlists`)
    if (lifecycleBlocker) {
        return sendOrganizationLifecycleBlocker(req, res, lifecycleBlocker, userId, organization.role)
    }

    const nextStatus = input.action === 'resume' || input.action === 'restore' ? 'active' : input.action === 'pause' ? 'paused' : 'archived'
    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = $3,
            archived_at = CASE WHEN $3 = 'archived' THEN NOW() WHEN $7 = 'restore' THEN NULL ELSE archived_at END,
            updated_by = $4,
            lifecycle_reason = $5,
            lifecycle_request_id = $6,
            updated_at = NOW()
        WHERE id = $1
          AND organization_id = $2
          AND ($7 = 'restore' OR archived_at IS NULL)
        RETURNING *
    `, [req.params.itemId, req.params.organizationId, nextStatus, userId, input.reason ?? null, input.requestId ?? null, input.action])

    if (!result.rows.length) {
        return sendWatchlistLookupDenial(req, res, organization, userId, {
            action: input.action,
            itemId: req.params.itemId,
            requestId: input.requestId,
            reason: input.reason,
        })
    }

    await touchOrganization(req.params.organizationId)
    const serviceLogAction = input.action === 'pause'
        ? 'organization_watchlist_paused'
        : input.action === 'resume'
            ? 'organization_watchlist_resumed'
            : input.action === 'restore'
                ? 'organization_watchlist_restored'
                : 'organization_watchlist_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.organizationId, userId, {
        requestId: input.requestId,
        reason: input.reason,
        watchlistItemId: req.params.itemId,
        action: input.action,
        status: nextStatus,
    })
    await recordSystemEvent(req, {
        actionType: `watchlist.${input.action === 'pause' ? 'paused' : input.action === 'resume' || input.action === 'restore' ? 'resumed' : 'deleted'}`,
        actorId: userId,
        source: 'organization',
        targetType: 'watchlist_item',
        targetId: req.params.itemId,
        organizationId: req.params.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        context: { action: input.action, status: nextStatus },
    })

    return res.send({
        watchlistItem: toWatchlistItem(result.rows[0] as OrganizationWatchlistRow),
        operation: organizationWatchlistOperation(organization, {
            action: input.action,
            watchlistItemId: req.params.itemId,
            actorId: userId,
            requestId: input.requestId,
            reason: input.reason,
            serviceLogAction,
        }),
    })
}

export async function postOrganizationWatchlistCleanup(req: FastifyRequest<{ Params: OrganizationParams, Body: WatchlistCleanupInput }>, res: FastifyReply) {
    const requestContext = await loadRequiredOrganizationMemberRequest(req, res, req.params.id)
    if (!requestContext) return
    const { userId, organization } = requestContext

    const deletionBlocker = privacyDeletionMutationBlocker(organization, 'clean up shared watchlists')
    if (deletionBlocker) return sendOrganizationLifecycleBlocker(req, res, deletionBlocker, userId, organization.role)

    if (!roleCanManageOrganization(organization.role)) {
        return sendWatchlistMutationDenial(req, res, organization, userId, {
            action: 'cleanup_watchlists',
            requestId: normalizeWatchlistRequestId(req.body?.requestId ?? req.body?.request_id),
            reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : null,
            message: 'Only organization owners and admins can clean up watchlists.',
        })
    }

    let input: ReturnType<typeof normalizeWatchlistCleanupInput>
    try {
        input = normalizeWatchlistCleanupInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid watchlist cleanup.' })
    }

    const result = await run(`
        UPDATE organization_watchlist_items
        SET status = 'archived',
            archived_at = COALESCE(archived_at, NOW()),
            updated_by = $3,
            lifecycle_reason = $4,
            lifecycle_request_id = $5,
            updated_at = NOW()
        WHERE organization_id = $1
          AND id = ANY($2::text[])
          AND archived_at IS NULL
        RETURNING *
    `, [req.params.id, input.itemIds, userId, input.reason ?? null, input.requestId ?? null])
    const archivedItems = result.rows as OrganizationWatchlistRow[]
    const archivedIds = new Set(archivedItems.map(item => item.id))
    const skippedItemIds = input.itemIds.filter(itemId => !archivedIds.has(itemId))

    if (archivedItems.length > 0) {
        await touchOrganization(req.params.id)
    }

    const serviceLogAction = 'organization_watchlist_cleanup_archived'
    logOrganizationEvent(req, serviceLogAction, req.params.id, userId, {
        requestId: input.requestId,
        reason: input.reason,
        requestedItemIds: input.itemIds,
        archivedItemIds: archivedItems.map(item => item.id),
        skippedItemIds,
        archivedCount: archivedItems.length,
    })

    return res.send({
        cleanup: {
            schemaVersion: 'organization.watchlist_cleanup.v1',
            organizationId: req.params.id,
            tenantId: req.params.id,
            actorId: userId,
            actorRole: organization.role,
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            requestedItemIds: input.itemIds,
            archivedItemIds: archivedItems.map(item => item.id),
            skippedItemIds,
            archivedCount: archivedItems.length,
            serviceLogAction,
        },
        archivedItems: archivedItems.map(toWatchlistItem),
    })
}

function sendWatchlistMutationDenial(
    req: FastifyRequest,
    res: FastifyReply,
    organization: OrganizationRow,
    actorId: string,
    input: {
        action: 'create_watchlist' | 'update_watchlist' | 'archive_watchlist' | 'watchlist_lifecycle_action' | 'cleanup_watchlists'
        itemId?: string | null
        requestId?: string | null
        reason?: string | null
        message: string
    }
) {
    const denial = organizationWatchlistMutationDenial({
        organizationId: organization.id,
        actorId,
        actorRole: organization.role,
        ...input,
    })
    logOrganizationEvent(req, denial.serviceLogAction, organization.id, actorId, {
        requestId: denial.requestId,
        reason: denial.reason,
        action: denial.action,
        itemId: denial.itemId,
        actorRole: organization.role,
        denialReason: denial.denialReason,
    })
    return res.status(403).send({ error: input.message, watchlistMutationDenial: denial })
}

function organizationWatchlistOperation(
    organization: OrganizationRow,
    input: {
        action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore'
        watchlistItemId: string
        actorId: string
        requestId?: string
        reason?: string
        serviceLogAction: string
        existingItemId?: string | null
        duplicateTermMatched?: boolean
    }
) {
    const decision = organizationVisibilityDecision({
        role: organization.role,
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: organization.alert_visibility_policy,
    })
    const nextLifecycle = organizationWatchlistOperationLifecycle(input.action)
    return {
        schemaVersion: 'organization.watchlist_operation.v1',
        action: input.action,
        organizationId: organization.id,
        tenantId: organization.id,
        ownerOrganizationId: organization.id,
        watchlistItemId: input.watchlistItemId,
        watchlistId: input.watchlistItemId,
        actorId: input.actorId,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
        visibilityPolicy: decision.alertVisibilityPolicy,
        allowedViewerRoles: decision.allowedRoles,
        serviceLogAction: input.serviceLogAction,
        duplicateTermScope: 'organization' as const,
        ownerContext: organizationWatchlistOwnerContext({
            organization,
            watchlistItemId: input.watchlistItemId,
            actorId: input.actorId,
            visibility: decision,
        }),
        upsert: input.action === 'created' || input.action === 'updated'
            ? {
                schemaVersion: 'organization.watchlist_upsert.v1' as const,
                watchlistItemId: input.watchlistItemId,
                ownerOrganizationId: organization.id,
                idempotent: true,
                duplicateTermMatched: Boolean(input.duplicateTermMatched),
                existingItemId: input.existingItemId ?? null,
                actionTaken: input.duplicateTermMatched ? 'updated_existing_item' as const : 'created_new_item' as const,
                crossOrganizationDuplicateAllowed: true,
                sameOrganizationDuplicateCreatesNewItem: false,
                duplicateScopeKeyFields: ['organizationId', 'kind', 'normalizedValue'] as const,
                alertDedupeKeyFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'] as const,
                webhookDestinationOrgField: 'destination.org_id' as const,
            }
            : null,
        lifecycleTransition: {
            schemaVersion: 'organization.watchlist_lifecycle_transition.v1',
            action: input.action,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            disabledReasonAfter: nextLifecycle.disabledReasonAfter,
            alertGenerationEligibleAfter: nextLifecycle.enabledAfter,
            activeTermsExportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup',
            blockerAfter: nextLifecycle.disabledReasonAfter,
            mutationAfterArchiveDeniedByLookup: nextLifecycle.statusAfter === 'archived',
            lookupDenialBlockerAfter: nextLifecycle.statusAfter === 'archived'
                ? 'watchlist_not_found_or_cross_org' as const
                : null,
        },
        mutationReceipt: {
            schemaVersion: 'organization.watchlist_mutation_receipt.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: input.watchlistItemId,
            watchlistId: input.watchlistItemId,
            action: input.action,
            actorId: input.actorId,
            actorRole: organization.role ?? 'viewer',
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            serviceLogAction: input.serviceLogAction,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            disabledReasonAfter: nextLifecycle.disabledReasonAfter,
            roleGates: {
                mutateWatchlists: ['owner', 'admin'],
                readSharedWatchlists: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
                exportAlertTerms: decision.allowedRoles,
                assignCases: ['owner', 'admin', 'editor'],
            },
            downstreamRoutes: {
                sharedWatchlists: 'GET /api/organizations/:id/watchlists',
                alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
                alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
                webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
            },
            downstreamRefs: {
                alertGeneration: 'organization.watchlist_alert_generation_consumer.v1',
                caseVisibility: 'organization.case_visibility_consumer.v1',
                webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
            },
            lifecycleBlockerAfter: nextLifecycle.disabledReasonAfter,
            activeTermsIncludedInExport: nextLifecycle.enabledAfter,
            archivedMutationDeniedByLookup: nextLifecycle.statusAfter === 'archived',
            duplicateTermMatched: Boolean(input.duplicateTermMatched),
            existingItemId: input.existingItemId ?? null,
            noEnumeration: true,
        },
        downstreamLifecycleReceipt: {
            schemaVersion: 'organization.watchlist_downstream_lifecycle_receipt.v1' as const,
            organizationId: organization.id,
            tenantId: organization.id,
            ownerOrganizationId: organization.id,
            watchlistItemId: input.watchlistItemId,
            watchlistId: input.watchlistItemId,
            actorId: input.actorId,
            actorRole: organization.role ?? 'viewer',
            action: input.action,
            requestId: input.requestId ?? null,
            reason: input.reason ?? null,
            statusAfter: nextLifecycle.statusAfter,
            enabledAfter: nextLifecycle.enabledAfter,
            lifecycleBlockerAfter: nextLifecycle.disabledReasonAfter,
            workflowStatus: nextLifecycle.enabledAfter ? 'ready_for_matching' as const : 'excluded_from_matching' as const,
            alertGenerationReadyAfter: nextLifecycle.enabledAfter,
            caseReplayReadyAfter: nextLifecycle.enabledAfter,
            webhookDeliveryReadyAfter: nextLifecycle.enabledAfter,
            destinationReadiness: {
                schemaVersion: 'organization.webhook_alert_delivery_readiness.v1' as const,
                destinationOwnerField: 'destination.org_id' as const,
                dryRunVisibilityContract: 'organization.webhook_destination_dry_run_visibility.v1' as const,
                deliveryBlockedByLifecycle: !nextLifecycle.enabledAfter,
                blockerCode: nextLifecycle.disabledReasonAfter,
            },
            matchProvenance: {
                matchReasonCode: 'organization_watchlist_term_match' as const,
                requiredFields: [
                    'organizationId',
                    'tenantId',
                    'watchlistItemId',
                    'watchlistId',
                    'watchedEntity',
                    'matchReason',
                    'actorRef',
                    'sourceRefs',
                    'provenanceHash',
                    'workflowStatus',
                ],
                provenanceHashScope: 'organization_watchlist_item' as const,
            },
            consumerContracts: {
                alertGeneration: 'organization.watchlist_alert_generation_consumer.v1' as const,
                caseVisibility: 'organization.case_visibility_consumer.v1' as const,
                alertCasePersistence: 'organization.alert_case_bridge_persistence_receipt.v1' as const,
                webhookDestinationReadiness: 'organization.webhook_destination_readiness_bridge.v1' as const,
                webhookAlertDeliveryReadiness: 'organization.webhook_alert_delivery_readiness.v1' as const,
                dashboardReadiness: 'organization.worker3_ui_readiness_proof.v1' as const,
                helpdeskTimeline: 'organization.recovery_support_history_bridge.v1' as const,
            },
            lifecycleCleanup: {
                cleanupRequired: !nextLifecycle.enabledAfter,
                cleanupRoute: 'POST /api/organizations/:id/watchlists/cleanup' as const,
                archivedMutationDeniedByLookup: nextLifecycle.statusAfter === 'archived',
                lookupDenialBlockerAfter: nextLifecycle.statusAfter === 'archived'
                    ? 'watchlist_not_found_or_cross_org' as const
                    : null,
                noOrphanedAlertCaseLinks: true,
                noCrossOrgLeakage: true,
            },
            noLeakFields: [
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
                'destination.secret',
                'case.evidence.rawContent',
            ],
        },
    }
}

function organizationWatchlistOperationLifecycle(action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore') {
    if (action === 'pause') {
        return {
            statusAfter: 'paused' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_paused' as const,
        }
    }
    if (action === 'archive' || action === 'disabled') {
        return {
            statusAfter: 'archived' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_archived' as const,
        }
    }
    return {
        statusAfter: 'active' as const,
        enabledAfter: true,
        disabledReasonAfter: null,
    }
}
