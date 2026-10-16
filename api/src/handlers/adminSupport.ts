import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAdminSupport } from './adminSupport/auth.ts'
export { requireAdminSupport } from './adminSupport/auth.ts'
export { postSupportSession, getSupportSession, postSupportSessionRevoke } from './adminSupport/sessions/index.ts'
export { getSystemEvent } from './adminSupport/audit/systemEventDetail.ts'
export { getSupportOrganizationInvite, getSupportOrganizationMember } from './adminSupport/cases/organizationEntityReads.ts'
export { getSupportOrganization } from './adminSupport/cases/organizationRead.ts'
export { getSupportUser } from './adminSupport/cases/userRead.ts'
export { getSupportAccessRecoveryApprovals } from './adminSupport/accessRecovery/approvalSearch.ts'
export { supportRoleRecoveryDecision } from './adminSupport/memberRoleRecovery/policy.ts'
export { supportMemberRoleRecoveryExecutorControls, recordSupportMemberRoleRecoveryExecutorBlock } from './adminSupport/memberRoleRecovery/controls.ts'
export { supportMemberRoleRecoveryExecutorDetail } from './adminSupport/memberRoleRecovery/executorReceipt.ts'
export { supportMemberRoleRecoveryAuditQuery } from './adminSupport/memberRoleRecovery/auditQuery.ts'
import { loadSupportMemberDetail } from './adminSupport/cases/organizationReadData.ts'
import { buildSupportInspectionAuthorization } from './adminSupport/cases/inspection/authorization.ts'
import { supportTimelineFilter } from './adminSupport/cases/inspection/timelineFilter.ts'
import { prepareSupportInspectionRequest, type SupportInspectionQuery } from './adminSupport/cases/inspection/inspectionRequest.ts'
import type { SupportActionPreparationInput } from './adminSupport/cases/inspection/inspectionActionPreparation.ts'
import { supportInspectionFilterError } from './adminSupport/cases/inspection/inspectionFilterValidation.ts'
import { loadSupportInspectionData } from './adminSupport/cases/inspection/inspectionData.ts'
import { buildSupportInspectionCaseModels } from './adminSupport/cases/inspection/inspectionCaseModels.ts'
import { buildSupportInspectionProofs } from './adminSupport/cases/inspection/inspectionProofs.ts'
import { sendSupportInspectionResponse } from './adminSupport/cases/inspection/inspectionPresentation.ts'
import { toAccessRecoveryDecision } from './adminSupport/cases/accessRecoveryApprovalMapping.ts'
import { supportAccessRecoveryExecutionReceipt } from './adminSupport/cases/accessRecoveryExecutionReceipt.ts'
import { supportAccessRecoveryDecisionReceipt } from './adminSupport/cases/accessRecoveryDecisionReceipt.ts'
import { supportAccessRecoveryApprovalTimeline, accessRecoveryApprovalAuditFilters } from './adminSupport/cases/accessRecoveryApprovalTimeline.ts'
import { accessRecoveryApprovalMetadata } from './adminSupport/cases/accessRecoveryApprovalMetadata.ts'
export { buildSupportSubjectAccessState, buildSupportSubjectInspectionAuthorization } from './adminSupport/cases/subjectAccessState.ts'
export { buildSupportSubjectInspectionContext } from './adminSupport/cases/subjectInspectionContext.ts'
export { buildSupportSubjectInspectionReceipts } from './adminSupport/cases/subjectInspectionReceipts.ts'
import { randomUUID } from 'crypto'
import run, { withTransaction } from '#db'
import { touchOrganization, updateOrganizationInviteAction, upsertAdminAccessRecoveryApproval, upsertOrganizationInvite } from '#utils/db/identityDataWrites.ts'
import { isAccountUnavailable } from '#utils/accountAvailability.ts'
import { loadInspectionAuditEvents } from './adminSupport/inspectionEventLoaders.ts'
import { toSystemEvent, toSupportAuditTimelineEvent } from './adminSupport/audit/auditEventProjection.ts'
import { encodeAuditCursor, prepareSystemEventSearch, type SystemEventQuery } from './adminSupport/audit/systemEventSearchPlan.ts'
import { auditTimelineSummary } from './adminSupport/audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from './adminSupport/audit/auditFilterPackets.ts'
import { supportAuditExportProof, supportAuditCompliancePacket } from './adminSupport/audit/auditExportPackets.ts'
import { supportAuditBridgeAdapterContract } from './adminSupport/audit/auditBridgePackets.ts'
import { supportAuditTimelineReplayContract } from './adminSupport/audit/auditReplayContracts.ts'
import { supportAuditCaseReplayExport } from './adminSupport/audit/auditCaseReplayExport.ts'
import { supportAuditSupportWorkflowPacket, supportAuditWorkflowRollup } from './adminSupport/audit/auditWorkflowSummary.ts'
import { supportAuditActionEvidenceRollup } from './adminSupport/audit/auditEvidenceRollups.ts'
import { supportAuditEventDecisionPacket } from './adminSupport/audit/auditDecisionPackets.ts'
import { supportCaseTimelineEntries } from './adminSupport/audit/auditCaseTimeline.ts'
import { buildRecoveryEligibility, toSupportInvite } from './adminSupport/cases/subjectMapping.ts'
import { buildSupportAccessRecoveryPlan } from './adminSupport/cases/accessRecoveryPlan.ts'
import { auditTimelineLink } from './adminSupport/audit/auditLinks.ts'
import { supportRecoveryLifecycleCleanupExport } from './adminSupport/cases/readiness/lifecycleCleanupExport.ts'
import { supportReadinessCaseTimelineExport } from './adminSupport/cases/readiness/caseTimelineExport.ts'
import { supportRecoveryReadinessMatrix } from './adminSupport/cases/readiness/readinessMatrix.ts'
import { supportRecoveryCaseReplayFixture } from './adminSupport/cases/readiness/caseReplayFixture.ts'
import { supportReadinessWorkflowContracts } from './adminSupport/cases/readiness/workflowContracts.ts'
import { supportWorkbenchAdapter } from './adminSupport/cases/workbenchAdapter.ts'
import { loadSupportSuccessfulIdempotencyReceipt, requireWritableSupportOrganization, validateSupportSessionForAction } from './adminSupport/actionAccess.ts'
import { recordSupportExecutorBlock, supportExecutorControls, supportExecutorMetadata, type SupportExecutorControlsResult } from './adminSupport/executorCore.ts'
import { supportExecutorAuditPreview, supportExecutorAuditQuery, supportExecutorCommonBlockerCatalog } from './adminSupport/executorAudit.ts'
import type { AccessRecoveryApprovalRow } from './adminSupport/supportTypes.ts'
import { organizationMembershipAvailability as loadOrganizationAvailability, type OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { hasOrganizationPrivacyDeletionMarker } from '#utils/organizationLifecycle.ts'
import { cleanContext, supportError, supportInspectionQueryFilters, supportRequestId, supportSessionIdFromRequest, supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { loadSystemEventIds, recordSystemEvent, redactAuditValue, requireAuditReason } from '#utils/systemEvent.ts'
import {
    normalizeInviteInput,
    toInvite,
    toOrganization,
    type InviteInput,
    type OrganizationInviteRow,
} from '#utils/organizations.ts'

type OrganizationParams = {
    id: string
}

type SupportInviteBody = InviteInput & {
    reason?: unknown
    context?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}

type SupportAccessRecoveryBody = InviteInput & {
    targetUserId?: unknown
    reason?: unknown
    context?: unknown
    caseId?: unknown
    approvalRequired?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    requestId?: unknown
    request_id?: unknown
}

type AccessRecoveryDecisionParams = {
    requestId: string
}

type SupportAccessRecoveryDecisionBody = {
    reason?: unknown
    context?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
}





export async function getSystemEvents(req: FastifyRequest, res: FastifyReply) {
    const started = performance.now()
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SystemEventQuery
    if (query.format !== undefined && !['timeline', 'helpdesk'].includes(query.format)) return res.status(400).send(supportError('invalid_format', 'Unknown audit format.'))
    const timelineOnly = query.format === 'timeline'
    const helpdeskOnly = query.format === 'helpdesk'
    if (helpdeskOnly && query.hql !== undefined) return res.status(400).send(supportError('invalid_hql', 'HQL is not supported by the helpdesk format.'))
    const authorized = performance.now()
    const plan = prepareSystemEventSearch(query)
    if ('error' in plan) return res.status(400).send(plan.error)
    const {
        compiled, where, values, add, q, org, actorFilter, target, action, severity, source,
        service, entity, entityType, request, correlation, idempotency, supportSession,
        workflow, blocker, reason, scope, contextFilter, outcome, from, to, limit, page, cursor,
    } = plan
    // Timeline batches retain the first page total; support clients keep their existing contract.
    const countResult = helpdeskOnly || (timelineOnly && cursor) ? null : await run(`
        SELECT COUNT(*)::int AS total
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `, [...values])
    if (compiled) {
        const selected = compiled.summarize
            ? `${compiled.fields[compiled.summarize]} AS value, COUNT(*)::int AS count`
            : Object.entries(compiled.fields).map(([name, sql]) => `${sql} AS "${name}"`).join(', ')
        const result = await run(`
            SELECT ${selected}
            FROM system_events e
            LEFT JOIN users actor ON actor.id = e.actor_id
            LEFT JOIN users target_user ON target_user.id = e.object_id
            LEFT JOIN organizations organization ON organization.id = e.organization_id
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ${compiled.summarize ? 'GROUP BY 1 ORDER BY count DESC, value ASC NULLS LAST' : `ORDER BY ${compiled.order}`}
            LIMIT ${add(compiled.limit)}
        `, values)
        const columns = compiled.summarize ? [compiled.summarize, 'Count'] : compiled.projection || Object.keys(compiled.fields)
        return res.send({
            events: [],
            queryResult: {
                columns,
                rows: result.rows.map(row => compiled.summarize ? [row.value, row.count] : columns.map(column => row[column])),
                limit: compiled.limit,
                summarized: !!compiled.summarize,
            },
            pagination: { total: Number(countResult!.rows[0].total), nextCursor: null },
        })
    }
    if (cursor) {
        where.push(`(e.created_at, e.id) < (${add(cursor.createdAt)}, ${add(cursor.id)})`)
    }

    const result = await run(`
        SELECT ${timelineOnly ? `
            e.id, e.created_at, e.event_type, e.severity, e.service, e.source,
            e.actor_id, actor.name AS actor_name, e.object_id, e.object_type,
            target_user.name AS target_name, e.organization_id, organization.name AS organization_name,
            e.subject_id, e.request_id, e.outcome, e.reason,
            jsonb_strip_nulls(jsonb_build_object(
                'name', CASE WHEN jsonb_typeof(e.context->'name') = 'string' THEN e.context->'name' END,
                'targetName', CASE WHEN jsonb_typeof(e.context->'targetName') = 'string' THEN e.context->'targetName' END,
                'targetId', CASE WHEN jsonb_typeof(e.context->'targetId') = 'string' THEN e.context->'targetId' END,
                'targetSource', CASE WHEN jsonb_typeof(e.context->'targetSource') = 'string' THEN e.context->'targetSource' END
            )) AS context,
            e.ip, acknowledgement.acknowledged_at, acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name
        ` : `
            e.id,
            e.event_type,
            e.severity,
            e.source,
            e.service,
            e.actor_id,
            actor.name AS actor_name,
            e.object_type,
            e.object_id,
            target_user.name AS target_name,
            e.organization_id,
            organization.name AS organization_name,
            e.subject_id,
            e.request_id,
            e.outcome,
            e.reason,
            ${helpdeskOnly ? `jsonb_strip_nulls(jsonb_build_object(
                'name', CASE WHEN jsonb_typeof(e.context->'name') = 'string' THEN e.context->'name' END,
                'targetName', CASE WHEN jsonb_typeof(e.context->'targetName') = 'string' THEN e.context->'targetName' END,
                'targetId', CASE WHEN jsonb_typeof(e.context->'targetId') = 'string' THEN e.context->'targetId' END,
                'targetSource', CASE WHEN jsonb_typeof(e.context->'targetSource') = 'string' THEN e.context->'targetSource' END
            )) AS context` : 'e.context'},
            e.ip,
            ${helpdeskOnly ? '\'\'::text AS user_agent' : 'e.user_agent'},
            acknowledgement.acknowledged_at,
            acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name,
            e.created_at
        `}
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id
        LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${add(limit + 1)} OFFSET ${add((page - 1) * limit)}
    `, values)

    const pageRows = result.rows.slice(0, limit)
    const nextCursor = result.rows.length > limit && pageRows.length ? encodeAuditCursor(pageRows[pageRows.length - 1].created_at, pageRows[pageRows.length - 1].id) : null
    if (timelineOnly) {
        res.header('Server-Timing', `auth;dur=${(authorized - started).toFixed(2)}, query;dur=${(performance.now() - authorized).toFixed(2)}`)
        return res.send({
            events: pageRows,
            pagination: { total: countResult ? Number(countResult.rows[0].total) : null, nextCursor },
        })
    }
    if (helpdeskOnly) {
        res.header('Server-Timing', `auth;dur=${(authorized - started).toFixed(2)}, query;dur=${(performance.now() - authorized).toFixed(2)}`)
        return res.send({ events: pageRows })
    }
    const events = pageRows.map(toSystemEvent)
    const timeline = events.map(event => event.detail.timelineEvent)
    const filters = { q, org, actor: actorFilter, target, action, severity, source, service, entity, entityType, request, correlation, idempotency, supportSession, workflow, blocker, reason, scope, context: contextFilter, outcome, from, to, limit, cursor: text(query.cursor) }
    return res.send({
        events,
        pagination: {
            total: Number(countResult!.rows[0].total),
            limit,
            page,
            nextPage: result.rows.length > limit ? page + 1 : null,
            cursor: text(query.cursor) || null,
            nextCursor,
            previousCursor: null,
            appliedFilters: filters,
            sortField: 'createdAt',
            direction: 'desc',
        },
        filters,
        detail: {
            schemaVersion: 'admin.audit.timeline.v1',
            generatedAt: new Date().toISOString(),
            filters,
            summary: auditTimelineSummary(timeline),
            filterContract: supportAuditFilterContract(filters, timeline),
            exportProof: supportAuditExportProof(filters, timeline),
            compliancePacket: supportAuditCompliancePacket(filters, timeline),
            bridgeAdapter: supportAuditBridgeAdapterContract(filters),
            timelineReplayContract: supportAuditTimelineReplayContract(filters, timeline),
            caseReplayExport: supportAuditCaseReplayExport(filters, timeline),
            supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, timeline),
            workflowRollup: supportAuditWorkflowRollup(filters, timeline),
            actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
            decisionPackets: events.slice(0, 50).map(event => supportAuditEventDecisionPacket({
                detail: event.detail || {},
                timelineEvent: event.detail?.timelineEvent || {},
                relatedTimeline: timeline,
                filters,
            })),
            timeline,
            copyText: events.slice(0, 20).map(event => event.detail.copyText).join('\n'),
        },
    })
}

export async function getSupportInspection(req: FastifyRequest<{ Querystring: SupportInspectionQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const prepared = await prepareSupportInspectionRequest(req, actor.id)
    if ('status' in prepared) return res.status(prepared.status).send(prepared.body)
    const request = prepared.value
    const data = await loadSupportInspectionData(request)
    if (data.notFound) {
        return res.status(404).send(supportError('support_target_not_found', 'No support state matched the requested filters.', {
            filters: data.timelineFilter,
            unavailableFilters: [],
        }))
    }

    const models = buildSupportInspectionCaseModels({
        org: request.org,
        user: request.user,
        email: request.email,
        request: request.request,
        organizationIds: data.organizationIds,
        organizations: data.organizations,
        users: data.users,
        memberships: data.memberships,
        invites: data.invites,
        availabilityByOrg: data.availabilityByOrg,
        approvalDetails: data.approvalDetails,
        timeline: data.timeline,
        timelineFilter: data.timelineFilter,
    })
    const workbench = buildSupportWorkbench({
        org: request.org,
        user: request.user,
        email: request.email,
        request: request.request,
        organizationIds: data.organizationIds,
        users: data.users,
        memberships: data.memberships,
        invites: data.invites,
        recoveryEligibility: models.recoveryEligibility,
        caseSummary: models.caseSummary,
        timeline: data.timeline,
        timelineFilter: data.timelineFilter,
        preparationInput: request.preparationInput,
    })
    const workbenchAdapter = supportWorkbenchAdapter({
        org: request.org,
        user: request.user,
        email: request.email,
        request: request.request,
        workbench,
        caseSummary: models.caseSummary,
        accessStatus: models.accessStatus,
        timeline: data.timeline,
        timelineFilter: data.timelineFilter,
    })
    const proofs = buildSupportInspectionProofs({
        actorId: request.actorId,
        org: request.org,
        user: request.user,
        email: request.email,
        request: request.request,
        inspectionRequestId: request.inspectionRequestId,
        entity: request.entity,
        entityType: request.filters.entityType,
        supportSession: request.supportSession,
        q: request.filters.q,
        organizationIds: data.organizationIds,
        organizations: data.organizations,
        users: data.users,
        memberships: data.memberships,
        invites: data.invites,
        approvalDetails: data.approvalDetails,
        timeline: data.timeline,
        timelineFilter: data.timelineFilter,
        authorization: data.authorization,
        accessRecoveryPlan: models.accessRecoveryPlan,
        workbench,
        accessStatus: models.accessStatus,
        sessionState: request.sessionState,
    })
    return sendSupportInspectionResponse({ req, res, request, data, models, workbench, workbenchAdapter, proofs })
}

export async function getSupportReadiness(req: FastifyRequest<{ Querystring: SupportInspectionQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SupportInspectionQuery
    const {
        q, org, user, email, request, entity, entityType, supportSession, workflow,
        action, severity, outcome, source, service, blocker, reason, scope,
        context: contextFilter, from, to, limit,
    } = supportInspectionQueryFilters(query, { action: 'support', source: 'system', service: 'hanasand-api', limit: 25, maxLimit: 50 })
    const timelineFilter = supportTimelineFilter({ q, org, user, email, request, entity, entityType, supportSession, workflow, action, severity, outcome, source, service, blocker, reason, scope, context: contextFilter, from, to, limit })
    const filterError = supportInspectionFilterError(query, timelineFilter)
    if (filterError && filterError.detail?.code !== 'overbroad_support_timeline_filter') {
        return res.status(400).send(filterError)
    }

    const audit = await loadInspectionAuditEvents({ q, org, user, email, request, entity, entityType, supportSession, workflow, action, severity, outcome, source, service, blocker, reason, scope, context: contextFilter, from, to, limit })
    const timeline = audit.map(toSupportAuditTimelineEvent)
    const readiness = supportReadinessExport({
        actorId: actor.id,
        timelineFilter,
        timeline,
        org,
        user,
        email,
        request,
        entity,
        entityType,
        supportSession,
    })

    return res.send({
        readiness,
        auditEventIds: timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
        filteredTimeline: {
            schemaVersion: 'support.readiness.filtered_timeline.v1',
            filter: timelineFilter,
            summary: auditTimelineSummary(timeline),
            filterContract: supportAuditFilterContract(timelineFilter, timeline),
            exportProof: supportAuditExportProof(timelineFilter, timeline),
            events: timeline,
            redacted: true,
            links: {
                timeline: auditFilterQuery(timelineFilter),
                details: timeline.map(event => event.links?.detail).filter(Boolean),
            },
        },
    })
}

export async function postSupportOrganizationInvite(req: FastifyRequest<{ Params: OrganizationParams, Body: SupportInviteBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance reason')
        input = normalizeInviteInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite request.' })
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = input.requestId || supportRequestId(req)
    const controls = supportInviteAssistExecutorControls(req, req.body, requestId)
    if (controls.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: controls.error.code,
            input,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: controls.value,
                input,
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: 'invite_assist',
        requiredScope: 'invite:create',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: sessionValidation.error.code,
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: 'support.organization.invite_assist',
        organizationId: organization.id,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        const duplicateInviteIds = auditContextInviteIds(duplicate.context)
        const duplicateInvites = await loadOrganizationInvitesByIds(organization.id, duplicateInviteIds)
        return res.send({
            invites: duplicateInvites.map(toInvite),
            inviteAssistance: {
                schemaVersion: 'support.invite_assist.v1',
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                invites: duplicateInvites.map(toInvite),
                reason,
                scope: {
                    organizationId: organization.id,
                    inviteIds: duplicateInviteIds,
                    role: duplicateInvites[0]?.role || input.role,
                    expiresAt: duplicateInvites[0]?.expires_at || input.expiresAt,
                },
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportInviteAssistExecutorDetail({
                    organizationId: organization.id,
                    requestId: duplicate.request_id,
                    reason,
                    controls: executorControls,
                    input,
                    inviteIds: duplicateInviteIds,
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                }),
                executionReceipt: supportInviteAssistExecutionReceipt({
                    actorId: actor.id,
                    organizationId: organization.id,
                    requestId: duplicate.request_id,
                    reason,
                    controls: executorControls,
                    input,
                    invites: duplicateInvites,
                    inviteIds: duplicateInviteIds,
                    outcome: 'success',
                    auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    blockers: ['duplicate_idempotency_key'],
                }),
                audit: {
                    actionType: 'support.organization.invite_assist',
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportInviteAssistAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        entityId: duplicate.subject_id || duplicateInviteIds.join(','),
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                    }),
                },
                copyText: [
                    `Support invite assistance already executed for ${duplicateInvites.map(row => row.email).join(', ') || input.emails.join(', ')}`,
                    `Org: ${organization.name} (${organization.id})`,
                    `Request: ${duplicate.request_id}`,
                    `Idempotency: ${executorControls.idempotencyKey}`,
                    `Audit events: ${duplicate.id}`,
                    `Reason: ${reason}`,
                ].join('\n'),
            },
        })
    }

    const availability = await loadOrganizationAvailability([organization.id])
    const hasAvailableAdmin = availability[0]?.hasAvailableAdmin === true
    if (hasAvailableAdmin) {
        await recordSupportInviteAssistExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            requestId,
            reason,
            blocker: 'active_admin_available',
            input,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support invite assistance requires unavailable org administration.', {
            executorBlocker: supportInviteAssistExecutorBlocker({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                blockers: ['active_admin_available'],
            }),
        }))
    }

    const rows: OrganizationInviteRow[] = []
    for (const email of input.emails) {
        const invite = await upsertOrganizationInvite({
            id: randomUUID(), organizationId: organization.id, email,
            role: input.role, invitedBy: actor.id, expiresAt: input.expiresAt,
        })
        rows.push(invite as OrganizationInviteRow)
    }

    const inviteIds = rows.map(row => row.id)
    const entityId = inviteIds.join(',')
    await touchOrganization(organization.id)
    await recordSystemEvent(req, {
        actionType: 'support.organization.invite_assist',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId,
        requestId,
        severity: 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            organizationId: organization.id,
            emails: rows.map(row => row.email),
            role: input.role,
            expiresAt: input.expiresAt,
            inviteIds,
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId,
        actionType: 'support.organization.invite_assist',
        entityId,
    })

    return res.status(201).send({
        invites: rows.map(toInvite),
        inviteAssistance: {
            schemaVersion: 'support.invite_assist.v1',
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            invites: rows.map(toInvite),
            reason,
            controlledExecutor: supportInviteAssistExecutorDetail({
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                inviteIds,
                outcome: 'success',
                blockers: [],
            }),
            executionReceipt: supportInviteAssistExecutionReceipt({
                actorId: actor.id,
                organizationId: organization.id,
                requestId,
                reason,
                controls: executorControls,
                input,
                invites: rows,
                inviteIds,
                outcome: 'success',
                auditEventIds,
                blockers: [],
            }),
            scope: {
                organizationId: organization.id,
                inviteIds,
                role: input.role,
                expiresAt: input.expiresAt,
                supportScope: executorControls.scope,
            },
            outcome: 'success',
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            audit: {
                actionType: 'support.organization.invite_assist',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'notice',
                eventIds: auditEventIds,
                query: supportInviteAssistAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    entityId,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                }),
            },
            copyText: [
                `Support invite assistance for ${rows.map(row => row.email).join(', ')}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${input.role}`,
                `Expires: ${input.expiresAt}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export { postSupportOrganizationInviteAction } from './adminSupport/inviteActions/route.ts'
export { postSupportOrganizationMemberRoleRecovery } from './adminSupport/memberRoleRecovery/route.ts'
export async function getSupportAccessRecoveryApproval(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const requestId = text(req.params.requestId)
    const approval = requestId ? await loadAccessRecoveryApproval(requestId) : undefined
    const inspectionRequestId = supportRequestId(req)
    if (!approval) {
        await recordSystemEvent(req, {
            actionType: 'support.organization.access_recovery.inspect',
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: requestId || 'unknown',
            entityId: requestId || null,
            requestId: inspectionRequestId,
            severity: 'notice',
            outcome: 'failed',
            context: {
                schemaVersion: 'support.access_recovery.inspect.v1',
                requestId: requestId || null,
                error: 'access_recovery_request_not_found',
                redactionRequired: true,
            },
        })
        return res.status(404).send(supportError('access_recovery_request_not_found', 'Access recovery request not found.', {
            requestId: requestId || null,
        }))
    }

    const detail = toAccessRecoveryDecision(approval)
    const auditRows = await run(`
        SELECT
            event.id,
            event.event_type,
            event.severity,
            event.source,
            event.service,
            event.actor_id,
            actor.name AS actor_name,
            event.object_type,
            event.object_id,
            target_user.name AS target_name,
            event.organization_id,
            organization.name AS organization_name,
            event.subject_id,
            event.request_id,
            event.outcome,
            event.reason,
            event.context,
            event.created_at
        FROM system_events event
        LEFT JOIN users actor ON actor.id = event.actor_id
        LEFT JOIN users target_user ON target_user.id = event.object_id
        LEFT JOIN organizations organization ON organization.id = event.organization_id
        WHERE event.request_id = $1
           OR event.subject_id = $2
        ORDER BY event.created_at DESC
        LIMIT 50
    `, [approval.request_id, approval.invite_id])
    await recordSystemEvent(req, {
        actionType: 'support.organization.access_recovery.inspect',
        actorId: actor.id,
        targetType: 'access_recovery',
        targetId: approval.request_id,
        organizationId: approval.organization_id,
        entityId: approval.invite_id,
        requestId: inspectionRequestId,
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.access_recovery.inspect.v1',
            requestId: approval.request_id,
            organizationId: approval.organization_id,
            inviteId: approval.invite_id,
            status: approval.status,
            outcome: approval.outcome,
            redactionRequired: true,
        },
    })
    const auditFilters = accessRecoveryApprovalAuditFilters({
        request: approval.request_id,
        org: approval.organization_id,
        status: approval.status,
        outcome: approval.outcome,
    })
    const timeline = (auditRows.rows as Record<string, unknown>[]).map(toSupportAuditTimelineEvent)
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(auditFilters, [detail])
    const [availability, memberDetail] = await Promise.all([
        loadOrganizationAvailability([approval.organization_id]),
        detail.targetUserId ? loadSupportMemberDetail(approval.organization_id, detail.targetUserId) : Promise.resolve(undefined),
    ])
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const approvalInvite = {
        id: approval.invite_id,
        organization_id: approval.organization_id,
        organization_name: approval.organization_name,
        email: approval.email,
        role: approval.role,
        status: approval.invite_status,
        expires_at: approval.expires_at,
        accepted_at: null,
    } as Record<string, unknown>
    const recoveryEligibility = buildRecoveryEligibility({
        email: approval.email || '',
        user: detail.targetUserId || '',
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        users: memberDetail ? [memberDetail] : [],
        availabilityByOrg,
        invites: [approvalInvite],
    })
    const timelineFilter = supportTimelineFilter({
        q: '',
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        entityType: 'invite',
        supportSession: '',
        action: 'support.organization.access_recovery',
        severity: '',
        outcome: approval.outcome,
        source: 'admin',
        service: 'hanasand-api',
        blocker: '',
        reason: detail.requestedReason || detail.decisionReason || '',
        context: '',
        from: '',
        to: '',
        limit: 50,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org: approval.organization_id,
        user: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        organizationIds: [approval.organization_id],
        memberships: memberDetail ? [memberDetail] : [],
        invites: [approvalInvite],
        approvalDetails: [detail],
        recoveryEligibility,
        availabilityByOrg,
        timeline,
        timelineFilter,
    })
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg: approval.organization_id,
        requestedUser: detail.targetUserId || '',
        effectiveOrg: approval.organization_id,
        effectiveUser: detail.targetUserId || '',
        email: approval.email || '',
        request: approval.request_id,
        entity: approval.invite_id,
        supportSession: '',
        sessionState: null,
        organizationIds: [approval.organization_id],
    })
    return res.send({
        accessRecovery: detail,
        accessRecoveryInspection: {
            schemaVersion: 'support.access_recovery.inspection.v1',
            approval: detail,
            authorization,
            accessRecoveryPlan,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: {
                schemaVersion: 'support.access_recovery.inspection_timeline.v1',
                filters: auditFilters,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditFilters, timeline),
                exportProof: supportAuditExportProof(auditFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
                timeline,
                redacted: true,
            },
            approvalTimeline,
            links: {
                approve: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/approve`,
                deny: `/api/admin/support/access-recovery/${encodeURIComponent(approval.request_id)}/deny`,
                organization: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}`,
                invite: `/api/admin/support/organizations/${encodeURIComponent(approval.organization_id)}/invites/${encodeURIComponent(approval.invite_id)}`,
                audit: auditFilterQuery(auditFilters),
            },
            noMutation: true,
            redacted: true,
            copyText: [
                `Access recovery request ${approval.request_id}`,
                `Status: ${approval.status}`,
                `Outcome: ${approval.outcome}`,
                `Invite: ${approval.invite_id} (${approval.invite_status || 'unknown'})`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
}

export async function postSupportAccessRecovery(req: FastifyRequest<{ Params: OrganizationParams, Body: SupportAccessRecoveryBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeInviteInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Access recovery reason')
        input = normalizeInviteInput({
            email: req.body?.email,
            emails: req.body?.emails,
            role: req.body?.role || 'system',
            expiresAt: req.body?.expiresAt,
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery request.' })
    }

    if (input.emails.length !== 1) {
        return res.status(400).send({ error: 'Access recovery creates one controlled invite at a time.' })
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const targetUserId = text(req.body?.targetUserId)
    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope: 'recovery:invite',
        organizationId: organization.id,
        targetUserId: targetUserId || null,
    })
    if (sessionValidation.error) {
        await recordSystemEvent(req, {
            actionType: 'support.organization.access_recovery',
            actorId: actor.id,
            targetType: targetUserId ? 'user' : 'invite',
            targetId: targetUserId || input.emails[0],
            organizationId: organization.id,
            entityId: supportSessionId || targetUserId || input.emails[0],
            requestId,
            severity: 'warning',
            outcome: 'denied',
            reason,
            context: {
                schemaVersion: 'support.access_recovery.session_guard.v1',
                requestId,
                supportSessionId: supportSessionId || null,
                targetUserId: targetUserId || null,
                email: input.emails[0],
                role: input.role,
                expiresAt: input.expiresAt,
                blockerCode: sessionValidation.error.code,
                requiredScope: 'recovery:invite',
                noSilentMembershipMutation: true,
                mutation: 'none',
                supportContext: cleanContext(req.body?.context),
                redactionRequired: true,
            },
        })
        const auditEventIds = await loadSystemEventIds({
            requestId,
            actionType: 'support.organization.access_recovery',
            entityId: supportSessionId || targetUserId || input.emails[0],
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            schemaVersion: 'support.access_recovery.session_guard.v1',
            requestId,
            supportSessionId: supportSessionId || null,
            auditEventIds,
            noSilentMembershipMutation: true,
            executionReceipt: supportAccessRecoveryExecutionReceipt({
                actorId: actor.id,
                organizationId: organization.id,
                requestId,
                reason,
                supportSessionId,
                targetUserId,
                email: input.emails[0],
                role: input.role,
                expiresAt: input.expiresAt,
                inviteId: null,
                inviteStatus: null,
                approval: null,
                outcome: 'denied',
                auditEventIds,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const existingMembership = targetUserId
        ? await run(`
            SELECT organization_id, user_id, role, status
            FROM organization_members
            WHERE organization_id = $1
              AND user_id = $2
            LIMIT 1
        `, [organization.id, targetUserId])
        : { rows: [] }

    let inviteRow = await upsertOrganizationInvite({
        id: randomUUID(), organizationId: organization.id, email: input.emails[0],
        role: input.role, invitedBy: actor.id, expiresAt: input.expiresAt,
    }) as OrganizationInviteRow
    await touchOrganization(organization.id)

    const supportContext = cleanContext(req.body?.context)
    const approval = accessRecoveryApprovalMetadata({
        actorId: actor.id,
        role: inviteRow.role,
        expiresAt: inviteRow.expires_at,
        requestId,
        outcome: 'success',
        context: supportContext,
        existingMembership: existingMembership.rows[0],
        requestedApprovalRequired: req.body?.approvalRequired,
    })
    if (approval.approvalRequired) {
        const revokedInvite = await updateOrganizationInviteAction({
            organizationId: organization.id,
            inviteId: inviteRow.id,
            action: 'revoke',
        }) as OrganizationInviteRow | null
        if (!revokedInvite) {
            const currentInvite = await run(`
                SELECT status
                FROM organization_invites
                WHERE id = $1 AND organization_id = $2
                LIMIT 1
            `, [inviteRow.id, organization.id])
            const inviteStatus = text(currentInvite.rows[0]?.status)
            const blocker = inviteStatus === 'accepted'
                ? 'accepted_invite_not_mutable_by_support_action'
                : 'support_invite_revoke_failed'
            const message = inviteStatus === 'accepted'
                ? 'The invite was accepted before support could hold it for approval.'
                : 'The invite changed before support could hold it for approval.'
            await recordSystemEvent(req, {
                actionType: 'support.organization.access_recovery',
                actorId: actor.id,
                targetType: targetUserId ? 'user' : 'invite',
                targetId: targetUserId || inviteRow.email,
                organizationId: organization.id,
                entityId: inviteRow.id,
                requestId,
                severity: 'warning',
                outcome: 'failed',
                reason,
                context: {
                    schemaVersion: 'support.access_recovery.invite_transition.v1',
                    requestId,
                    supportSessionId: supportSessionId || null,
                    targetUserId: targetUserId || null,
                    inviteId: inviteRow.id,
                    inviteStatus: inviteStatus || null,
                    blockerCode: blocker,
                    approvalRequired: true,
                    mutation: 'none',
                    noSilentMembershipMutation: true,
                    supportContext,
                    redactionRequired: true,
                },
            })
            const auditEventIds = await loadSystemEventIds({
                requestId,
                actionType: 'support.organization.access_recovery',
                entityId: inviteRow.id,
            })
            return res.status(409).send(supportError(blocker, message, {
                schemaVersion: 'support.access_recovery.invite_transition.v1',
                outcome: 'failed',
                requestId,
                inviteId: inviteRow.id,
                inviteStatus: inviteStatus || null,
                auditEventIds,
                noSilentMembershipMutation: true,
                executionReceipt: supportAccessRecoveryExecutionReceipt({
                    actorId: actor.id,
                    organizationId: organization.id,
                    requestId,
                    reason,
                    supportSessionId,
                    targetUserId,
                    email: inviteRow.email,
                    role: inviteRow.role,
                    expiresAt: inviteRow.expires_at,
                    inviteId: inviteRow.id,
                    inviteStatus: inviteStatus || null,
                    approval: null,
                    outcome: 'failed',
                    auditEventIds,
                    blockers: [blocker],
                }),
            }))
        }
        inviteRow = revokedInvite
    }
    await upsertAdminAccessRecoveryApproval({
        requestId,
        organizationId: organization.id,
        inviteId: inviteRow.id,
        targetUserId: targetUserId || null,
        requestedBy: actor.id,
        requestedReason: reason,
        requestContext: supportContext,
        approvalRequired: approval.approvalRequired,
        status: approval.approvalRequired ? 'pending' : 'not_required',
        expiresAt: inviteRow.expires_at,
    })
    await recordSystemEvent(req, {
        actionType: 'support.organization.access_recovery',
        actorId: actor.id,
        targetType: targetUserId ? 'user' : 'invite',
        targetId: targetUserId || inviteRow.email,
        organizationId: organization.id,
        entityId: inviteRow.id,
        requestId,
        severity: 'warning',
        outcome: 'success',
        reason,
        context: {
            email: inviteRow.email,
            role: inviteRow.role,
            expiresAt: inviteRow.expires_at,
            inviteId: inviteRow.id,
            inviteStatus: inviteRow.status,
            targetUserId: targetUserId || null,
            supportSessionId: supportSessionId || null,
            existingMembership: existingMembership.rows[0] || null,
            caseId: text(req.body?.caseId) || null,
            supportContext,
            mutation: 'controlled_invite_only',
            approval,
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId,
        actionType: 'support.organization.access_recovery',
        entityId: inviteRow.id,
    })

    return res.status(201).send({
        recovery: {
            schemaVersion: 'support.access_recovery.v1',
            organization: toOrganization(organization),
            targetUserId: targetUserId || null,
            invite: toInvite(inviteRow),
            existingMembership: existingMembership.rows[0] || null,
            reason,
            requestId,
            requestedBy: actor.id,
            approvalRequired: approval.approvalRequired,
            approvalStatus: approval.status,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            supportSessionId: supportSessionId || null,
            approval,
            executionReceipt: supportAccessRecoveryExecutionReceipt({
                actorId: actor.id,
                organizationId: organization.id,
                requestId,
                reason,
                supportSessionId,
                targetUserId,
                email: inviteRow.email,
                role: inviteRow.role,
                expiresAt: inviteRow.expires_at,
                inviteId: inviteRow.id,
                inviteStatus: inviteRow.status,
                approval,
                outcome: 'success',
                auditEventIds,
                blockers: approval.approvalRequired ? ['pending_approval_requires_decision'] : [],
            }),
            auditEventIds,
            audit: {
                actionType: 'support.organization.access_recovery',
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: 'warning',
                eventIds: auditEventIds,
                query: `/api/admin/audit-events?request=${encodeURIComponent(requestId)}&outcome=success&source=system&service=hanasand-api`,
            },
            copyText: [
                `Access recovery invite created for ${inviteRow.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${inviteRow.role}`,
                `Expires: ${inviteRow.expires_at}`,
                `Request: ${requestId}`,
                `Approval: ${approval.status}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                approval.approvalRequired ? 'Share status: waiting for approval' : 'Share status: ready',
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function postSupportAccessRecoveryApprove(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'approved')
}

export async function postSupportAccessRecoveryDeny(req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>, res: FastifyReply) {
    return decideSupportAccessRecovery(req, res, 'denied')
}

async function decideSupportAccessRecovery(
    req: FastifyRequest<{ Params: AccessRecoveryDecisionParams, Body: SupportAccessRecoveryDecisionBody }>,
    res: FastifyReply,
    decision: 'approved' | 'denied',
) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, decision === 'approved' ? 'Access recovery approval reason' : 'Access recovery denial reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid access recovery decision reason.' })
    }

    const current = await loadAccessRecoveryApproval(req.params.requestId)
    if (!current) {
        await recordSystemEvent(req, {
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            actorId: actor.id,
            targetType: 'access_recovery',
            targetId: req.params.requestId,
            entityId: req.params.requestId,
            requestId: req.params.requestId,
            severity: 'notice',
            outcome: 'failed',
            reason,
            context: { error: 'access_recovery_request_not_found' },
        })
        return res.status(404).send({ error: 'Access recovery request not found.' })
    }
    if (await hasOrganizationPrivacyDeletionMarker(current.organization_id)) return res.status(409).send({ error: 'Organization deletion is in progress; support writes are blocked.' })

    const supportSessionId = supportSessionIdFromRequest(req, req.body)
    const requiredScope = decision === 'approved' ? 'recovery:approve' : 'recovery:deny'
    const decisionReceiptContext = { actorId: actor.id, decision, reason, supportSessionId, requiredScope }
    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId,
        action: 'access_recovery',
        requiredScope,
        organizationId: current.organization_id,
        targetUserId: current.target_user_id || null,
    })
    if (sessionValidation.error) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'denied', reason, {
            error: sessionValidation.error.code,
            schemaVersion: 'support.access_recovery.session_guard.v1',
            supportSessionId: supportSessionId || null,
            requiredScope,
            blockerCode: sessionValidation.error.code,
            noSilentMembershipMutation: true,
            mutation: 'none',
            supportContext: cleanContext(req.body?.context),
            redactionRequired: true,
        })
        const auditEventIds = await loadSystemEventIds({
            requestId: current.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: current.invite_id,
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            schemaVersion: 'support.access_recovery.session_guard.v1',
            requestId: current.request_id,
            supportSessionId: supportSessionId || null,
            requiredScope,
            auditEventIds,
            noSilentMembershipMutation: true,
            decision: toAccessRecoveryDecision(current),
            decisionReceipt: supportAccessRecoveryDecisionReceipt({
                ...decisionReceiptContext,
                approval: toAccessRecoveryDecision(current),
                outcome: 'denied',
                auditEventIds,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    if (!current.approval_required) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'failed', reason, { error: 'approval_not_required' })
        const auditEventIds = await loadSystemEventIds({
            requestId: current.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: current.invite_id,
        })
        const detail = toAccessRecoveryDecision(current)
        return res.status(409).send({
            error: 'This access recovery request does not require approval.',
            decision: detail,
            decisionReceipt: supportAccessRecoveryDecisionReceipt({
                ...decisionReceiptContext,
                approval: detail,
                outcome: 'failed',
                auditEventIds,
                blockers: ['approval_not_required'],
            }),
        })
    }

    if (current.requested_by === actor.id) {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'denied', reason, { error: 'self_approval_denied' })
        const auditEventIds = await loadSystemEventIds({
            requestId: current.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: current.invite_id,
        })
        const detail = toAccessRecoveryDecision(current)
        return res.status(403).send({
            error: 'Access recovery approval requires a different admin than the requester.',
            decision: detail,
            decisionReceipt: supportAccessRecoveryDecisionReceipt({
                ...decisionReceiptContext,
                approval: detail,
                outcome: 'denied',
                auditEventIds,
                blockers: ['self_approval_denied'],
            }),
        })
    }

    if (current.status !== 'pending') {
        await recordAccessRecoveryDecisionAudit(req, actor.id, current, decision, 'failed', reason, { error: 'approval_not_pending', status: current.status })
        const auditEventIds = await loadSystemEventIds({
            requestId: current.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: current.invite_id,
        })
        const detail = toAccessRecoveryDecision(current)
        return res.status(409).send({
            error: `Access recovery request is already ${current.status}.`,
            decision: detail,
            decisionReceipt: supportAccessRecoveryDecisionReceipt({
                ...decisionReceiptContext,
                approval: detail,
                outcome: 'failed',
                auditEventIds,
                blockers: ['approval_not_pending'],
            }),
        })
    }

    const mutation = await withTransaction(async query => {
        const lockedApproval = await loadAccessRecoveryApproval(req.params.requestId, query, true)
        if (!lockedApproval) return { error: 'access_recovery_request_not_found' as const }
        if (lockedApproval.status !== 'pending') return { error: 'approval_not_pending' as const, approval: lockedApproval }
        await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [lockedApproval.organization_id])
        if (await hasOrganizationPrivacyDeletionMarker(lockedApproval.organization_id, query)) {
            return { error: 'organization_deletion_in_progress' as const, approval: lockedApproval }
        }

        const inviteBefore = await query(`
            SELECT id, status, expires_at
            FROM organization_invites
            WHERE id = $1 AND organization_id = $2
            FOR UPDATE
        `, [lockedApproval.invite_id, lockedApproval.organization_id])
        const inviteRow = inviteBefore.rows[0] as { id: string, status: string, expires_at: Date | string | null } | undefined
        if (!inviteRow) return { error: 'invite_not_found' as const, approval: lockedApproval }
        if (decision === 'approved' && (!inviteRow.expires_at || new Date(inviteRow.expires_at).getTime() <= Date.now())) {
            return { error: 'access_recovery_invite_expired' as const, approval: lockedApproval, inviteStatus: inviteRow.status }
        }
        const invite = await updateOrganizationInviteAction({
            organizationId: lockedApproval.organization_id,
            inviteId: lockedApproval.invite_id,
            action: decision === 'approved' ? 'resend' : 'revoke',
            ...(decision === 'approved' ? { expiresAt: inviteRow.expires_at || undefined } : {}),
        }, query)
        if (!invite) return { error: 'invite_not_mutable' as const, approval: lockedApproval, inviteStatus: inviteRow.status }

        const updatedApproval = await query(`
            UPDATE admin_access_recovery_approvals
            SET status = $2,
                approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE NULL END,
                approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
                denied_by = CASE WHEN $2 = 'denied' THEN $3 ELSE NULL END,
                denied_at = CASE WHEN $2 = 'denied' THEN NOW() ELSE NULL END,
                decision_reason = $4,
                outcome = CASE WHEN $2 = 'approved' THEN 'success' ELSE 'denied' END,
                updated_at = NOW()
            WHERE request_id = $1 AND status = 'pending'
            RETURNING *
        `, [lockedApproval.request_id, decision, actor.id, reason])
        if (!updatedApproval.rows[0]) throw new Error('Locked access recovery approval could not be updated.')
        return { error: null, approval: lockedApproval, updatedApproval: updatedApproval.rows[0] as AccessRecoveryApprovalRow, invite }
    })
    if (mutation.error) {
        const currentApproval = mutation.approval
            ? { ...mutation.approval, ...('inviteStatus' in mutation ? { invite_status: mutation.inviteStatus } : {}) }
            : current
        const error = mutation.error === 'invite_not_mutable'
            ? 'accepted_invite_not_mutable_by_support_action'
            : mutation.error
        await recordAccessRecoveryDecisionAudit(req, actor.id, currentApproval, decision, 'failed', reason, {
            error,
            blockerCode: error,
            inviteStatus: 'inviteStatus' in mutation ? mutation.inviteStatus : currentApproval.invite_status,
            mutation: 'none',
            supportSessionId: supportSessionId || null,
            supportContext: cleanContext(req.body?.context),
        })
        const auditEventIds = await loadSystemEventIds({
            requestId: currentApproval.request_id,
            actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
            entityId: currentApproval.invite_id,
        })
        const detail = toAccessRecoveryDecision(currentApproval)
        return res.status(mutation.error === 'approval_not_pending' ? 409 : mutation.error === 'access_recovery_request_not_found' ? 404 : 409).send({
            error: mutation.error === 'approval_not_pending'
                ? `Access recovery request is already ${currentApproval.status}.`
                : mutation.error === 'access_recovery_request_not_found'
                    ? 'Access recovery request not found.'
                    : mutation.error === 'organization_deletion_in_progress'
                        ? 'Organization deletion is in progress; support writes are blocked.'
                        : mutation.error === 'access_recovery_invite_expired'
                            ? 'The access recovery invite has expired; create a fresh recovery request.'
                            : 'The access recovery invite changed and could not be updated.',
            decision: detail,
            decisionReceipt: supportAccessRecoveryDecisionReceipt({
                ...decisionReceiptContext,
                approval: detail,
                outcome: 'failed',
                auditEventIds,
                blockers: [error],
            }),
        })
    }
    const currentForDecision = mutation.approval

    const updated = {
        ...currentForDecision,
        ...mutation.updatedApproval,
        email: currentForDecision.email,
        role: currentForDecision.role,
        organization_name: currentForDecision.organization_name,
        invite_status: (mutation.invite as OrganizationInviteRow).status || currentForDecision.invite_status,
    } as AccessRecoveryApprovalRow
    const detail = toAccessRecoveryDecision(updated)
    await recordAccessRecoveryDecisionAudit(req, actor.id, updated, decision, decision === 'approved' ? 'success' : 'denied', reason, {
        decision: detail,
        supportSessionId: supportSessionId || null,
        supportContext: cleanContext(req.body?.context),
    })
    const auditEventIds = await loadSystemEventIds({
        requestId: updated.request_id,
        actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
        entityId: updated.invite_id,
    })

    return res.send({
        decision: detail,
        decisionReceipt: supportAccessRecoveryDecisionReceipt({
            ...decisionReceiptContext,
            approval: detail,
            outcome: decision === 'approved' ? 'success' : 'denied',
            auditEventIds,
            blockers: decision === 'denied' ? ['denied_recovery_approval'] : [],
        }),
    })
}

// Writable-organization checks are shared from adminSupport/actionAccess.
























// Support-session action validation is shared from adminSupport/actionAccess.



async function loadOrganizationInvitesByIds(organizationId: string, inviteIds: string[]) {
    if (!inviteIds.length) return []
    const result = await run(`
        SELECT *
        FROM organization_invites
        WHERE organization_id = $1
          AND id = ANY($2::text[])
        ORDER BY created_at DESC
    `, [organizationId, inviteIds])
    return result.rows as OrganizationInviteRow[]
}

function auditContextInviteIds(context: Record<string, unknown>) {
    const direct = Array.isArray(context.inviteIds) ? context.inviteIds : []
    return direct.map(id => text(id)).filter(Boolean)
}


async function loadAccessRecoveryApproval(requestId: string, query: typeof run = run, lock = false) {
    const result = await query(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        WHERE approval.request_id = $1
        LIMIT 1${lock ? '\n        FOR UPDATE OF approval' : ''}
    `, [requestId])
    return result.rows[0] as AccessRecoveryApprovalRow | undefined
}

async function recordAccessRecoveryDecisionAudit(
    req: FastifyRequest,
    actorId: string,
    row: AccessRecoveryApprovalRow,
    decision: 'approved' | 'denied',
    outcome: 'success' | 'denied' | 'failed',
    reason: string,
    extra: Record<string, unknown> = {},
) {
    await recordSystemEvent(req, {
        actionType: `support.organization.access_recovery.${decision === 'approved' ? 'approve' : 'deny'}`,
        actorId,
        targetType: 'invite',
        targetId: row.invite_id,
        organizationId: row.organization_id,
        entityId: row.invite_id,
        requestId: row.request_id,
        severity: outcome === 'success' ? 'warning' : 'notice',
        outcome,
        reason,
        context: {
            schemaVersion: 'support.access_recovery.decision_audit.v1',
            requestId: row.request_id,
            inviteId: row.invite_id,
            inviteStatus: row.invite_status,
            requestedBy: row.requested_by,
            approvalRequired: row.approval_required,
            status: row.status,
            approvedBy: row.approved_by || null,
            approvedAt: row.approved_at || null,
            deniedBy: row.denied_by || null,
            deniedAt: row.denied_at || null,
            outcome,
            ...extra,
        },
    })
}









































function buildSupportWorkbench(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    users: Record<string, unknown>[]
    memberships: Record<string, unknown>[]
    invites: Record<string, unknown>[]
    recoveryEligibility: Array<Record<string, any>>
    caseSummary: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    preparationInput?: SupportActionPreparationInput | null
}) {
    const activeMemberships = input.memberships.filter(row => row.status === 'active')
    const inactiveMemberships = input.memberships.filter(row => row.status !== 'active')
    const pendingInvites = input.invites.filter(row => row.status === 'pending')
    const targetUser = input.users.find(row => row.id === input.user)
    const userInactive = Boolean(targetUser && isAccountUnavailable(targetUser))
    const noAdminAvailable = input.recoveryEligibility.some(item => {
        const availability = item.adminAvailability as OrganizationMembershipAvailability | undefined
        return availability && !availability.hasAvailableAdmin
    })
    const ambiguousTarget = input.organizationIds.length > 1 && !input.org
    const recoveryAvailable = input.recoveryEligibility.some(item => item.canCreateControlledInvite)
    const inviteAssistAvailable = Boolean(input.organizationIds.length && input.email)
    const impersonationEligible = Boolean(input.user && !userInactive)
    const blockers = uniqueTimelineValues([
        input.organizationIds.length ? '' : 'missing_org_target',
        input.user || input.email ? '' : 'missing_user_target',
        ambiguousTarget ? 'ambiguous_target' : '',
        inactiveMemberships.length ? 'inactive_member' : '',
        noAdminAvailable ? 'no_admin_available' : '',
        recoveryAvailable ? '' : 'recovery_unavailable',
        impersonationEligible ? '' : 'impersonation_ineligible',
        input.timelineFilter.unsupported.length ? 'audit_filter_unavailable' : '',
    ])
    const inviteAssistBlockers = uniqueTimelineValues([
        inviteAssistAvailable ? '' : 'missing_org_or_email',
        ambiguousTarget ? 'ambiguous_target' : '',
    ])
    const accessRecoveryBlockers = uniqueTimelineValues([
        recoveryAvailable ? '' : 'recovery_unavailable',
        ambiguousTarget ? 'ambiguous_target' : '',
        input.user || input.email ? '' : 'missing_user_target',
    ])
    const impersonationBlockers = uniqueTimelineValues([
        input.user ? '' : 'missing_user_target',
        userInactive ? 'inactive_user' : '',
    ])
    const actionPreparation = input.preparationInput
        ? buildSupportActionPreparation({
            input: input.preparationInput,
            organizationIds: input.organizationIds,
            user: input.user,
            email: input.email,
            request: input.request,
            inviteAssistBlockers,
            accessRecoveryBlockers,
            impersonationBlockers,
            noAdminAvailable,
            timeline: input.timeline,
        })
        : {
            schemaVersion: 'support.action_prepare.v1',
            requested: false,
            supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequiredFor: ['impersonation'],
            expiryRelevantFor: ['invite_assist', 'access_recovery'],
        }
    const readinessProof = supportWorkbenchReadinessProof({
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        organizationIds: input.organizationIds,
        activeMembershipCount: activeMemberships.length,
        pendingInviteCount: pendingInvites.length,
        noAdminAvailable,
        inviteAssistAvailable,
        recoveryAvailable,
        impersonationEligible,
        timeline: input.timeline,
        timelineFilter: input.timelineFilter,
        blockers,
        inviteAssistBlockers,
        accessRecoveryBlockers,
        impersonationBlockers,
        actionPreparation,
    })

    return {
        schemaVersion: 'support.workbench.v1',
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            ambiguous: ambiguousTarget,
        },
        state: {
            activeMembershipCount: activeMemberships.length,
            inactiveMembershipCount: inactiveMemberships.length,
            pendingInviteCount: pendingInvites.length,
            recoveryRequestCount: input.caseSummary.state?.recoveryRequestCount || 0,
            impersonationEventCount: input.caseSummary.state?.impersonationEventCount || 0,
            userInactive,
            noAdminAvailable,
        },
        inviteAssistance: {
            available: inviteAssistAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            scope: {
                organizationIds: input.organizationIds,
                email: input.email || null,
                inviteIds: input.invites.map(row => row.id).filter(Boolean),
            },
            blockers: inviteAssistBlockers,
            pendingInvites: pendingInvites.map(toSupportInvite),
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
            audit: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
        },
        accessRecovery: {
            available: recoveryAvailable && !ambiguousTarget,
            reasonRequired: true,
            contextRequired: true,
            expiryRequired: true,
            approvalState: input.caseSummary.nextActions?.accessRecovery?.approvalState || 'not_requested',
            options: input.recoveryEligibility,
            blockers: accessRecoveryBlockers,
            endpoints: input.organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
            audit: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
        },
        impersonationAssistance: {
            eligible: impersonationEligible,
            reasonRequired: true,
            contextRequired: true,
            scopeRequired: true,
            durationRequired: true,
            targetUserId: input.user || null,
            organizationIds: input.organizationIds,
            blockers: impersonationBlockers,
            endpoint: '/api/impersonation/start',
            audit: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
        },
        timelineProof: {
            schemaVersion: 'support.workbench.timeline_proof.v1',
            filter: input.timelineFilter,
            eventIds: input.timeline.map(event => event.id),
            inviteAssistance: auditTimelineLink({ org: input.org, target: input.email, request: input.request, action: 'invite_assist' }),
            accessRecovery: auditTimelineLink({ org: input.org, target: input.user || input.email, request: input.request, action: 'access_recovery' }),
            impersonation: auditTimelineLink({ target: input.user, request: input.request, action: 'impersonation' }),
            redacted: true,
        },
        actionPreparation,
        readinessProof,
        blockers,
        copyText: [
            `Support workbench org=${input.org || input.organizationIds.join(',') || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Invite assist: ${inviteAssistAvailable && !ambiguousTarget ? 'available' : inviteAssistBlockers.join(',') || 'blocked'}`,
            `Access recovery: ${recoveryAvailable && !ambiguousTarget ? 'available' : accessRecoveryBlockers.join(',') || 'blocked'}`,
            `Impersonation: ${impersonationEligible ? 'eligible' : impersonationBlockers.join(',') || 'ineligible'}`,
            `Audit events: ${input.timeline.map(event => event.id).join(', ') || 'none'}`,
        ].join('\n'),
    }
}















function supportWorkbenchReadinessProof(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    activeMembershipCount: number
    pendingInviteCount: number
    noAdminAvailable: boolean
    inviteAssistAvailable: boolean
    recoveryAvailable: boolean
    impersonationEligible: boolean
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    blockers: string[]
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    actionPreparation: Record<string, any>
}) {
    const lastProof = input.timeline[0] || null
    return {
        schemaVersion: 'support.workbench.readiness_proof.v1',
        generatedAt: new Date().toISOString(),
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        supportActionsAvailable: {
            scopedSession: Boolean(input.organizationIds.length || input.user),
            inviteAssistance: input.inviteAssistAvailable && input.noAdminAvailable,
            inviteResendRevoke: input.pendingInviteCount > 0 && input.noAdminAvailable,
            memberRoleRecovery: input.activeMembershipCount > 0 && input.noAdminAvailable,
            accessRecovery: input.recoveryAvailable,
            impersonation: input.impersonationEligible,
        },
        requiredInputs: {
            reason: true,
            scope: true,
            expiryFor: ['inviteAssistance', 'inviteResend', 'accessRecovery'],
            durationFor: ['impersonation'],
            idempotencyKey: true,
        },
        auditFiltersAvailable: ['org', 'target', 'actor', 'action', 'outcome', 'request', 'entity', 'from', 'to', 'correlation', 'idempotency', 'supportSession', 'reason'],
        timelineFilter: input.timelineFilter,
        lastProof: lastProof ? {
            eventId: lastProof.id,
            action: lastProof.action,
            outcome: lastProof.outcome,
            severity: lastProof.severity,
            requestId: lastProof.requestId || null,
            organizationId: lastProof.organizationId || null,
            entityId: lastProof.entityId || null,
            createdAt: lastProof.createdAt || null,
        } : null,
        blockers: uniqueTimelineValues([
            ...input.blockers,
            ...input.inviteAssistBlockers,
            ...input.accessRecoveryBlockers,
            ...input.impersonationBlockers,
            input.noAdminAvailable ? '' : 'active_admin_available',
        ]),
        actionPreparation: {
            requested: Boolean(input.actionPreparation?.requested),
            action: input.actionPreparation?.action || null,
            outcome: input.actionPreparation?.outcome || null,
            requestId: input.actionPreparation?.requestId || null,
            correlationId: input.actionPreparation?.correlationId || null,
            idempotencyKey: input.actionPreparation?.idempotencyKey || null,
            blockers: input.actionPreparation?.blockers || [],
        },
        redacted: true,
    }
}

function supportReadinessExport(input: {
    actorId: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    org: string
    user: string
    email: string
    request: string
    entity: string
    entityType: string
    supportSession: string
}) {
    const eventIds = input.timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const actions = uniqueTimelineValues(input.timeline.map(event => event.action || event.actionType))
    const outcomes = uniqueTimelineValues(input.timeline.map(event => event.outcome))
    const caseTimelineEntries = supportCaseTimelineEntries(input.timeline)
    const lifecycleCleanupExport = supportRecoveryLifecycleCleanupExport({
        actorId: input.actorId,
        timelineFilter: input.timelineFilter,
        timeline: input.timeline,
        org: input.org,
        user: input.user,
        email: input.email,
        request: input.request,
        entity: input.entity,
        entityType: input.entityType,
        supportSession: input.supportSession,
    })
    const requestIds = uniqueTimelineValues([
        input.request,
        ...input.timeline.map(event => event.requestId),
    ])
    const entityIds = uniqueTimelineValues([
        input.entity,
        ...input.timeline.map(event => event.entity?.id || event.entityId),
    ])
    const blockers = uniqueTimelineValues([
        eventIds.length ? '' : 'audit_unavailable',
        input.timelineFilter.unsupported.length ? 'audit_filter_unavailable' : '',
    ])
    return {
        schemaVersion: 'support.readiness_export.v1',
        generatedAt: new Date().toISOString(),
        status: blockers.length ? 'needs_action' : 'ready',
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        actorId: input.actorId,
        target: {
            organizationId: input.org || null,
            targetUserId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
            entityType: input.entityType || null,
            supportSessionId: input.supportSession || null,
        },
        audit: {
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
            filter: input.timelineFilter,
            filterContract: supportAuditFilterContract(input.timelineFilter, input.timeline),
            exportProof: supportAuditExportProof(input.timelineFilter, input.timeline),
            replayFilters: {
                current: auditFilterQuery(input.timelineFilter),
                bySupportSession: input.supportSession ? auditFilterQuery({ supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }) : null,
                byRequest: requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
                byEntity: entityIds.map(entity => auditFilterQuery({ entity, source: 'admin', service: 'hanasand-api' })),
                byActionOutcome: actions.flatMap(action => outcomes.map(outcome => auditFilterQuery({ action, outcome, source: 'admin', service: 'hanasand-api' }))),
                denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
                recovery: auditFilterQuery({ org: input.org, target: input.user || input.email, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' }),
                memberRecovery: auditFilterQuery({ org: input.org, target: input.user, action: 'support.organization.member_role_recovery', source: 'admin', service: 'hanasand-api' }),
                impersonation: auditFilterQuery({ org: input.org, target: input.user, action: 'impersonation', source: 'admin', service: 'hanasand-api' }),
            },
        },
        supportWorkflows: supportReadinessWorkflowContracts(input.supportSession),
        orgWebhookRecoveryReadiness: {
            schemaVersion: 'support.org_webhook_recovery.readiness_bridge.v1',
            consumesContracts: [
                'organization.worker3_ui_readiness_proof.v1',
                'dwm.webhook.destination_admin_product_progress.v1',
                'support.organization.alert_readiness.audit_bridge.v1',
            ],
            auditBridge: supportAuditBridgeAdapterContract({ org: input.org, target: input.user || input.email, request: input.request, supportSession: input.supportSession, source: 'admin', service: 'hanasand-api' }),
            recoveryBlockers: [
                'active_admin_available',
                'missing_support_reason',
                'support_session_revoked',
                'support_session_expired',
                'denied_recovery_approval',
                'duplicate_idempotency_key',
                'audit_unavailable',
                'redaction_required',
            ],
            noCrossOrgLeakage: true,
        },
        caseTimelineExport: supportReadinessCaseTimelineExport({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            entries: caseTimelineEntries,
        }),
        caseReplayFixture: supportRecoveryCaseReplayFixture({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
        }),
        lifecycleCleanupExport,
        recoveryReadinessMatrix: supportRecoveryReadinessMatrix({
            actorId: input.actorId,
            org: input.org,
            user: input.user,
            email: input.email,
            request: input.request,
            entity: input.entity,
            entityType: input.entityType,
            supportSession: input.supportSession,
            timelineFilter: input.timelineFilter,
            timeline: input.timeline,
            eventIds,
            actions,
            outcomes,
            requestIds,
            entityIds,
        }),
        receiptSchemas: [
            'support.readiness_export.v1',
            'support.recovery.readiness_matrix.v1',
            'support.recovery.case_replay_fixture.v1',
            'support.recovery.lifecycle_cleanup_export.v1',
            'support.readiness.case_timeline_export.v1',
            'support.case.timeline_entry.v1',
            'support.workbench.readiness_proof.v1',
            'support.inspection.enterprise_readiness.v1',
            'support.inspection.replay_export_packet.v1',
            'support.member_recovery.handoff_receipt.v1',
            'support.access_recovery.decision_receipt.v1',
            'support.impersonation.lifecycle_receipt.v1',
            'support.audit.filter_contract.v1',
            'support.audit.export_proof.v1',
        ],
        nextRoutes: {
            readiness: '/api/admin/support/readiness',
            inspect: '/api/admin/support/inspect',
            auditReplay: auditFilterQuery(input.timelineFilter),
            auditDetails: eventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            accessRecoveryQueue: '/api/admin/support/access-recovery',
            supportSession: input.supportSession ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSession)}` : null,
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'non_support_actor',
            'wrong_org_scope',
            'support_session_revoked',
            'support_session_expired',
            'support_session_scope_denied',
            'denied_recovery_approval',
            'duplicate_invite_or_idempotency_key',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers,
        productReadiness: {
            expectedDashboardRowId: 'helpdesk_audit',
            backendProofContractVersion: 'support.readiness_export.v1',
            integrationProbeHint: 'GET /api/admin/support/readiness must return readiness.schemaVersion=support.readiness_export.v1 and redacted audit replay filters.',
            focusedCheck: 'cd api && bun scripts/smoke-admin-support-contract.ts',
        },
        copyText: [
            `Support readiness: ${blockers.length ? 'needs_action' : 'ready'}`,
            `Actor: ${input.actorId}`,
            `Target org=${input.org || '*'} user=${input.user || '*'} request=${input.request || '*'} session=${input.supportSession || '*'}`,
            `Audit events: ${eventIds.join(', ') || 'none'}`,
            `Case timeline entries: ${caseTimelineEntries.length}`,
            `Replay: ${auditFilterQuery(input.timelineFilter)}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}









function buildSupportActionPreparation(input: {
    input: SupportActionPreparationInput
    organizationIds: string[]
    user: string
    email: string
    request: string
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    noAdminAvailable: boolean
    timeline: Array<Record<string, any>>
}) {
    const actionBlockers = input.input.action === 'invite_assist'
        ? input.inviteAssistBlockers
        : input.input.action === 'access_recovery'
            ? input.accessRecoveryBlockers
            : input.impersonationBlockers
    const blockers = uniqueTimelineValues([
        ...actionBlockers,
        input.input.scope.length ? '' : 'missing_scope',
        input.input.action === 'impersonation' && !input.input.durationMinutes ? 'invalid_duration' : '',
    ])
    const allowed = blockers.length === 0
    const actionType = input.input.action === 'impersonation'
        ? 'impersonation.start'
        : input.input.action === 'access_recovery'
            ? 'support.organization.access_recovery'
            : 'support.organization.invite_assist'
    const organizationId = input.organizationIds[0] || null
    const targetId = input.user || input.email || organizationId || null
    const requestId = input.request || 'generated-on-submit'
    const correlationId = requestId === 'generated-on-submit' ? input.input.idempotencyKey : requestId
    const handoffExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const executionHandoff = supportActionExecutionHandoff({
        action: input.input.action,
        allowed,
        organizationId,
        user: input.user,
        email: input.email,
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        supportSessionId: input.input.supportSessionId,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt,
        noAdminAvailable: input.noAdminAvailable,
        blockers,
    })
    const executorReadiness = executionHandoff.executorReadiness

    return {
        schemaVersion: 'support.action_prepare.v1',
        requested: true,
        dryRun: true,
        action: input.input.action,
        allowed,
        outcome: allowed ? 'success' : 'denied',
        requestId,
        correlationId,
        idempotencyKey: input.input.idempotencyKey,
        handoffExpiresAt,
        target: {
            organizationId,
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
        },
        reason: input.input.reason,
        context: input.input.context,
        scope: input.input.scope,
        durationMinutes: input.input.durationMinutes,
        expiresAt: input.input.expiresAt,
        blockers,
        executionHandoff,
        executorReadiness,
        auditPreview: {
            actionType,
            source: 'admin',
            service: 'hanasand-api',
            severity: input.input.action === 'impersonation' || input.input.action === 'access_recovery' ? 'warning' : 'notice',
            outcome: allowed ? 'success' : 'denied',
            targetType: input.input.action === 'impersonation' ? 'user' : input.input.action === 'access_recovery' ? 'invite' : 'organization',
            targetId,
            organizationId,
            entityId: targetId,
            requestId,
            reason: input.input.reason,
            context: redactAuditValue({
                schemaVersion: 'support.action_prepare.audit_preview.v1',
                action: input.input.action,
                dryRun: true,
                correlationId,
                idempotencyKey: input.input.idempotencyKey,
                supportSessionId: input.input.supportSessionId || null,
                handoffExpiresAt,
                execution: executionHandoff.execution,
                targetUserId: input.user || null,
                email: input.email || null,
                organizationIds: input.organizationIds,
                scope: input.input.scope,
                durationMinutes: input.input.durationMinutes,
                expiresAt: input.input.expiresAt,
                blockers,
                blockerCode: blockers[0] || null,
                timelineEventIds: input.timeline.map(event => event.id),
            }),
        },
        audit: auditTimelineLink({
            org: organizationId,
            target: input.user || input.email,
            request: input.request,
            action: input.input.action === 'impersonation' ? 'impersonation' : input.input.action,
            outcome: allowed ? 'success' : 'denied',
        }),
        copyText: [
            `Support action prepare ${input.input.action}`,
            `Target org=${organizationId || '*'} user=${input.user || '*'} email=${input.email || '*'}`,
            `Outcome: ${allowed ? 'allowed' : `blocked:${blockers.join(',')}`}`,
            `Request: ${requestId}`,
            `Reason: ${input.input.reason}`,
        ].join('\n'),
    }
}

function supportActionExecutionHandoff(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
}) {
    const execution = supportActionExecutionTarget(input)
    const executorReadiness = supportActionExecutorReadiness({
        ...input,
        execution,
    })
    return {
        schemaVersion: 'support.action_execution_handoff.v1',
        immutable: true,
        dryRun: true,
        executable: executorReadiness.ready,
        action: input.action,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        requestId: input.requestId,
        expiresAt: input.handoffExpiresAt,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_request',
        blockers: executorReadiness.blockers,
        preparationBlockers: input.blockers,
        execution,
        executorReadiness,
        audit: {
            actionType: execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: executorReadiness.ready ? 'success' : 'denied',
            blockerCode: executorReadiness.blockers[0] || null,
        },
    }
}

function supportActionExecutorReadiness(input: {
    action: SupportActionPreparationInput['action']
    allowed: boolean
    organizationId: string | null
    user: string
    email: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    durationMinutes: number | null
    expiresAt: string | null
    handoffExpiresAt: string
    noAdminAvailable: boolean
    blockers: string[]
    execution: ReturnType<typeof supportActionExecutionTarget>
}) {
    const selectedSafeAction: SupportActionPreparationInput['action'] = 'invite_assist'
    const executorBlockers = uniqueTimelineValues([
        ...input.blockers,
        input.action === selectedSafeAction ? '' : 'mutation_unavailable',
        input.action === selectedSafeAction && (!input.organizationId || !input.email) ? 'invite_unavailable' : '',
        input.action !== 'impersonation' && !input.noAdminAvailable ? 'active_admin_available' : '',
    ])
    const ready = input.allowed && input.action === selectedSafeAction && executorBlockers.length === 0
    return {
        schemaVersion: 'support.action_executor_readiness.v1',
        mutationMode: 'no_mutation_readiness',
        noMutation: true,
        immutableHandoffRequired: true,
        selectedAction: selectedSafeAction,
        action: input.action,
        ready,
        executableByExistingEndpoint: ready,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        durationRequired: input.action === 'impersonation',
        expiryRelevant: input.action !== 'impersonation',
        requestId: input.requestId,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        supportSessionId: input.supportSessionId || null,
        target: {
            organizationId: input.organizationId,
            userId: input.user || null,
            email: input.email || null,
        },
        freshness: {
            expiresAt: input.handoffExpiresAt,
            staleBlocker: 'stale_prepare_payload',
            staleHandoffBlocker: 'stale_handoff',
            validation: 'executor_must_reject_after_handoff_expires',
        },
        idempotency: {
            key: input.idempotencyKey,
            requiredHeader: 'x-idempotency-key',
            duplicateBlocker: 'duplicate_request',
            duplicateIdempotencyKeyBlocker: 'duplicate_idempotency_key',
            validation: 'executor_must_reject_reused_key_for_target_and_action',
        },
        executorContract: {
            method: input.execution.method,
            path: input.execution.path,
            requiredHeaders: input.supportSessionId
                ? ['authorization', 'x-request-id', 'x-idempotency-key', 'x-support-session-id']
                : ['authorization', 'x-request-id', 'x-idempotency-key'],
            requiredBody: supportActionExecutorRequiredBody(input.action),
            bodyPreview: input.execution.body,
            auditActionType: input.execution.auditActionType,
        },
        blockers: executorBlockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'missing_scope',
            'invalid_scope',
            'invalid_duration',
            'invalid_expiry',
            'stale_handoff',
            'stale_prepare_payload',
            'duplicate_request',
            'duplicate_idempotency_key',
            'ambiguous_target',
            'active_admin_available',
            'mutation_unavailable',
            'invite_unavailable',
            'impersonation_ineligible',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: redactAuditValue({
            schemaVersion: 'support.action_executor_readiness.audit_preview.v1',
            actionType: input.execution.auditActionType,
            source: 'admin',
            service: 'hanasand-api',
            requestId: input.requestId,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            supportSessionId: input.supportSessionId || null,
            outcome: ready ? 'success' : 'denied',
            blockerCode: executorBlockers[0] || null,
            targetOrganizationId: input.organizationId,
            targetUserId: input.user || null,
            targetEmail: input.email || null,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            durationMinutes: input.durationMinutes,
            expiresAt: input.expiresAt,
            execution: input.execution,
            redactionRequired: true,
        }),
    }
}

function supportActionExecutorRequiredBody(action: SupportActionPreparationInput['action']) {
    if (action === 'impersonation') {
        return ['object_id', 'organization_id', 'reason', 'scope', 'duration_minutes', 'context']
    }
    if (action === 'access_recovery') {
        return ['email', 'targetUserId', 'reason', 'context', 'scope', 'expiresAt']
    }
    return ['email', 'reason', 'context', 'scope', 'expiresAt']
}

function supportActionExecutionTarget(input: {
    action: SupportActionPreparationInput['action']
    organizationId: string | null
    user: string
    email: string
    requestId: string
    idempotencyKey: string
    reason: string
    context: string
    scope: string[]
    supportSessionId?: string
    durationMinutes: number | null
    expiresAt: string | null
}) {
    const headers = {
        'x-request-id': input.requestId,
        'x-idempotency-key': input.idempotencyKey,
        ...(input.supportSessionId ? { 'x-support-session-id': input.supportSessionId } : {}),
    }
    if (input.action === 'impersonation') {
        return {
            method: 'POST',
            path: '/api/impersonation/start',
            headers,
            auditActionType: 'impersonation.start',
            body: redactAuditValue({
                object_id: input.user,
                organization_id: input.organizationId,
                reason: input.reason,
                scope: input.scope,
                duration_minutes: input.durationMinutes,
                context: input.context,
            }),
        }
    }

    const organizationPath = input.organizationId ? encodeURIComponent(input.organizationId) : ':organizationId'
    if (input.action === 'access_recovery') {
        return {
            method: 'POST',
            path: `/api/admin/support/organizations/${organizationPath}/access-recovery`,
            headers,
            auditActionType: 'support.organization.access_recovery',
            body: redactAuditValue({
                email: input.email,
                targetUserId: input.user || null,
                reason: input.reason,
                context: input.context,
                scope: input.scope,
                expiresAt: input.expiresAt,
            }),
        }
    }

    return {
        method: 'POST',
        path: `/api/admin/support/organizations/${organizationPath}/invites`,
        headers,
        auditActionType: 'support.organization.invite_assist',
        body: redactAuditValue({
            email: input.email,
            reason: input.reason,
            context: input.context,
            scope: input.scope,
            expiresAt: input.expiresAt,
        }),
    }
}






export function supportInviteAssistExecutorControls(
    req: FastifyRequest,
    body: SupportInviteBody | undefined,
    requestId: string,
): SupportExecutorControlsResult {
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: 'invite_assist',
        scopeAction: 'invite_assist',
        requiredScope: 'invite:create',
        invalidScopeMessage: 'Invite assistance execution requires invite:create scope.',
        invalidExpiryMessage: 'Support invite assistance handoff expiry must be a valid timestamp.',
        expiredHandoffMessage: 'Support invite assistance handoff has expired; prepare a fresh action before executing.',
    })
}

async function recordSupportInviteAssistExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    blocker: string
    input: ReturnType<typeof normalizeInviteInput>
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    supportContext: string
}) {
    return recordSupportExecutorBlock(req, {
        actionType: 'support.organization.invite_assist',
        action: 'invite_assist',
        actorId: input.actorId,
        targetType: 'organization',
        targetId: input.organizationId,
        entityId: input.input.emails.join(','),
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: { emails: input.input.emails, role: input.input.role, expiresAt: input.input.expiresAt },
    })
}


function supportInviteAssistExecutorBlocker(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    blockers: string[]
}) {
    return supportInviteAssistExecutorDetail({
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        controls: input.controls,
        input: input.input,
        inviteIds: [],
        outcome: 'denied',
        blockers: input.blockers,
    })
}




function supportInviteAssistExecutorDetail(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    inviteIds: string[]
    outcome: 'success' | 'denied'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_assist.v1',
        mutationMode: 'controlled_invite_row_only',
        action: 'invite_assist',
        ...supportExecutorMetadata(input.requestId, input.controls, true),
        target: {
            organizationId: input.organizationId,
            emails: input.input.emails,
            inviteIds: input.inviteIds,
        },
        scope: input.controls.scope,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            ...supportExecutorCommonBlockerCatalog,
            'ambiguous_target',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            actionType: 'support.organization.invite_assist',
            targetFields: { emails: input.input.emails, inviteIds: input.inviteIds, expiresAt: input.input.expiresAt },
        }),
    }
}

function supportInviteAssistExecutionReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    invites: OrganizationInviteRow[]
    inviteIds: string[]
    outcome: 'success' | 'denied'
    auditEventIds: number[]
    blockers: string[]
}) {
    const entityId = input.inviteIds.join(',')
    return {
        schemaVersion: 'support.invite_assist.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: 'controlled_invite_row_only',
        action: 'invite_assist',
        actionType: 'support.organization.invite_assist',
        outcome: input.outcome,
        severity: 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'organization',
        targetId: input.organizationId,
        entityId,
        inviteIds: input.inviteIds,
        emails: input.invites.map(invite => invite.email),
        role: input.input.role,
        expiresAt: input.input.expiresAt,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        auditEventIds: input.auditEventIds,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: supportInviteAssistAuditQuery({
                requestId: input.requestId,
                organizationId: input.organizationId,
                entityId,
                correlationId: input.controls.correlationId,
                idempotencyKey: input.controls.idempotencyKey,
                reason: input.reason,
            }),
            byTargetType: auditFilterQuery({ targetType: 'organization', org: input.organizationId, entity: entityId, request: input.requestId }),
            byInviteTargetType: input.inviteIds.map(inviteId => auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId })),
            deniedReplay: auditFilterQuery({ targetType: 'organization', org: input.organizationId, action: 'support.organization.invite_assist', outcome: 'denied', request: input.requestId }),
        },
        blockers: input.blockers,
        copyText: [
            `Support invite assistance receipt ${input.inviteIds.join(', ') || 'none'}`,
            `Request: ${input.requestId}`,
            `Expires: ${input.input.expiresAt}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ targetType: 'organization', org: input.organizationId, entity: entityId, request: input.requestId })}`,
        ].join('\n'),
    }
}


function supportInviteAssistAuditQuery(input: {
    requestId: string
    organizationId: string
    entityId: string
    correlationId: string
    idempotencyKey: string
    reason: string
}) {
    return supportExecutorAuditQuery({ ...input, entityId: input.entityId || undefined, actionType: 'support.organization.invite_assist', outcome: 'success' })
}

export { supportInviteActionExecutorControls } from './adminSupport/inviteActions/controls.ts'
