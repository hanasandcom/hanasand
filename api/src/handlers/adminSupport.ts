import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAdminSupport } from './adminSupport/auth.ts'
export { requireAdminSupport } from './adminSupport/auth.ts'
export { postSupportSession, getSupportSession, postSupportSessionRevoke } from './adminSupport/sessions/index.ts'
export { getSupportOrganizationInvite, getSupportOrganizationMember } from './adminSupport/cases/organizationEntityReads.ts'
export { getSupportOrganization } from './adminSupport/cases/organizationRead.ts'
export { getSupportUser } from './adminSupport/cases/userRead.ts'
import { inviteSnapshot } from './adminSupport/cases/organizationEntityReads.ts'
import { loadOrganizationSupportDetail, loadSupportMemberDetail } from './adminSupport/cases/organizationReadData.ts'
import { buildSupportInspectionAuthorization } from './adminSupport/cases/inspection/authorization.ts'
import { supportTimelineFilter } from './adminSupport/cases/inspection/timelineFilter.ts'
import { toAccessRecoveryDecision } from './adminSupport/cases/accessRecoveryApprovalMapping.ts'
export { buildSupportSubjectAccessState, buildSupportSubjectInspectionAuthorization } from './adminSupport/cases/subjectAccessState.ts'
export { buildSupportSubjectInspectionContext } from './adminSupport/cases/subjectInspectionContext.ts'
export { buildSupportSubjectInspectionReceipts } from './adminSupport/cases/subjectInspectionReceipts.ts'
import { SUPPORT_AUDIT_TIMELINE_SELECT } from './adminSupport/sessions/sessionTimeline.ts'
import { randomUUID } from 'crypto'
import run, { withTransaction } from '#db'
import { updateActiveOrganizationMemberRole, updateOrganizationInviteAction, upsertAdminAccessRecoveryApproval, upsertOrganizationInvite } from '#utils/db/identityDataWrites.ts'
import { isAccountUnavailable } from '#utils/accountAvailability.ts'
import { loadInspectionApprovals, loadInspectionAuditEvents } from './adminSupport/inspectionEventLoaders.ts'
import { loadInspectionInvites, loadInspectionMemberships, loadInspectionOrganizations, loadInspectionUsers } from './adminSupport/inspectionEntityLoaders.ts'
import { toSystemEvent, toSupportAuditTimelineEvent } from './adminSupport/audit/auditEventProjection.ts'
import { auditTimelineSummary } from './adminSupport/audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from './adminSupport/audit/auditFilterPackets.ts'
import { supportAuditExportProof, supportAuditCompliancePacket } from './adminSupport/audit/auditExportPackets.ts'
import { supportAuditBridgeAdapterContract } from './adminSupport/audit/auditBridgePackets.ts'
import { supportAuditTimelineReplayContract } from './adminSupport/audit/auditReplayContracts.ts'
import { supportAuditCaseReplayExport } from './adminSupport/audit/auditCaseReplayExport.ts'
import { supportAuditSupportWorkflowPacket, supportAuditWorkflowRollup } from './adminSupport/audit/auditWorkflowSummary.ts'
import { supportAuditActionEvidenceRollup } from './adminSupport/audit/auditEvidenceRollups.ts'
import { supportAuditEventDecisionPacket } from './adminSupport/audit/auditDecisionPackets.ts'
import { supportAuditEventDetailResponse } from './adminSupport/audit/auditEventDetail.ts'
import { supportCaseTimelineEntries } from './adminSupport/audit/auditCaseTimeline.ts'
import { systemEventFilters } from './adminSupport/audit/auditFilterDefinitions.ts'
import { appendSystemEventFilters } from './adminSupport/audit/systemEventFilters.ts'
import { toSupportUser, toSupportMemberDetail, membershipSnapshot, buildRecoveryEligibility, toSupportInvite } from './adminSupport/cases/subjectMapping.ts'
import { buildSupportAccessStatus } from './adminSupport/cases/accessStatus.ts'
import { buildSupportAccessRecoveryPlan } from './adminSupport/cases/accessRecoveryPlan.ts'
import { buildSupportCaseSummary } from './adminSupport/cases/caseSummary.ts'
import { auditTimelineLink } from './adminSupport/audit/auditLinks.ts'
import { supportRecoveryLifecycleCleanupExport } from './adminSupport/cases/readiness/lifecycleCleanupExport.ts'
import { supportReadinessCaseTimelineExport } from './adminSupport/cases/readiness/caseTimelineExport.ts'
import { supportRecoveryReadinessMatrix } from './adminSupport/cases/readiness/readinessMatrix.ts'
import { supportRecoveryCaseReplayFixture } from './adminSupport/cases/readiness/caseReplayFixture.ts'
import { supportReadinessWorkflowContracts } from './adminSupport/cases/readiness/workflowContracts.ts'
import { supportInspectionEnterpriseReadiness } from './adminSupport/cases/inspection/enterpriseReadiness.ts'
import { supportInspectionNegativeCaseMatrix } from './adminSupport/cases/inspection/negativeCaseMatrix.ts'
import { supportInspectionApprovalDecisionPacket } from './adminSupport/cases/inspection/approvalDecisionPacket.ts'
import { supportInspectionReceiptReplayPacket } from './adminSupport/cases/inspection/receiptReplayPacket.ts'
import { supportSessionReplayReceipt } from './adminSupport/cases/inspection/sessionReplayReceipt.ts'
import { supportInspectionReplayExportPacket } from './adminSupport/cases/inspection/replayExportPacket.ts'
import { supportWorkbenchAdapter } from './adminSupport/cases/workbenchAdapter.ts'
import type { AccessRecoveryApprovalRow } from './adminSupport/supportTypes.ts'
import { activeOrganizationOwnerCount as activeOwnerCount, organizationMembershipAvailability as loadOrganizationAvailability, type OrganizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { compileAuditQuery } from '#utils/auditQuery.ts'
import { hasOrganizationPrivacyDeletionMarker, organizationPrivacyDeletionInProgress } from '#utils/organizationLifecycle.ts'
import { cleanContext, headerText, normalizeApprovalStatus, normalizeOption, normalizeSupportPreparationDuration, normalizeSupportPreparationExpiry, normalizeSupportPreparationScope, supportError, supportInspectionQueryFilters, supportRequestId, supportSessionIdFromRequest, supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterValidationError } from '#utils/support/auditFilterValidation.ts'
import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'
import { supportSessionResponse } from '#utils/support/sessionPresentation.ts'
import { auditFilterQuery, supportInspectionActionAuditContract, supportInspectionAuditDetailPacket, supportInspectionAuditFilterCoverage, supportInspectionAuthorizationMatrix, supportInspectionFilters, supportInspectionOrgBoundaryProof, supportInspectionRecoveryFixturePacket, supportInspectionSearchProof, uniqueTimelineValues, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { loadSystemEventIds, recordSystemEvent, redactAuditValue, requireAuditReason } from '#utils/systemEvent.ts'
import {
    normalizeInviteInput,
    normalizeMemberRoleInput,
    toInvite,
    toOrganization,
    type InviteInput,
    type OrganizationRole,
    type OrganizationInviteRow,
    type OrganizationRow,
} from '#utils/organizations.ts'

type AuditQuery = {
    format?: string
    hql?: string
    q?: string
    org?: string
    orgId?: string
    organizationId?: string
    actor?: string
    actorId?: string
    supportActor?: string
    supportActorId?: string
    target?: string
    targetId?: string
    user?: string
    userId?: string
    targetUserId?: string
    action?: string
    actionType?: string
    severity?: string
    source?: string
    service?: string
    entity?: string
    entityId?: string
    entityType?: string
    request?: string
    requestId?: string
    correlation?: string
    correlationId?: string
    idempotency?: string
    idempotencyKey?: string
    idempotency_key?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    workflow?: string
    bridgeWorkflow?: string
    sourceWorkflow?: string
    blocker?: string
    blockerCode?: string
    reason?: string
    supportReason?: string
    scope?: string
    supportScope?: string
    context?: string
    supportContext?: string
    outcome?: string
    from?: string
    to?: string
    limit?: string
    cursor?: string
    page?: string
}

type AuditEventParams = {
    id: string
}

type OrganizationParams = {
    id: string
}

type OrganizationMemberParams = OrganizationParams & {
    userId: string
}

type SupportInspectionQuery = {
    q?: string
    org?: string
    orgId?: string
    user?: string
    userId?: string
    email?: string
    request?: string
    requestId?: string
    entity?: string
    entityId?: string
    entityType?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    workflow?: string
    bridgeWorkflow?: string
    sourceWorkflow?: string
    action?: string
    severity?: string
    outcome?: string
    source?: string
    service?: string
    blocker?: string
    blockerCode?: string
    prepareAction?: string
    reason?: string
    supportReason?: string
    supportScope?: string
    context?: string
    supportContext?: string
    scope?: string
    idempotencyKey?: string
    idempotency_key?: string
    durationMinutes?: string
    duration_minutes?: string
    expiresAt?: string
    expires_at?: string
    from?: string
    to?: string
    limit?: string
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

type SupportInviteActionParams = OrganizationParams & {
    inviteId: string
}

type SupportInviteActionBody = {
    action?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

type SupportMemberRoleRecoveryBody = {
    role?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
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

type AccessRecoveryApprovalQuery = {
    request?: string
    requestId?: string
    org?: string
    orgId?: string
    status?: string
    outcome?: string
    requester?: string
    requestedBy?: string
    approver?: string
    approvedBy?: string
    from?: string
    to?: string
    limit?: string
}

type SupportAccessRecoveryDecisionBody = {
    reason?: unknown
    context?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
}







type SupportActionPreparationInput = {
    action: 'invite_assist' | 'access_recovery' | 'impersonation'
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    idempotencyKey: string
    durationMinutes: number | null
    expiresAt: string | null
}



export async function getSystemEvents(req: FastifyRequest, res: FastifyReply) {
    const started = performance.now()
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as AuditQuery
    if (query.format !== undefined && !['timeline', 'helpdesk'].includes(query.format)) return res.status(400).send(supportError('invalid_format', 'Unknown audit format.'))
    const timelineOnly = query.format === 'timeline'
    const helpdeskOnly = query.format === 'helpdesk'
    if (helpdeskOnly && query.hql !== undefined) return res.status(400).send(supportError('invalid_hql', 'HQL is not supported by the helpdesk format.'))
    const authorized = performance.now()
    let compiled: ReturnType<typeof compileAuditQuery> | undefined
    try {
        if (query.hql !== undefined) compiled = compileAuditQuery(text(query.hql))
    } catch (error) {
        return res.status(400).send(supportError('invalid_hql', error instanceof Error ? error.message : 'Invalid HQL query.'))
    }
    if (compiled && (query.cursor || query.page)) return res.status(400).send(supportError('invalid_hql', 'Use take to limit HQL results, without page or cursor.'))
    const where: string[] = [...(compiled?.where || [])]
    const values: Array<string | number | Date | null> = [...(compiled?.params || [])]
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }

    const q = text(query.q)
    const org = text(query.org || query.orgId || query.organizationId)
    const actorFilter = text(query.actor || query.actorId || query.supportActor || query.supportActorId)
    const target = text(query.target || query.targetId || query.user || query.userId || query.targetUserId)
    const action = text(query.action || query.actionType)
    const severity = normalizeOption(query.severity, ['info', 'notice', 'warning', 'critical'])
    const source = text(query.source)
    const service = text(query.service)
    const entity = text(query.entity || query.entityId)
    const entityType = text(query.entityType)
    const request = text(query.request || query.requestId)
    const correlation = text(query.correlation || query.correlationId)
    const idempotency = text(query.idempotency || query.idempotencyKey || query.idempotency_key)
    const supportSession = text(query.session || query.supportSession || query.supportSessionId)
    const workflow = text(query.workflow || query.bridgeWorkflow || query.sourceWorkflow)
    const blocker = text(query.blocker || query.blockerCode)
    const reason = text(query.reason || query.supportReason)
    const scope = text(query.scope || query.supportScope)
    const contextFilter = text(query.context || query.supportContext)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 200)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 500) : 200
    const page = Number(query.page || 1)
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger((page - 1) * limit) || (query.page !== undefined && text(query.cursor))) {
        return res.status(400).send(supportError('invalid_page', 'Page must be a positive whole number; use page without cursor.'))
    }
    const cursor = decodeAuditCursor(text(query.cursor))
    if (text(query.cursor) && !cursor) {
        return res.status(400).send(supportError('invalid_audit_cursor', 'Audit cursor is invalid.'))
    }
    const filterError = systemEventFilterError(query, { severity, outcome, from, to, limit })
    if (filterError) {
        return res.status(400).send(filterError)
    }

    appendSystemEventFilters({
        where,
        add,
        q,
        org,
        actor: actorFilter,
        target,
        action,
        severity,
        source,
        service,
        entity,
        entityType,
        request,
        correlation,
        idempotency,
        supportSession,
        workflow,
        blocker,
        reason,
        scope,
        context: contextFilter,
        outcome,
        from,
        to,
    })
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

function encodeAuditCursor(createdAt: unknown, id: unknown) {
    return encodeURIComponent(JSON.stringify({ createdAt: new Date(String(createdAt)).toISOString(), id: Number(id) }))
}

function decodeAuditCursor(value: string) {
    if (!value) return null
    try {
        const parsed = JSON.parse(decodeURIComponent(value)) as { createdAt?: unknown, id?: unknown }
        const createdAt = new Date(String(parsed.createdAt || ''))
        const id = Number(parsed.id)
        if (!Number.isFinite(createdAt.getTime()) || !Number.isSafeInteger(id) || id <= 0) return null
        return { createdAt: createdAt.toISOString(), id }
    } catch {
        return null
    }
}

export async function getSystemEvent(req: FastifyRequest<{ Params: AuditEventParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id < 1 || id !== Math.trunc(id)) {
        return res.status(400).send(supportError('invalid_audit_event_id', 'Audit event id must be a positive integer.', {
            field: 'id',
        }))
    }

    const result = await run(`
        SELECT
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
            e.context,
            e.ip,
            e.user_agent,
            acknowledgement.acknowledged_at,
            acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name,
            e.created_at
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id
        LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by
        WHERE e.id = $1
        LIMIT 1
    `, [id])
    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) {
        return res.status(404).send(supportError('audit_event_not_found', 'Audit event not found.', {
            id,
        }))
    }

    const event = toSystemEvent(row)
    const supportSessionId = event.detail?.actionEvidence?.supportSessionId || ''
    const relatedTimeline = await loadSystemEventRelatedTimeline(event, supportSessionId)
    await recordSystemEvent(req, {
        actionType: 'support.audit_event.inspect',
        actorId: actor.id,
        targetType: 'system_event_event',
        targetId: String(event.id),
        organizationId: event.detail?.organizationId || null,
        entityId: event.detail?.entityId || String(event.id),
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.audit_event.inspect.v1',
            inspectedEventId: Number(event.id),
            inspectedActionType: event.detail?.actionType || null,
            inspectedOutcome: event.detail?.outcome || null,
            inspectedRequestId: event.detail?.requestId || null,
            inspectedEntityId: event.detail?.entityId || null,
            relatedEventIds: relatedTimeline.map(item => item.id),
            redactionRequired: true,
        },
    })
    return res.send({
        event,
        detail: supportAuditEventDetailResponse(event, relatedTimeline, supportSessionId),
    })
}







export async function getSupportInspection(req: FastifyRequest<{ Querystring: SupportInspectionQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SupportInspectionQuery
    const filters = supportInspectionQueryFilters(query)
    const {
        q,
        org: requestedOrg,
        user: requestedUser,
        email,
        request: requestedRequest,
        entity: requestedEntity,
        entityType,
        supportSession,
        workflow,
        action,
        source,
        service,
        blocker,
        reason,
        scope,
        context: contextFilter,
        severity,
        outcome,
        from,
        to,
        limit,
    } = filters
    const prepareAction = normalizeOption(query.prepareAction, ['invite_assist', 'access_recovery', 'impersonation'])
    const sessionState = supportSession ? await loadSupportSessionState(supportSession) : null
    const inspectionRequestId = supportRequestId(req)
    if (supportSession && !sessionState) {
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId: supportSession }))
    }
    if (sessionState) {
        const orgMismatch = Boolean(requestedOrg && sessionState.organizationId && requestedOrg !== sessionState.organizationId)
        const userMismatch = Boolean(requestedUser && sessionState.targetUserId && requestedUser !== sessionState.targetUserId)
        if (orgMismatch || userMismatch) {
            const blocker = orgMismatch ? 'support_session_org_mismatch' : 'support_session_user_mismatch'
            await recordSystemEvent(req, {
                actionType: 'support.inspect',
                actorId: actor.id,
                targetType: 'support_session',
                targetId: supportSession,
                organizationId: sessionState.organizationId || requestedOrg || null,
                entityId: supportSession,
                requestId: inspectionRequestId,
                severity: 'warning',
                outcome: 'denied',
                reason: sessionState.reason || undefined,
                context: {
                    schemaVersion: 'support.inspection.session_scope_guard.v1',
                    supportSessionId: supportSession,
                    requestedOrg: requestedOrg || null,
                    requestedUser: requestedUser || null,
                    scopedOrg: sessionState.organizationId || null,
                    scopedUser: sessionState.targetUserId || null,
                    blockerCode: blocker,
                    noCrossOrgLeakage: true,
                    redactionRequired: true,
                },
            })
            return res.status(403).send(supportError(blocker, 'Support session scope does not allow this inspection target.', {
                supportSessionId: supportSession,
                requestedOrg: requestedOrg || null,
                requestedUser: requestedUser || null,
                scopedOrg: sessionState.organizationId || null,
                scopedUser: sessionState.targetUserId || null,
                noCrossOrgLeakage: true,
            }))
        }
    }
    const org = sessionState?.organizationId || requestedOrg || ''
    const user = sessionState?.targetUserId || requestedUser || ''
    const request = requestedRequest || sessionState?.requestId || ''
    const entity = requestedEntity || supportSession
    const filterError = supportInspectionFilterError(query, { q, org, user, email, request, entity, entityType, supportSession, workflow, action, severity, outcome, source, service, blocker, reason, scope, context: contextFilter, from, to, limit })
    if (filterError) {
        return res.status(400).send(filterError)
    }
    const preparationInput = supportActionPreparationInput(query, prepareAction)
    if (preparationInput.error) {
        return res.status(400).send(preparationInput.error)
    }

    if (!q && !org && !user && !email && !request && !entity && !entityType && !supportSession && !workflow && !action && !blocker && !reason && !scope && !contextFilter) {
        return res.status(400).send(supportError('missing_support_target', 'Add q, org, user, email, request, entity, entityType, supportSession, workflow, action, blocker, reason, scope, or context to inspect support state.'))
    }

    const [organizations, users, memberships, invites, approvals, audit] = await Promise.all([
        loadInspectionOrganizations({ q, org, user, email, request, limit }),
        loadInspectionUsers({ q, user, request, limit }),
        loadInspectionMemberships({ q, org, user, request, limit }),
        loadInspectionInvites({ q, org, email, request, limit }),
        loadInspectionApprovals({ q, org, user, email, request, outcome, limit }),
        loadInspectionAuditEvents({ q, org, user, email, request, entity, entityType, supportSession, workflow, action, severity, outcome, source, service, blocker, reason, scope, context: contextFilter, from, to, limit }),
    ])
    const timelineFilter = supportTimelineFilter({ q, org, user, email, request, entity, entityType, supportSession, workflow, action, severity, outcome, source, service, blocker, reason, scope, context: contextFilter, from, to, limit })
    const auditTimelineFilters = {
        q,
        org,
        target: user || email,
        request,
        entity,
        entityType,
        supportSession,
        workflow,
        action,
        severity,
        outcome,
        source,
        service,
        blocker,
        reason,
        scope,
        context: contextFilter,
        from,
        to,
        limit,
    }
    if (!organizations.length && !users.length && !memberships.length && !invites.length && !approvals.length && !audit.length) {
        return res.status(404).send(supportError('support_target_not_found', 'No support state matched the requested filters.', {
            filters: timelineFilter,
            unavailableFilters: [],
        }))
    }

    const organizationIds = Array.from(new Set([
        ...organizations.map(row => String(row.id)),
        ...memberships.map(row => String(row.organization_id)),
        ...invites.map(row => String(row.organization_id)),
        ...approvals.map(row => String(row.organization_id)),
        ...audit.map(row => String((row as Record<string, unknown>).organization_id || '')).filter(Boolean),
    ]))
    const authorization = buildSupportInspectionAuthorization({
        actorId: actor.id,
        requestedOrg,
        requestedUser,
        effectiveOrg: org,
        effectiveUser: user,
        email,
        request,
        entity,
        supportSession,
        sessionState,
        organizationIds,
    })
    const availability = organizationIds.length ? await loadOrganizationAvailability(organizationIds) : []
    const availabilityByOrg = new Map(availability.map(item => [item.organizationId, item]))
    const timeline = audit.map(toSupportAuditTimelineEvent)
    const approvalDetails = approvals.map(row => toAccessRecoveryDecision(row as AccessRecoveryApprovalRow))
    const recoveryEligibility = buildRecoveryEligibility({
        email,
        user,
        organizationIds,
        memberships,
        users,
        availabilityByOrg,
        invites,
    })
    const accessStatus = buildSupportAccessStatus({
        org,
        user,
        email,
        request,
        organizationIds,
        users,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline,
    })
    const accessRecoveryPlan = buildSupportAccessRecoveryPlan({
        org,
        user,
        email,
        request,
        organizationIds,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        availabilityByOrg,
        timeline,
        timelineFilter,
    })
    const caseSummary = buildSupportCaseSummary({
        org,
        user,
        email,
        request,
        organizationIds,
        organizations,
        users,
        memberships,
        invites,
        approvalDetails,
        recoveryEligibility,
        accessStatus,
        timeline,
        timelineFilter,
    })
    const workbench = buildSupportWorkbench({
        org,
        user,
        email,
        request,
        organizationIds,
        users,
        memberships,
        invites,
        recoveryEligibility,
        caseSummary,
        timeline,
        timelineFilter,
        preparationInput: preparationInput.value,
    })
    const workbenchAdapter = supportWorkbenchAdapter({
        org,
        user,
        email,
        request,
        workbench,
        caseSummary,
        accessStatus,
        timeline,
        timelineFilter,
    })
    const searchProof = supportInspectionSearchProof({
        q,
        org,
        user,
        email,
        request,
        entity,
        supportSession,
        organizationIds,
        organizations,
        users,
        memberships,
        invites,
        approvalDetails,
        timeline,
        timelineFilter,
    })
    const authorizationMatrix = supportInspectionAuthorizationMatrix({
        authorization,
        workbench,
        accessRecoveryPlan,
        supportSession,
        sessionState,
        organizationIds,
        user,
        email,
        request,
        timelineFilter,
    })
    const auditDetailPacket = supportInspectionAuditDetailPacket({
        org,
        user,
        email,
        request,
        supportSession,
        organizationIds,
        memberships,
        invites,
        timeline,
        timelineFilter,
    })
    const orgBoundaryProof = supportInspectionOrgBoundaryProof({
        requestedOrg: org,
        requestedUser: user,
        email,
        request,
        supportSession,
        sessionState,
        authorization,
        organizationIds,
        memberships,
        invites,
        timeline,
        timelineFilter,
    })
    const recoveryFixturePacket = supportInspectionRecoveryFixturePacket({
        org,
        user,
        email,
        request,
        supportSession,
        accessRecoveryPlan,
        workbench,
        timelineFilter,
    })
    const auditFilterCoverage = supportInspectionAuditFilterCoverage({
        timelineFilter,
        timeline,
        organizationIds,
        user,
        email,
        request,
        supportSession,
    })
    const actionAuditContract = supportInspectionActionAuditContract({
        recoveryFixturePacket,
        timelineFilter,
        organizationIds,
        user,
        email,
        request,
        supportSession,
    })
    const enterpriseReadiness = supportInspectionEnterpriseReadiness({
        authorizationMatrix,
        auditDetailPacket,
        orgBoundaryProof,
        recoveryFixturePacket,
        auditFilterCoverage,
        actionAuditContract,
        workbench,
        accessStatus,
        timelineFilter,
    })
    const negativeCaseMatrix = supportInspectionNegativeCaseMatrix({
        actionAuditContract,
        recoveryFixturePacket,
        auditFilterCoverage,
        orgBoundaryProof,
        enterpriseReadiness,
        timelineFilter,
        supportSession,
    })
    const approvalDecisionPacket = supportInspectionApprovalDecisionPacket({
        approvalDetails,
        timelineFilter,
        org,
        user,
        email,
        request,
    })
    const receiptReplayPacket = supportInspectionReceiptReplayPacket({
        timelineFilter,
        timeline,
        approvalDetails,
        org,
        user,
        email,
        request,
        supportSession,
        organizationIds,
    })
    const sessionReplayReceipt = supportSessionReplayReceipt({
        supportSession,
        sessionState,
        actorId: actor.id,
        requestId: inspectionRequestId,
        timelineFilter,
        timeline,
        receiptReplayPacket,
        authorization,
    })
    const replayExportPacket = supportInspectionReplayExportPacket({
        actorId: actor.id,
        org,
        user,
        email,
        request,
        entity,
        entityType,
        supportSession,
        organizationIds,
        timelineFilter,
        timeline,
        accessRecoveryPlan,
        approvalDecisionPacket,
        receiptReplayPacket,
        sessionReplayReceipt,
        actionHistory: null,
        authorization,
    })
    const inspectionSearchProof = { searchProof }
    const inspectionTimelineProofs = {
        auditFilterCoverage,
        actionAuditContract,
        enterpriseReadiness,
        negativeCaseMatrix,
        approvalDecisionPacket,
        receiptReplayPacket,
        sessionReplayReceipt,
        replayExportPacket,
    }

    await recordSystemEvent(req, {
        actionType: 'support.inspect',
        actorId: actor.id,
        targetType: user ? 'user' : email ? 'invite' : org ? 'organization' : supportSession ? 'support_session' : 'request',
        targetId: user || email || org || supportSession || request,
        organizationId: organizationIds[0] || null,
        entityId: supportSession || request || user || email || org || null,
        requestId: supportRequestId(req),
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.inspection.v1',
            filters: { q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            organizationCount: organizations.length,
            membershipCount: memberships.length,
            pendingInviteCount: invites.filter(row => row.status === 'pending').length,
            approvalCount: approvals.length,
            auditEventIds: timeline.map(event => event.id),
            authorization,
        },
    })

    return res.send({
        inspection: {
            schemaVersion: 'support.inspection.v1',
            generatedAt: new Date().toISOString(),
            filters: { q, org, user, email, request, entity, entityType, supportSession, action, severity, outcome, source, service, blocker, reason, context: contextFilter, from, to, limit },
            supportSession: sessionState ? supportSessionResponse({
                ...sessionState,
                actorId: sessionState.actorId,
                reason: sessionState.reason,
                requestId: sessionState.requestId,
                auditEventIds: sessionState.auditEventIds,
            }) : null,
            authorization,
            organizations: organizations.map(row => ({
                ...toOrganization(row as OrganizationRow),
                adminAvailability: availabilityByOrg.get(String(row.id)) || null,
            })),
            users: users.map(toSupportUser),
            memberships: memberships.map(toSupportMemberDetail),
            invites: invites.map(toSupportInvite),
            pendingInvites: invites.filter(row => row.status === 'pending').map(toSupportInvite),
            approvalRequests: approvalDetails,
            accessStatus,
            accessRecoveryPlan,
            caseSummary,
            workbench,
            workbenchAdapter,
            ...inspectionSearchProof,
            authorizationMatrix,
            auditDetailPacket,
            orgBoundaryProof,
            recoveryFixturePacket,
            ...inspectionTimelineProofs,
            actionPreparation: workbench.actionPreparation,
            recoveryEligibility,
            auditEventIds: timeline.map(event => event.id),
            auditTimeline: timeline,
            filteredTimeline: {
                schemaVersion: 'support.audit.filtered_timeline.v1',
                filter: timelineFilter,
                eventIds: timeline.map(event => event.id),
                summary: auditTimelineSummary(timeline),
                filterContract: supportAuditFilterContract(auditTimelineFilters, timeline),
                exportProof: supportAuditExportProof(auditTimelineFilters, timeline),
                workflowRollup: supportAuditWorkflowRollup(auditTimelineFilters, timeline),
                supportWorkflowPacket: supportAuditSupportWorkflowPacket(auditTimelineFilters, timeline),
                ...inspectionSearchProof,
                ...inspectionTimelineProofs,
                events: timeline,
                links: {
                    timeline: auditFilterQuery(auditTimelineFilters),
                    details: timeline.map(event => event.links?.detail).filter(Boolean),
                    inviteAssistance: auditTimelineLink({ org, target: email, request, action: 'invite_assist', outcome }),
                    accessRecovery: auditTimelineLink({ org, target: user || email, request, action: 'access_recovery', outcome }),
                    impersonation: auditTimelineLink({ target: user, request, action: 'impersonation', outcome }),
                    supportSession: supportSession ? auditTimelineLink({ request, action: 'support.session', outcome }) : null,
                },
                redacted: true,
                copyText: [
                    `Support timeline: ${auditFilterQuery(auditTimelineFilters)}`,
                    `Events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
                    `Outcomes: ${uniqueTimelineValues(timeline.map(event => event.outcome)).join(', ') || 'none'}`,
                ].join('\n'),
            },
            controlledActions: {
                inviteAssist: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/invites`),
                inviteActions: invites.map(invite => `/api/admin/support/organizations/${encodeURIComponent(String(invite.organization_id))}/invites/${encodeURIComponent(String(invite.id))}/actions`),
                memberRoleRecovery: memberships.map(member => `/api/admin/support/organizations/${encodeURIComponent(String(member.organization_id))}/members/${encodeURIComponent(String(member.user_id))}/role-recovery`),
                accessRecovery: organizationIds.map(id => `/api/admin/support/organizations/${encodeURIComponent(id)}/access-recovery`),
                approvalSearch: `/api/admin/support/access-recovery${request ? `?request=${encodeURIComponent(request)}` : ''}`,
                supportSession: supportSession ? `/api/admin/support/sessions/${encodeURIComponent(supportSession)}` : null,
                impersonationGuard: {
                    reasonRequired: true,
                    durationRequired: true,
                    scopeRequired: true,
                    noSilentImpersonation: true,
                    auditTimeline: `/api/admin/audit-events?action=impersonation${request ? `&request=${encodeURIComponent(request)}` : ''}`,
                },
            },
            copyText: [
                `Support inspection q=${q || '*'} org=${org || '*'} user=${user || '*'} email=${email || '*'} request=${request || '*'} session=${supportSession || '*'}`,
                `Authorization: ${authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
                `Organizations: ${organizations.length}`,
                `Memberships: ${memberships.length}`,
                `Pending invites: ${invites.filter(row => row.status === 'pending').length}`,
                `Access status: ${accessStatus.overall}`,
                `Approvals: ${approvalDetails.length}`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
            ].join('\n'),
        },
    })
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
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])
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

async function sendAcceptedSupportInviteActionDenial(req: FastifyRequest<{ Params: SupportInviteActionParams, Body: SupportInviteActionBody }>, res: FastifyReply, input: {
    actorId: string
    organization: NonNullable<Awaited<ReturnType<typeof loadOrganizationSupportDetail>>>
    invite: OrganizationInviteRow
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    controls: SupportExecutorControls
}) {
    const blocker = 'accepted_invite_not_mutable_by_support_action'
    const blockers = [blocker]
    const snapshot = inviteSnapshot(input.invite)
    const actionContext = {
        organizationId: input.organization.id,
        requestId: input.requestId,
        action: input.action,
        actionType: input.actionType,
        reason: input.reason,
        controls: input.controls,
        invite: input.invite,
    }

    await recordSystemEvent(req, {
        actionType: input.actionType,
        actorId: input.actorId,
        targetType: 'invite',
        targetId: input.invite.email,
        organizationId: input.organization.id,
        entityId: input.invite.id,
        requestId: input.requestId,
        severity: 'notice',
        outcome: 'failed',
        reason: input.reason,
        context: {
            schemaVersion: 'support.invite_action.v1',
            action: input.action,
            requestId: input.requestId,
            inviteId: input.invite.id,
            email: input.invite.email,
            role: input.invite.role,
            before: snapshot,
            after: snapshot,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            executor: supportInviteActionExecutorDetail({
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                blockers,
            }),
            error: blocker,
            noSilentMembershipMutation: true,
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({
        requestId: input.requestId,
        actionType: input.actionType,
        entityId: input.invite.id,
    })
    return res.status(409).send({
        error: 'Accepted invites cannot be revoked or resent by support action; inspect membership state instead.',
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action: input.action,
            requestId: input.requestId,
            actorId: input.actorId,
            organization: toOrganization(input.organization),
            invite: toInvite(input.invite),
            before: snapshot,
            after: snapshot,
            outcome: 'failed',
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail({
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                blockers,
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: input.actorId,
                ...actionContext,
                before: snapshot,
                after: snapshot,
                outcome: 'failed',
                auditEventIds,
                blockers,
            }),
        },
    })
}

export async function postSupportOrganizationInviteAction(req: FastifyRequest<{ Params: SupportInviteActionParams, Body: SupportInviteActionBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const action = normalizeOption(req.body?.action, ['revoke', 'resend'])
    let reason: string
    try {
        reason = requireAuditReason(req.body?.reason, 'Invite assistance action reason')
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support invite action reason.' })
    }
    if (!action) {
        return res.status(400).send({ error: 'Invite assistance action must be revoke or resend.' })
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = text(req.body?.requestId || req.body?.request_id) || supportRequestId(req)
    const actionType = action === 'revoke'
        ? 'support.organization.invite_revoke'
        : 'support.organization.invite_resend'
    const controls = supportInviteActionExecutorControls(req, req.body, requestId, action as 'revoke' | 'resend')
    if (controls.error) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: req.params.inviteId,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: controls.error.code,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: req.params.inviteId })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportInviteActionExecutorDetail({
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: controls.value,
                invite: null,
                before: null,
                after: null,
                outcome: 'denied',
                blockers: [controls.error.code],
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: actor.id,
                organizationId: organization.id,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: controls.value,
                invite: null,
                before: null,
                after: null,
                outcome: 'denied',
                auditEventIds,
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value

    const existing = await run(`
        SELECT *
        FROM organization_invites
        WHERE id = $1
          AND organization_id = $2
        LIMIT 1
    `, [req.params.inviteId, organization.id])
    const invite = existing.rows[0] as OrganizationInviteRow | undefined
    if (!invite) {
        return res.status(404).send({ error: 'Invite not found for organization.' })
    }

    const actionContext = {
        organizationId: organization.id,
        requestId,
        action: action as 'revoke' | 'resend',
        actionType,
        reason,
        controls: executorControls,
        invite,
    }

    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: action === 'revoke' ? 'invite_revoke' : 'invite_resend',
        requiredScope: action === 'revoke' ? 'invite:revoke' : 'invite:resend',
        organizationId: organization.id,
    })
    if (sessionValidation.error) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: invite.id,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: sessionValidation.error.code,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: invite.id })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportInviteActionExecutorDetail({
                ...actionContext,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                blockers: [sessionValidation.error.code],
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: actor.id,
                ...actionContext,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                auditEventIds,
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: actionType,
        organizationId: organization.id,
        subjectId: invite.id,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        return res.send({
            inviteAction: {
                schemaVersion: 'support.invite_action.v1',
                action,
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                invite: toInvite(invite),
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                reason,
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportInviteActionExecutorDetail({
                    ...actionContext,
                    requestId: duplicate.request_id,
                    before: inviteSnapshot(invite),
                    after: inviteSnapshot(invite),
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                }),
                executionReceipt: supportInviteActionExecutionReceipt({
                    actorId: actor.id,
                    ...actionContext,
                    requestId: duplicate.request_id,
                    before: inviteSnapshot(invite),
                    after: inviteSnapshot(invite),
                    outcome: 'success',
                    auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    blockers: ['duplicate_idempotency_key'],
                }),
                audit: {
                    actionType,
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: action === 'revoke' ? 'warning' : 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportInviteActionAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        inviteId: invite.id,
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                        actionType,
                        outcome: 'success',
                    }),
                },
            },
        })
    }

    const availability = await loadOrganizationAvailability([organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        await recordSupportInviteActionExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            inviteId: invite.id,
            requestId,
            action: action as 'revoke' | 'resend',
            actionType,
            reason,
            blocker: 'active_admin_available',
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
        })
        const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: invite.id })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support invite action requires unavailable org administration.', {
            executorBlocker: supportInviteActionExecutorDetail({
                ...actionContext,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                blockers: ['active_admin_available'],
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: actor.id,
                ...actionContext,
                before: inviteSnapshot(invite),
                after: inviteSnapshot(invite),
                outcome: 'denied',
                auditEventIds,
                blockers: ['active_admin_available'],
            }),
        }))
    }

    let expiresAt = invite.expires_at
    if (action === 'resend' && invite.status !== 'accepted') {
        try {
            expiresAt = normalizeInviteInput({
                email: invite.email,
                role: invite.role,
                expiresAt: req.body?.expiresAt ?? req.body?.expires_at ?? invite.expires_at,
            }).expiresAt
        } catch (error) {
            return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid invite resend expiry.' })
        }
    }

    const before = inviteSnapshot(invite)
    const updatedInvite = await updateOrganizationInviteAction({
        organizationId: organization.id,
        inviteId: invite.id,
        action: action as 'revoke' | 'resend',
        expiresAt: action === 'resend' ? expiresAt : undefined,
    }) as OrganizationInviteRow | null
    if (!updatedInvite) {
        const current = await run(`
            SELECT *
            FROM organization_invites
            WHERE id = $1 AND organization_id = $2
            LIMIT 1
        `, [invite.id, organization.id])
        const acceptedInvite = current.rows[0] as OrganizationInviteRow | undefined
        if (acceptedInvite?.status === 'accepted') {
            return sendAcceptedSupportInviteActionDenial(req, res, {
                actorId: actor.id,
                organization,
                invite: acceptedInvite,
                requestId,
                action: action as 'revoke' | 'resend',
                actionType,
                reason,
                controls: executorControls,
            })
        }
        return res.status(404).send({ error: 'Invite not found for organization.' })
    }
    const after = inviteSnapshot(updatedInvite)
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])

    await recordSystemEvent(req, {
        actionType,
        actorId: actor.id,
        targetType: 'invite',
        targetId: updatedInvite.email,
        organizationId: organization.id,
        entityId: updatedInvite.id,
        requestId,
        severity: action === 'revoke' ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.invite_action.v1',
            action,
            requestId,
            inviteId: updatedInvite.id,
            email: updatedInvite.email,
            role: updatedInvite.role,
            before,
            after,
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportInviteActionExecutorDetail({
                ...actionContext,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'invite_row_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: updatedInvite.id })

    return res.send({
        inviteAction: {
            schemaVersion: 'support.invite_action.v1',
            action,
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            invite: toInvite(updatedInvite),
            before,
            after,
            reason,
            outcome: 'success',
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportInviteActionExecutorDetail({
                ...actionContext,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                blockers: [],
            }),
            executionReceipt: supportInviteActionExecutionReceipt({
                actorId: actor.id,
                ...actionContext,
                invite: updatedInvite,
                before,
                after,
                outcome: 'success',
                auditEventIds,
                blockers: [],
            }),
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: action === 'revoke' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportInviteActionAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    inviteId: updatedInvite.id,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                    actionType,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support invite ${action} for ${updatedInvite.email}`,
                `Org: ${organization.name} (${organization.id})`,
                `Invite: ${updatedInvite.id}`,
                `Status: ${before.status} -> ${after.status}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function postSupportOrganizationMemberRoleRecovery(req: FastifyRequest<{ Params: OrganizationMemberParams, Body: SupportMemberRoleRecoveryBody }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    let reason: string
    let input: ReturnType<typeof normalizeMemberRoleInput>
    try {
        reason = requireAuditReason(req.body?.reason, 'Member role recovery reason')
        input = normalizeMemberRoleInput({
            role: req.body?.role,
            reason,
            requestId: req.body?.requestId,
            request_id: req.body?.request_id,
        })
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid support member role recovery request.' })
    }

    const organization = await requireWritableSupportOrganization(req.params.id, res)
    if (!organization) return

    const requestId = input.requestId || supportRequestId(req)
    const actionType = 'support.organization.member_role_recovery'
    const controls = supportMemberRoleRecoveryExecutorControls(req, req.body, requestId)
    if (controls.error) {
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: controls.error.code,
            requestedRole: input.role,
            controls: controls.value,
            supportContext: cleanContext(req.body?.context),
        })
        return res.status(controls.error.status).send(supportError(controls.error.code, controls.error.message, {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: controls.value,
                member: null,
                before: null,
                after: null,
                outcome: 'denied',
                blockers: [controls.error.code],
            }),
        }))
    }
    const executorControls = controls.value

    const member = await loadSupportMemberDetail(req.params.id, req.params.userId)
    if (!member) {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }

    const sessionValidation = await validateSupportSessionForAction({
        actorId: actor.id,
        supportSessionId: executorControls.supportSessionId,
        action: 'member_role_recovery',
        requiredScope: 'member:role_recovery',
        organizationId: organization.id,
        targetUserId: req.params.userId,
    })
    if (sessionValidation.error) {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: sessionValidation.error.code,
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(sessionValidation.error.status).send(supportError(sessionValidation.error.code, sessionValidation.error.message, {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: [sessionValidation.error.code],
            }),
        }))
    }

    const duplicate = await loadSupportSuccessfulIdempotencyReceipt({
        eventType: 'support.organization.member_role_recovery',
        organizationId: organization.id,
        subjectId: req.params.userId,
        idempotencyKey: executorControls.idempotencyKey,
    })
    if (duplicate) {
        const snapshot = membershipSnapshot(member)
        return res.send({
            memberRoleRecovery: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId: duplicate.request_id,
                actorId: actor.id,
                organization: toOrganization(organization),
                member: toSupportMemberDetail(member),
                before: snapshot,
                after: snapshot,
                requestedRole: input.role,
                reason,
                outcome: 'success',
                idempotentReplay: true,
                blockers: ['duplicate_idempotency_key'],
                auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                noSilentMembershipMutation: true,
                controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                    actorId: actor.id,
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId: duplicate.request_id,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before: snapshot,
                    after: snapshot,
                    outcome: 'success',
                    blockers: ['duplicate_idempotency_key'],
                    auditEventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                }),
                audit: {
                    actionType,
                    source: 'admin',
                    service: 'hanasand-api',
                    outcome: 'success',
                    severity: input.role === 'admin' || snapshot.role === 'owner' ? 'warning' : 'notice',
                    eventIds: [Number(duplicate.id)].filter(id => Number.isFinite(id)),
                    query: supportMemberRoleRecoveryAuditQuery({
                        requestId: duplicate.request_id,
                        organizationId: organization.id,
                        userId: req.params.userId,
                        correlationId: executorControls.correlationId,
                        idempotencyKey: executorControls.idempotencyKey,
                        reason,
                        outcome: 'success',
                    }),
                },
            },
        })
    }

    if (member.status !== 'active') {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: 'revoked_member',
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(409).send(supportError('revoked_member', 'Support role recovery requires an active organization member; inspect removed membership state first.', {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: ['revoked_member'],
            }),
        }))
    }

    const availability = await loadOrganizationAvailability([organization.id])
    if (availability[0]?.hasAvailableAdmin === true) {
        const snapshot = membershipSnapshot(member)
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker: 'active_admin_available',
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: snapshot,
        })
        return res.status(409).send(supportError('active_admin_available', 'An active organization admin is available; support member role recovery requires unavailable org administration.', {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member,
                before: snapshot,
                after: snapshot,
                outcome: 'denied',
                blockers: ['active_admin_available'],
            }),
        }))
    }

    const before = membershipSnapshot(member)
    const ownerCount = await activeOwnerCount(req.params.id)
    const roleDecision = supportRoleRecoveryDecision(String(member.role) as OrganizationRole, input.role, ownerCount)
    if (roleDecision.kind !== 'allowed') {
        const permissionError = roleDecision.kind === 'denied' ? roleDecision.message : ''
        const error = permissionError || 'member_role_already_set'
        await recordSystemEvent(req, {
            actionType,
            actorId: actor.id,
            targetType: 'member',
            targetId: req.params.userId,
            organizationId: organization.id,
            entityId: req.params.userId,
            requestId,
            severity: 'notice',
            outcome: permissionError ? 'denied' : 'failed',
            reason,
            context: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId,
                targetUserId: req.params.userId,
                requestedRole: input.role,
                ownerCount,
                before,
                after: before,
                correlationId: executorControls.correlationId,
                idempotencyKey: executorControls.idempotencyKey,
                supportSessionId: executorControls.supportSessionId || null,
                scope: executorControls.scope,
                handoffExpiresAt: executorControls.handoffExpiresAt,
                executor: supportMemberRoleRecoveryExecutorDetail({
                    actorId: actor.id,
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before,
                    after: before,
                    outcome: permissionError ? 'denied' : 'failed',
                    blockers: [error],
                }),
                noSilentMembershipMutation: true,
                mutation: 'none',
                error,
                supportContext: cleanContext(req.body?.context),
            },
        })
        const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: req.params.userId })
        return res.status(permissionError ? 403 : 409).send({
            error: permissionError || 'Member already has the requested role.',
            memberRoleRecovery: {
                schemaVersion: 'support.member_role_recovery.v1',
                requestId,
                actorId: actor.id,
                organization: toOrganization(organization),
                member: toSupportMemberDetail(member),
                before,
                after: before,
                requestedRole: input.role,
                outcome: permissionError ? 'denied' : 'failed',
                auditEventIds,
                noSilentMembershipMutation: true,
                controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                    actorId: actor.id,
                    organizationId: organization.id,
                    userId: req.params.userId,
                    requestId,
                    reason,
                    requestedRole: input.role,
                    controls: executorControls,
                    member,
                    before,
                    after: before,
                    outcome: permissionError ? 'denied' : 'failed',
                    blockers: [error],
                    auditEventIds,
                }),
            },
        })
    }

    const mutation = await withTransaction(async query => {
        await query(`
            SELECT users.id
            FROM users
            WHERE users.id = ANY($1::text[])
               OR EXISTS (
                    SELECT 1
                    FROM organization_members membership
                    WHERE membership.organization_id = $2
                      AND membership.user_id = users.id
                      AND membership.status = 'active'
                      AND membership.role IN ('owner', 'admin')
                )
            ORDER BY users.id
            FOR UPDATE
        `, [[actor.id, req.params.userId].sort(), organization.id])
        await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organization.id])
        if (await hasOrganizationPrivacyDeletionMarker(organization.id, query)) return { error: 'organization_deletion_in_progress' as const }

        const currentMember = await loadSupportMemberDetail(organization.id, req.params.userId, query, true)
        if (!currentMember) return { error: 'member_not_found' as const }
        if (currentMember.status !== 'active') return { error: 'revoked_member' as const, member: currentMember }
        const currentAvailability = await loadOrganizationAvailability([organization.id], query)
        if (currentAvailability[0]?.hasAvailableAdmin === true) return { error: 'active_admin_available' as const, member: currentMember }

        const currentOwnerCount = await activeOwnerCount(organization.id, query)
        const currentRoleDecision = supportRoleRecoveryDecision(String(currentMember.role) as OrganizationRole, input.role, currentOwnerCount)
        if (currentRoleDecision.kind === 'denied') return { error: 'permission_denied' as const, member: currentMember, ownerCount: currentOwnerCount, message: currentRoleDecision.message }
        if (currentRoleDecision.kind === 'unchanged') return { error: 'member_role_already_set' as const, member: currentMember, ownerCount: currentOwnerCount }

        const updatedMember = await updateActiveOrganizationMemberRole({
            organizationId: organization.id,
            userId: req.params.userId,
            role: input.role,
        }, query)
        if (!updatedMember) return { error: 'member_not_found' as const }
        return { error: null, member: currentMember, ownerCount: currentOwnerCount, updatedMember }
    })
    if (mutation.error) {
        if (mutation.error === 'member_not_found') return res.status(404).send({ error: 'Active organization member not found.' })
        const currentMember = ('member' in mutation && mutation.member) || member
        const currentSnapshot = membershipSnapshot(currentMember)
        const blocker = mutation.error === 'permission_denied' ? mutation.message : mutation.error
        const status = mutation.error === 'permission_denied' ? 403 : 409
        await recordSupportMemberRoleRecoveryExecutorBlock(req, {
            actorId: actor.id,
            organizationId: organization.id,
            userId: req.params.userId,
            requestId,
            reason,
            blocker,
            requestedRole: input.role,
            controls: executorControls,
            supportContext: cleanContext(req.body?.context),
            before: currentSnapshot,
        })
        const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: req.params.userId })
        return res.status(status).send(supportError(blocker, mutation.error === 'permission_denied' ? mutation.message : 'Member role recovery is no longer permitted in the current organization state.', {
            executorBlocker: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member: currentMember,
                before: currentSnapshot,
                after: currentSnapshot,
                outcome: 'denied',
                blockers: [blocker],
                auditEventIds,
            }),
        }))
    }
    const updated = mutation.updatedMember
    if (!updated) {
        return res.status(404).send({ error: 'Active organization member not found.' })
    }
    const currentMember = mutation.member
    const currentOwnerCount = mutation.ownerCount
    const currentBefore = membershipSnapshot(currentMember)
    const updatedMember = {
        ...currentMember,
        ...(updated as Record<string, unknown>),
    }
    const after = membershipSnapshot(updatedMember)

    await recordSystemEvent(req, {
        actionType,
        actorId: actor.id,
        targetType: 'member',
        targetId: req.params.userId,
        organizationId: organization.id,
        entityId: req.params.userId,
        requestId,
        severity: input.role === 'admin' || currentBefore.role === 'owner' ? 'warning' : 'notice',
        outcome: 'success',
        reason,
        context: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId,
            targetUserId: req.params.userId,
            previousRole: currentBefore.role,
            newRole: after.role,
            ownerCount: currentOwnerCount,
            before: currentBefore,
            after,
            correlationId: executorControls.correlationId,
            idempotencyKey: executorControls.idempotencyKey,
            supportSessionId: executorControls.supportSessionId || null,
            scope: executorControls.scope,
            handoffExpiresAt: executorControls.handoffExpiresAt,
            executor: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member: updatedMember as Record<string, unknown>,
                before: currentBefore,
                after,
                outcome: 'success',
                blockers: [],
            }),
            noSilentMembershipMutation: true,
            mutation: 'member_role_only',
            supportContext: cleanContext(req.body?.context),
        },
    })
    const auditEventIds = await loadSystemEventIds({ requestId, actionType, entityId: req.params.userId })

    return res.send({
        memberRoleRecovery: {
            schemaVersion: 'support.member_role_recovery.v1',
            requestId,
            actorId: actor.id,
            organization: toOrganization(organization),
            member: toSupportMemberDetail(updatedMember),
            before: currentBefore,
            after,
            reason,
            outcome: 'success',
            idempotencyKey: executorControls.idempotencyKey,
            correlationId: executorControls.correlationId,
            auditEventIds,
            noSilentMembershipMutation: true,
            controlledExecutor: supportMemberRoleRecoveryExecutorDetail({
                actorId: actor.id,
                organizationId: organization.id,
                userId: req.params.userId,
                requestId,
                reason,
                requestedRole: input.role,
                controls: executorControls,
                member: updatedMember as Record<string, unknown>,
                before: currentBefore,
                after,
                outcome: 'success',
                blockers: [],
                auditEventIds,
            }),
            audit: {
                actionType,
                source: 'admin',
                service: 'hanasand-api',
                outcome: 'success',
                severity: input.role === 'admin' || currentBefore.role === 'owner' ? 'warning' : 'notice',
                eventIds: auditEventIds,
                query: supportMemberRoleRecoveryAuditQuery({
                    requestId,
                    organizationId: organization.id,
                    userId: req.params.userId,
                    correlationId: executorControls.correlationId,
                    idempotencyKey: executorControls.idempotencyKey,
                    reason,
                    outcome: 'success',
                }),
            },
            copyText: [
                `Support member role recovery for ${req.params.userId}`,
                `Org: ${organization.name} (${organization.id})`,
                `Role: ${currentBefore.role} -> ${after.role}`,
                `Request: ${requestId}`,
                `Idempotency: ${executorControls.idempotencyKey}`,
                `Audit events: ${auditEventIds.join(', ') || 'pending index refresh'}`,
                `Reason: ${reason}`,
            ].join('\n'),
        },
    })
}

export async function getSupportAccessRecoveryApprovals(req: FastifyRequest<{ Querystring: AccessRecoveryApprovalQuery }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as AccessRecoveryApprovalQuery
    const where: string[] = []
    const values: Array<string | number | Date | null> = []
    const add = (value: string | number | Date | null) => {
        values.push(value)
        return `$${values.length}`
    }

    const request = text(query.request || query.requestId)
    const org = text(query.org || query.orgId)
    const status = normalizeApprovalStatus(query.status)
    const outcome = normalizeOption(query.outcome, ['success', 'denied', 'failed'])
    const requester = text(query.requester || query.requestedBy)
    const approver = text(query.approver || query.approvedBy)
    const from = text(query.from)
    const to = text(query.to)
    const parsedLimit = Number(query.limit || 100)
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 250) : 100

    if (request) where.push(`approval.request_id ILIKE ${add(`%${request}%`)}`)
    if (org) {
        const placeholder = add(`%${org}%`)
        where.push('(approval.organization_id ILIKE ' + placeholder + ' OR organization.name ILIKE ' + placeholder + ' OR organization.slug ILIKE ' + placeholder + ')')
    }
    if (status) where.push(`approval.status = ${add(status)}`)
    if (outcome) where.push(`approval.outcome = ${add(outcome)}`)
    if (requester) where.push(`approval.requested_by ILIKE ${add(`%${requester}%`)}`)
    if (approver) {
        const placeholder = add(`%${approver}%`)
        where.push('(approval.approved_by ILIKE ' + placeholder + ' OR approval.denied_by ILIKE ' + placeholder + ')')
    }
    if (from && !Number.isNaN(Date.parse(from))) where.push(`approval.created_at >= ${add(new Date(from).toISOString())}`)
    if (to && !Number.isNaN(Date.parse(to))) where.push(`approval.created_at <= ${add(new Date(to).toISOString())}`)

    const result = await run(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', event.id,
                    'actionType', event.event_type,
                    'outcome', event.outcome,
                    'severity', event.severity,
                    'createdAt', event.created_at
                ) ORDER BY event.created_at ASC)
                FROM system_events event
                WHERE event.request_id = approval.request_id
                  AND event.event_type ILIKE 'support.organization.access_recovery%'
            ), '[]'::jsonb) AS audit_events
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY approval.updated_at DESC, approval.created_at DESC
        LIMIT ${add(limit)}
    `, values)

    const approvals = (result.rows as AccessRecoveryApprovalRow[]).map(toAccessRecoveryDecision)
    const filters = { request, org, status, outcome, requester, approver, from, to, limit }
    const approvalTimeline = supportAccessRecoveryApprovalTimeline(filters, approvals)
    return res.send({
        approvals,
        filters,
        detail: {
            schemaVersion: 'support.access_recovery.approval_search.v1',
            generatedAt: new Date().toISOString(),
            filters,
            approvalTimeline,
            copyText: approvals.slice(0, 20).map(approval => approval.copyText).join('\n\n'),
        },
    })
}

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
    await run('UPDATE organizations SET updated_at = NOW() WHERE id = $1', [organization.id])

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

async function requireWritableSupportOrganization(organizationId: string, res: FastifyReply) {
    const organization = await loadOrganizationSupportDetail(organizationId)
    if (!organization) {
        res.status(404).send({ error: 'Organization not found.' })
        return null
    }
    if (organizationPrivacyDeletionInProgress(organization)) {
        res.status(409).send({ error: 'Organization deletion is in progress; support writes are blocked.' })
        return null
    }
    return organization
}























async function loadSystemEventRelatedTimeline(event: Record<string, any>, supportSessionId = '') {
    const detail = event.detail || {}
    const eventId = Number(event.id)
    const requestId = text(detail.requestId)
    const entityId = text(detail.entityId)
    const values: Array<string | number> = [eventId]
    const where = ['e.id = $1']
    const add = (value: string | number) => {
        values.push(value)
        return `$${values.length}`
    }
    if (requestId) where.push(`e.request_id = ${add(requestId)}`)
    if (entityId) where.push(`e.subject_id = ${add(entityId)}`)
    if (supportSessionId) {
        const placeholder = add(supportSessionId)
        where.push(`(e.subject_id = ${placeholder} OR e.context->>'supportSessionId' = ${placeholder})`)
    }

    const result = await run(`
        ${SUPPORT_AUDIT_TIMELINE_SELECT}
        WHERE ${where.join('\n           OR ')}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 50
    `, values)
    return result.rows.map(toSystemEvent).map(row => row.detail.timelineEvent)
}

async function validateSupportSessionForAction(input: {
    actorId: string
    supportSessionId?: string | null
    action: string
    requiredScope: string
    organizationId: string
    targetUserId?: string | null
}) {
    if (!input.supportSessionId) {
        return { state: null, error: null as { code: string, message: string, status: number } | null }
    }

    const state = await loadSupportSessionState(input.supportSessionId)
    if (!state) {
        return { state: null, error: { code: 'support_session_not_found', message: 'Support session not found.', status: 404 } }
    }
    if (state.status === 'revoked') {
        return { state, error: { code: 'support_session_revoked', message: 'Support session has been revoked.', status: 409 } }
    }
    if (state.status === 'expired') {
        return { state, error: { code: 'support_session_expired', message: 'Support session has expired.', status: 409 } }
    }
    if (state.actorId && state.actorId !== input.actorId) {
        return { state, error: { code: 'support_session_actor_mismatch', message: 'Support session belongs to a different support actor.', status: 403 } }
    }
    if (state.organizationId && state.organizationId !== input.organizationId) {
        return { state, error: { code: 'support_session_org_mismatch', message: 'Support session is not scoped to this organization.', status: 403 } }
    }
    if (state.targetUserId && input.targetUserId && state.targetUserId !== input.targetUserId) {
        return { state, error: { code: 'support_session_user_mismatch', message: 'Support session is not scoped to this target user.', status: 403 } }
    }
    if (!state.allowedActions.includes(input.action)) {
        return { state, error: { code: 'support_session_action_denied', message: 'Support session does not allow this support action.', status: 403 } }
    }
    if (!state.scope.includes(input.requiredScope)) {
        return { state, error: { code: 'support_session_scope_denied', message: 'Support session does not include the required action scope.', status: 403 } }
    }
    return { state, error: null }
}



type SupportIdempotencyReceipt = {
    id: number
    request_id: string
    subject_id: string | null
    context: Record<string, unknown>
}

async function loadSupportSuccessfulIdempotencyReceipt(input: {
    eventType: string
    organizationId: string
    subjectId?: string
    idempotencyKey: string
}) {
    const result = await run(`
        SELECT id, request_id, subject_id, context
        FROM system_events
        WHERE event_type = $1
          AND organization_id = $2
          AND ($3::text IS NULL OR subject_id = $3)
          AND outcome = 'success'
          AND context->>'idempotencyKey' = $4
        ORDER BY created_at ASC, id ASC
        LIMIT 1
    `, [input.eventType, input.organizationId, input.subjectId ?? null, input.idempotencyKey])
    return result.rows[0] as SupportIdempotencyReceipt | undefined
}

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

function supportRoleRecoveryDecision(currentRole: OrganizationRole, newRole: OrganizationRole, ownerCount: number) {
    if (newRole === 'owner') return { kind: 'denied' as const, message: 'Support role recovery cannot grant organization owner.' }
    if (!['owner', 'admin', 'editor', 'reader', 'member', 'viewer'].includes(currentRole)) {
        return { kind: 'denied' as const, message: 'Unsupported current member role.' }
    }
    if (currentRole === 'owner' && ownerCount <= 1) {
        return { kind: 'denied' as const, message: 'Support role recovery cannot demote the last active owner.' }
    }
    if (currentRole === newRole) return { kind: 'unchanged' as const }
    return { kind: 'allowed' as const }
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

function supportActionPreparationInput(query: SupportInspectionQuery, action: string): { value: SupportActionPreparationInput | null, error: Record<string, unknown> | null } {
    if (!query.prepareAction) {
        return { value: null, error: null }
    }
    if (!action) {
        return {
            value: null,
            error: supportError('unsupported_support_action', 'Unsupported support action prepare request.', {
                supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            }),
        }
    }

    let reason: string
    try {
        reason = requireAuditReason(query.reason, 'Support action preparation reason')
    } catch (error) {
        return {
            value: null,
            error: supportError('missing_support_reason', error instanceof Error ? error.message : 'Support action preparation reason is required.'),
        }
    }

    const scopeResult = normalizeSupportPreparationScope(query.scope, action)
    if (scopeResult.error) return { value: null, error: scopeResult.error }
    const durationResult = normalizeSupportPreparationDuration(query.durationMinutes ?? query.duration_minutes, action)
    if (durationResult.error) return { value: null, error: durationResult.error }
    const expiryResult = normalizeSupportPreparationExpiry(query.expiresAt ?? query.expires_at)
    if (expiryResult.error) return { value: null, error: expiryResult.error }
    const idempotencyKey = supportActionIdempotencyKey(query.idempotencyKey || query.idempotency_key, action)

    return {
        value: {
            action: action as SupportActionPreparationInput['action'],
            reason,
            context: cleanContext(query.context),
            scope: scopeResult.value,
            supportSessionId: text(query.session || query.supportSession || query.supportSessionId),
            idempotencyKey,
            durationMinutes: durationResult.value,
            expiresAt: expiryResult.value,
        },
        error: null,
    }
}

function supportActionIdempotencyKey(value: unknown, action: string) {
    const cleaned = text(value).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 120)
    return cleaned || `support-${action}-${randomUUID()}`
}

type SupportExecutorControlsBody = {
    idempotencyKey?: unknown
    idempotency_key?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    scope?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}

type SupportExecutorControls = {
    schemaVersion: string
    requestId: string
    correlationId: string
    idempotencyKey: string
    supportSessionId: string
    scope: string[]
    handoffExpiresAt: string | null
    staleBlocker: string
    duplicateBlocker: string
}

type SupportExecutorControlsResult = {
    value: SupportExecutorControls
    error: { code: string, message: string, status: number } | null
}

function supportExecutorMetadata(requestId: string, controls: SupportExecutorControls, expiryRequired?: boolean) {
    return {
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        ...(expiryRequired !== undefined ? { expiryRequired } : {}),
        noSilentMembershipMutation: true,
        requestId,
        correlationId: controls.correlationId,
        idempotencyKey: controls.idempotencyKey,
        supportSessionId: controls.supportSessionId || null,
        staleBlocker: controls.staleBlocker,
        duplicateBlocker: controls.duplicateBlocker,
    }
}

function supportExecutorControls(input: {
    req: FastifyRequest
    body: SupportExecutorControlsBody | undefined
    requestId: string
    idempotencyAction: string
    scopeAction: string
    requiredScope: string
    invalidScopeMessage: string
    invalidExpiryMessage: string
    expiredHandoffMessage: string
}): SupportExecutorControlsResult {
    const { req, body, requestId } = input
    const idempotencyKey = supportActionIdempotencyKey(
        headerText(req.headers['x-idempotency-key']) || body?.idempotencyKey || body?.idempotency_key || requestId,
        input.idempotencyAction,
    )
    const correlationId = text(headerText(req.headers['x-correlation-id']) || body?.correlationId || body?.correlation_id || requestId) || requestId
    const supportSessionId = supportSessionIdFromRequest(req, body)
    const scopeResult = normalizeSupportPreparationScope(body?.scope || input.requiredScope, input.scopeAction)
    const base: SupportExecutorControls = {
        schemaVersion: 'support.action_execute.controls.v1',
        requestId,
        correlationId,
        idempotencyKey,
        supportSessionId,
        scope: scopeResult.value,
        handoffExpiresAt: null,
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    }
    if (scopeResult.error || !scopeResult.value.includes(input.requiredScope)) {
        return { value: base, error: { code: 'invalid_scope', message: input.invalidScopeMessage, status: 400 } }
    }

    const handoffExpiresAt = text(headerText(req.headers['x-support-handoff-expires-at']) || body?.handoffExpiresAt || body?.handoff_expires_at)
    if (!handoffExpiresAt) {
        return { value: base, error: null }
    }
    const timestamp = Date.parse(handoffExpiresAt)
    if (Number.isNaN(timestamp)) {
        return { value: base, error: { code: 'invalid_expiry', message: input.invalidExpiryMessage, status: 400 } }
    }
    const value = { ...base, handoffExpiresAt: new Date(timestamp).toISOString() }
    if (timestamp <= Date.now()) {
        return { value, error: { code: 'stale_prepare_payload', message: input.expiredHandoffMessage, status: 409 } }
    }
    return { value, error: null }
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

async function recordSupportExecutorBlock(req: FastifyRequest, input: {
    actionType: string
    action: string
    actorId: string
    targetType: string
    targetId: string
    entityId: string
    organizationId: string
    requestId: string
    reason: string
    severity: 'notice' | 'warning'
    blocker: string
    controls: SupportExecutorControls
    supportContext: string
    actionContext: Record<string, unknown>
}) {
    await recordSystemEvent(req, {
        actionType: input.actionType,
        actorId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        organizationId: input.organizationId,
        entityId: input.entityId,
        requestId: input.requestId,
        severity: input.severity,
        outcome: 'denied',
        reason: input.reason,
        context: {
            schemaVersion: 'support.action_executor_blocker.v1',
            action: input.action,
            blocker: input.blocker,
            blockerCode: input.blocker,
            requestId: input.requestId,
            correlationId: input.controls.correlationId,
            idempotencyKey: input.controls.idempotencyKey,
            supportSessionId: input.controls.supportSessionId || null,
            targetOrganizationId: input.organizationId,
            ...input.actionContext,
            scope: input.controls.scope,
            handoffExpiresAt: input.controls.handoffExpiresAt,
            noSilentMembershipMutation: true,
            mutation: 'none',
            redactionRequired: true,
            supportContext: input.supportContext,
        },
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

type SupportExecutorAuditPreviewTargetFields =
    | { emails: string[], inviteIds: string[], expiresAt: string }
    | { inviteId: string | null, email: string | null }
    | { targetUserId: string, requestedRole: string }

const supportExecutorCommonBlockerCatalog = [
    'support_role_required',
    'missing_support_reason',
    'stale_prepare_payload',
    'duplicate_idempotency_key',
] as const

function supportExecutorAuditPreview(input: {
    actionType: string
    requestId: string
    organizationId: string
    reason: string
    controls: SupportExecutorControls
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    targetFields: SupportExecutorAuditPreviewTargetFields
}) {
    return redactAuditValue({
        schemaVersion: 'support.action_execute.audit_preview.v1',
        actionType: input.actionType,
        source: 'admin',
        service: 'hanasand-api',
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        organizationId: input.organizationId,
        ...input.targetFields,
        reason: input.reason,
        scope: input.controls.scope,
        outcome: input.outcome,
        blockerCode: input.blockers[0] || null,
        redactionRequired: true,
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

function supportExecutorAuditQuery(input: {
    requestId: string
    organizationId: string
    entityId?: string
    targetId?: string
    correlationId: string
    idempotencyKey: string
    reason: string
    actionType: string
    outcome: string
}) {
    const params = new URLSearchParams()
    params.set('request', input.requestId)
    params.set('correlation', input.correlationId)
    params.set('idempotency', input.idempotencyKey)
    params.set('org', input.organizationId)
    if (input.entityId !== undefined) params.set('entity', input.entityId)
    if (input.targetId !== undefined) params.set('target', input.targetId)
    params.set('reason', input.reason)
    params.set('action', input.actionType)
    params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    return `/api/admin/audit-events?${params.toString()}`
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

export function supportInviteActionExecutorControls(
    req: FastifyRequest,
    body: SupportInviteActionBody | undefined,
    requestId: string,
    action: 'revoke' | 'resend',
): SupportExecutorControlsResult {
    const requiredScope = action === 'revoke' ? 'invite:revoke' : 'invite:resend'
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: `invite_${action}`,
        scopeAction: 'invite_assist',
        requiredScope,
        invalidScopeMessage: `Invite ${action} execution requires ${requiredScope} scope.`,
        invalidExpiryMessage: `Support invite ${action} handoff expiry must be a valid timestamp.`,
        expiredHandoffMessage: `Support invite ${action} handoff has expired; prepare a fresh action before executing.`,
    })
}

async function recordSupportInviteActionExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    inviteId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    blocker: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    supportContext: string
}) {
    return recordSupportExecutorBlock(req, {
        actionType: input.actionType,
        action: input.action,
        actorId: input.actorId,
        targetType: 'invite',
        targetId: input.inviteId,
        entityId: input.inviteId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: { inviteId: input.inviteId },
    })
}

function supportInviteActionExecutorDetail(input: {
    organizationId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    invite: OrganizationInviteRow | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_action.v1',
        mutationMode: 'controlled_invite_row_only',
        action: input.action,
        actionType: input.actionType,
        ...supportExecutorMetadata(input.requestId, input.controls, input.action === 'resend'),
        target: {
            organizationId: input.organizationId,
            inviteId: input.invite?.id || null,
            email: input.invite?.email || null,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
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
            'accepted_invite_not_mutable_by_support_action',
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            actionType: input.actionType,
            targetFields: { inviteId: input.invite?.id || null, email: input.invite?.email || null },
        }),
    }
}

function supportInviteActionExecutionReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    invite: OrganizationInviteRow | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const inviteId = input.invite?.id || ''
    const inviteTarget = input.invite?.email || inviteId || input.organizationId
    const denialReceipt = input.outcome === 'success'
        ? null
        : supportInviteRecoveryDenialReceipt({
            actorId: input.actorId,
            organizationId: input.organizationId,
            requestId: input.requestId,
            action: input.action,
            actionType: input.actionType,
            reason: input.reason,
            controls: input.controls,
            invite: input.invite,
            outcome: input.outcome,
            auditEventIds: input.auditEventIds,
            blockers: input.blockers,
        })
    return {
        schemaVersion: 'support.invite_action.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: 'controlled_invite_row_only',
        action: input.action,
        actionType: input.actionType,
        outcome: input.outcome,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'invite',
        targetId: inviteTarget,
        entityId: inviteId || input.organizationId,
        inviteId: inviteId || null,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        before: input.before,
        after: input.after,
        auditEventIds: input.auditEventIds,
        denialReceipt,
        recoveryCaseReplay: denialReceipt?.caseReplay || null,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: supportInviteActionAuditQuery({
                requestId: input.requestId,
                organizationId: input.organizationId,
                inviteId,
                correlationId: input.controls.correlationId,
                idempotencyKey: input.controls.idempotencyKey,
                reason: input.reason,
                actionType: input.actionType,
                outcome: input.outcome,
            }),
            byTargetType: auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId }),
            deniedReplay: auditFilterQuery({ targetType: 'invite', entity: inviteId, action: input.actionType, outcome: 'denied' }),
        },
        blockers: input.blockers,
        copyText: [
            `Support invite ${input.action} receipt ${inviteId || 'unresolved invite'}`,
            `Request: ${input.requestId}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ targetType: 'invite', entity: inviteId, request: input.requestId })}`,
        ].join('\n'),
    }
}

function supportInviteRecoveryDenialReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    action: 'revoke' | 'resend'
    actionType: string
    reason: string
    controls: ReturnType<typeof supportInviteActionExecutorControls>['value']
    invite: OrganizationInviteRow | null
    outcome: 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const inviteId = input.invite?.id || ''
    const targetEmail = input.invite?.email || null
    const primaryBlocker = input.blockers[0] || (input.outcome === 'denied' ? 'support_invite_action_denied' : 'support_invite_action_failed')
    const replayFilters = {
        byRequest: auditFilterQuery({ request: input.requestId, outcome: input.outcome }),
        byOrganization: auditFilterQuery({ org: input.organizationId, outcome: input.outcome }),
        byInvite: auditFilterQuery({ targetType: 'invite', entity: inviteId, outcome: input.outcome }),
        byAction: auditFilterQuery({ action: input.actionType, outcome: input.outcome }),
        bySupportSession: input.controls.supportSessionId
            ? auditFilterQuery({ supportSession: input.controls.supportSessionId, outcome: input.outcome })
            : null,
        byIdempotency: auditFilterQuery({ idempotency: input.controls.idempotencyKey, outcome: input.outcome }),
    }
    return {
        schemaVersion: 'support.invite_recovery.denial_receipt.v1',
        generatedAt: new Date().toISOString(),
        action: input.action,
        actionType: input.actionType,
        outcome: input.outcome,
        severity: input.action === 'revoke' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: 'invite',
        targetId: targetEmail || inviteId || input.organizationId,
        entityId: inviteId || input.organizationId,
        inviteId: inviteId || null,
        targetEmail,
        requestId: input.requestId,
        reason: input.reason,
        scope: input.controls.scope,
        supportSessionId: input.controls.supportSessionId || null,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        staleBlocker: input.controls.staleBlocker,
        duplicateBlocker: input.controls.duplicateBlocker,
        blockerCode: primaryBlocker,
        blockers: input.blockers,
        blockerCatalog: [
            'support_role_required',
            'missing_support_reason',
            'missing_support_context',
            'invalid_scope',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'accepted_invite_not_mutable_by_support_action',
            'audit_unavailable',
            'redaction_required',
        ],
        safety: {
            supportOnly: true,
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        replayFilters,
        auditEventIds: input.auditEventIds,
        auditDetailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        caseReplay: {
            schemaVersion: 'support.invite_recovery.case_replay.v1',
            route: '/api/admin/support/receipt-replay',
            requestId: input.requestId,
            organizationId: input.organizationId,
            inviteId: inviteId || null,
            action: input.action,
            outcome: input.outcome,
            blockerCode: primaryBlocker,
            filters: replayFilters,
            nextRoutes: [
                `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
                `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(inviteId || ':inviteId')}/action`,
            ],
        },
        orgReadiness: {
            schemaVersion: 'support.invite_recovery.org_readiness.v1',
            organizationId: input.organizationId,
            inviteId: inviteId || null,
            recoveryBlocked: true,
            blockerCode: primaryBlocker,
            requiresOrgAdminUnavailable: true,
            requiresFreshSupportSession: true,
            requiresReason: true,
            auditReplayAvailable: input.auditEventIds.length > 0,
        },
        copyText: [
            `Support invite recovery ${input.outcome}`,
            `Request: ${input.requestId}`,
            `Blocker: ${primaryBlocker}`,
            `Replay: ${replayFilters.byRequest}`,
        ].join('\n'),
    }
}

function supportInviteActionAuditQuery(input: {
    requestId: string
    organizationId: string
    inviteId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    actionType: string
    outcome: string
}) {
    return supportExecutorAuditQuery({ ...input, entityId: input.inviteId })
}

export function supportMemberRoleRecoveryExecutorControls(
    req: FastifyRequest,
    body: SupportMemberRoleRecoveryBody | undefined,
    requestId: string,
): SupportExecutorControlsResult {
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: 'member_role_recovery',
        scopeAction: 'member_role_recovery',
        requiredScope: 'member:role_recovery',
        invalidScopeMessage: 'Member role recovery execution requires member:role_recovery scope.',
        invalidExpiryMessage: 'Member role recovery handoff expiry must be a valid timestamp.',
        expiredHandoffMessage: 'Member role recovery handoff has expired; prepare a fresh action before executing.',
    })
}

async function recordSupportMemberRoleRecoveryExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    blocker: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    supportContext: string
    before?: Record<string, unknown> | null
}) {
    return recordSupportExecutorBlock(req, {
        actionType: 'support.organization.member_role_recovery',
        action: 'member_role_recovery',
        actorId: input.actorId,
        targetType: 'member',
        targetId: input.userId,
        entityId: input.userId,
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: input.requestedRole === 'admin' ? 'warning' : 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: {
            targetUserId: input.userId,
            requestedRole: input.requestedRole,
            before: input.before || null,
        },
    })
}

function supportMemberRoleRecoveryExecutorDetail(input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    member: Record<string, unknown> | null
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    auditEventIds?: number[]
}) {
    const auditEventIds = Array.isArray(input.auditEventIds) ? input.auditEventIds.filter(id => Number.isFinite(id)) : []
    return {
        schemaVersion: 'support.action_execute.member_role_recovery.v1',
        mutationMode: 'controlled_member_role_only',
        action: 'member_role_recovery',
        actionType: 'support.organization.member_role_recovery',
        ...supportExecutorMetadata(input.requestId, input.controls),
        target: {
            organizationId: input.organizationId,
            userId: input.userId,
            currentRole: input.before?.role || input.member?.role || null,
            requestedRole: input.requestedRole,
        },
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        before: input.before,
        after: input.after,
        outcome: input.outcome,
        blockers: input.blockers,
        auditEventIds,
        memberRecoveryHandoff: supportMemberRecoveryHandoffReceipt({
            actorId: input.actorId,
            organizationId: input.organizationId,
            userId: input.userId,
            requestId: input.requestId,
            reason: input.reason,
            requestedRole: input.requestedRole,
            controls: input.controls,
            before: input.before,
            after: input.after,
            outcome: input.outcome,
            blockers: input.blockers,
            auditEventIds,
        }),
        blockerCatalog: [
            ...supportExecutorCommonBlockerCatalog,
            'invalid_scope',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'revoked_member',
            'member_role_already_set',
            'last_owner_demote_denied',
            'owner_grant_denied',
            'audit_unavailable',
            'redaction_required',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            actionType: 'support.organization.member_role_recovery',
            targetFields: { targetUserId: input.userId, requestedRole: input.requestedRole },
        }),
    }
}

function supportMemberRecoveryHandoffReceipt(input: {
    actorId: string
    organizationId: string
    userId: string
    requestId: string
    reason: string
    requestedRole: string
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
    outcome: 'success' | 'denied' | 'failed'
    blockers: string[]
    auditEventIds: number[]
}) {
    const currentRole = text(input.before?.role)
    const nextRole = text(input.after?.role) || currentRole || null
    const auditQuery = supportMemberRoleRecoveryAuditQuery({
        requestId: input.requestId,
        organizationId: input.organizationId,
        userId: input.userId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        reason: input.reason,
        outcome: input.outcome,
    })
    return {
        schemaVersion: 'support.member_recovery.handoff_receipt.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_member_role_only' : 'none',
        action: 'member_role_recovery',
        actionType: 'support.organization.member_role_recovery',
        actorId: input.actorId,
        actorRequired: true,
        target: {
            organizationId: input.organizationId,
            userId: input.userId,
            entityType: 'member',
            entityId: input.userId,
            currentRole: currentRole || null,
            requestedRole: input.requestedRole,
            resultingRole: nextRole,
        },
        requestId: input.requestId,
        correlationId: input.controls.correlationId,
        idempotencyKey: input.controls.idempotencyKey,
        supportSessionId: input.controls.supportSessionId || null,
        scope: input.controls.scope,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        reason: input.reason,
        outcome: input.outcome,
        auditEventIds: input.auditEventIds,
        expectedAuditEventLookup: auditQuery,
        replayFilters: {
            current: auditQuery,
            byRequest: auditFilterQuery({ request: input.requestId, action: 'support.organization.member_role_recovery', outcome: input.outcome }),
            byEntity: auditFilterQuery({ org: input.organizationId, entity: input.userId, entityType: 'member', action: 'support.organization.member_role_recovery' }),
            byTarget: auditFilterQuery({ org: input.organizationId, target: input.userId, targetType: 'member', action: 'support.organization.member_role_recovery' }),
            byOutcome: auditFilterQuery({ org: input.organizationId, outcome: input.outcome, action: 'support.organization.member_role_recovery' }),
            bySupportSession: input.controls.supportSessionId ? auditFilterQuery({ supportSession: input.controls.supportSessionId, action: 'support.organization.member_role_recovery' }) : null,
            denied: auditFilterQuery({ org: input.organizationId, target: input.userId, action: 'support.organization.member_role_recovery', outcome: 'denied' }),
            staleOrDuplicate: auditFilterQuery({ org: input.organizationId, target: input.userId, action: 'support.organization.member_role_recovery', outcome: input.outcome, request: input.requestId }),
        },
        orgMemberRecoveryReadiness: {
            schemaVersion: 'support.member_recovery.readiness.v1',
            consumedExecutorSchema: 'support.action_execute.member_role_recovery.v1',
            requiredScope: 'member:role_recovery',
            requiredSessionState: 'active',
            controlledMutation: 'organization_members.role',
            blockedWhenAdminAvailable: true,
            blockedForOwnerGrant: true,
            blockedForLastOwnerDemotion: true,
            noCrossOrgRecovery: true,
            noSilentMembershipMutation: true,
            requiredAuditFields: ['actorId', 'targetId', 'organizationId', 'entityId', 'requestId', 'reason', 'outcome', 'severity', 'supportSessionId', 'idempotencyKey'],
        },
        receiptSchemas: [
            'support.member_recovery.handoff_receipt.v1',
            'support.action_execute.member_role_recovery.v1',
            'support.action_execute.audit_preview.v1',
            'support.organization.member.action_history_receipt.v1',
            'support.audit.timeline_replay_contract.v1',
        ],
        nextRoutes: {
            execute: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(input.userId)}/role-recovery`,
            memberInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/members/${encodeURIComponent(input.userId)}`,
            organizationInspection: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            auditReplay: auditQuery,
            supportSession: input.controls.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.controls.supportSessionId)}` : null,
            auditDetails: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'support_role_required',
            'missing_support_reason',
            'invalid_scope',
            'stale_prepare_payload',
            'duplicate_idempotency_key',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'active_admin_available',
            'revoked_member',
            'member_role_already_set',
            'owner_grant_denied',
            'last_owner_demote_denied',
            'audit_unavailable',
            'redaction_required',
        ],
        blockers: input.blockers,
        redaction: {
            applied: true,
            forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl', 'sessionToken', 'inviteToken'],
        },
        copyText: [
            `Support member recovery handoff ${input.userId}`,
            `Org: ${input.organizationId}`,
            `Request: ${input.requestId}`,
            `Outcome: ${input.outcome}`,
            `Role: ${currentRole || 'unknown'} -> ${input.requestedRole}`,
            `Audit: ${input.auditEventIds.join(', ') || 'pending'}`,
            `Replay: ${auditQuery}`,
        ].join('\n'),
    }
}

function supportMemberRoleRecoveryAuditQuery(input: {
    requestId: string
    organizationId: string
    userId: string
    correlationId: string
    idempotencyKey: string
    reason: string
    outcome: string
}) {
    return supportExecutorAuditQuery({
        ...input,
        entityId: input.userId,
        targetId: input.userId,
        actionType: 'support.organization.member_role_recovery',
    })
}

function supportInspectionFilterError(rawQuery: SupportInspectionQuery, filter: Omit<SupportTimelineFilter, 'unsupported'>) {
    const validationError = auditFilterValidationError(rawQuery, filter, {
        supportedFilters: supportInspectionFilters,
        unsupportedCode: 'unsupported_support_filter',
        unsupportedLabel: 'support inspection',
        invalidCode: 'invalid_support_filter',
        dateLabel: 'audit timeline',
        limitMessage: 'Support inspection limit must be a positive number.',
    })
    if (validationError) return validationError
    const hasTarget = Boolean(filter.q || filter.org || filter.user || filter.email || filter.request || filter.entity || filter.entityType || filter.supportSession || filter.workflow || filter.blocker || filter.reason || filter.scope || filter.context)
    if (!hasTarget && Boolean(filter.action || filter.source || filter.service || filter.severity || filter.outcome || filter.from || filter.to)) {
        return supportError('overbroad_support_timeline_filter', 'Add org, user, email, request, entity, entityType, or supportSession with audit timeline filters.', {
            filters: supportTimelineFilter(filter),
        })
    }
    return null
}

































function systemEventFilterError(rawQuery: AuditQuery, filter: { severity: string, outcome: string, from: string, to: string, limit: number }) {
    return auditFilterValidationError(rawQuery, filter, {
        supportedFilters: systemEventFilters,
        unsupportedCode: 'unsupported_audit_filter',
        unsupportedLabel: 'audit',
        invalidCode: 'invalid_audit_filter',
        dateLabel: 'audit',
        limitMessage: 'Audit limit must be a positive number.',
    })
}

function supportAccessRecoveryExecutionReceipt(input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    supportSessionId: string
    targetUserId: string
    email: string
    role: string
    expiresAt: string
    inviteId: string | null
    inviteStatus: string | null
    approval: Record<string, any> | null
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const actionType = 'support.organization.access_recovery'
    const entityId = input.inviteId || input.targetUserId || input.email
    const targetId = input.targetUserId || input.email
    return {
        schemaVersion: 'support.access_recovery.execution_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        reasonRequired: true,
        contextRequired: true,
        scopeRequired: true,
        expiryRequired: true,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_invite_only' : 'none',
        action: 'access_recovery',
        actionType,
        outcome: input.outcome,
        severity: 'warning',
        actorId: input.actorId,
        organizationId: input.organizationId,
        targetType: input.targetUserId ? 'user' : 'invite',
        targetId,
        entityId,
        requestId: input.requestId,
        reason: input.reason,
        scope: ['recovery:invite'],
        expiresAt: input.expiresAt,
        supportSessionId: input.supportSessionId || null,
        inviteId: input.inviteId,
        inviteStatus: input.inviteStatus,
        email: input.email,
        role: input.role,
        approvalRequired: Boolean(input.approval?.approvalRequired),
        approvalStatus: input.approval?.status || null,
        auditEventIds: input.auditEventIds,
        audit: {
            detailRoutes: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            replay: auditFilterQuery({ org: input.organizationId, action: actionType, request: input.requestId, entity: entityId, outcome: input.outcome }),
            byRequest: auditFilterQuery({ request: input.requestId, source: 'admin', service: 'hanasand-api' }),
            byEntity: auditFilterQuery({ entity: entityId, entityType: input.inviteId ? 'invite' : '', request: input.requestId }),
            byTarget: auditFilterQuery({ target: targetId, action: actionType, request: input.requestId }),
            bySupportSession: input.supportSessionId ? auditFilterQuery({ supportSession: input.supportSessionId, action: actionType }) : null,
            deniedReplay: auditFilterQuery({ org: input.organizationId, action: actionType, outcome: 'denied', request: input.requestId }),
        },
        nextRoutes: {
            inspect: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}`,
            approve: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}/approve`,
            deny: `/api/admin/support/access-recovery/${encodeURIComponent(input.requestId)}/deny`,
            organization: `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}`,
            invite: input.inviteId ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationId)}/invites/${encodeURIComponent(input.inviteId)}` : null,
            audit: auditFilterQuery({ request: input.requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
        },
        denialCases: [
            { code: 'missing_support_reason', field: 'reason', auditOutcome: 'denied' },
            { code: 'support_session_not_found', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_revoked', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_expired', field: 'supportSessionId', auditOutcome: 'denied' },
            { code: 'support_session_scope_denied', field: 'scope', auditOutcome: 'denied' },
            { code: 'pending_approval_requires_decision', field: 'approvalStatus', auditOutcome: 'success' },
            { code: 'duplicate_invite', field: 'email', auditOutcome: 'failed' },
        ],
        blockers: input.blockers,
        copyText: [
            `Access recovery receipt ${input.requestId}`,
            `Org: ${input.organizationId}`,
            `Target: ${targetId}`,
            `Invite: ${input.inviteId || 'not created'}`,
            `Outcome: ${input.outcome}`,
            `Approval: ${input.approval?.status || 'none'}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'pending index refresh'}`,
            `Replay: ${auditFilterQuery({ request: input.requestId, action: actionType, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

function supportAccessRecoveryDecisionReceipt(input: {
    actorId: string
    decision: 'approved' | 'denied'
    approval: Record<string, any>
    reason: string
    supportSessionId: string
    requiredScope: string
    outcome: 'success' | 'denied' | 'failed'
    auditEventIds: number[]
    blockers: string[]
}) {
    const actionType = `support.organization.access_recovery.${input.decision === 'approved' ? 'approve' : 'deny'}`
    const requestId = text(input.approval.requestId)
    const organizationId = text(input.approval.organizationId)
    const inviteId = text(input.approval.inviteId)
    const targetUserId = text(input.approval.targetUserId)
    const targetEmail = text(input.approval.targetEmail || input.approval.invite?.email)
    const targetId = targetUserId || targetEmail || inviteId
    const approvalStatus = text(input.approval.status)
    return {
        schemaVersion: 'support.access_recovery.decision_receipt.v1',
        generatedAt: new Date().toISOString(),
        supportRoleRequired: true,
        approverReasonRequired: true,
        scopeRequired: true,
        supportSessionId: input.supportSessionId || null,
        noSilentMembershipMutation: true,
        mutationMode: input.outcome === 'success' ? 'controlled_invite_status_only' : 'none',
        action: input.decision === 'approved' ? 'access_recovery_approve' : 'access_recovery_deny',
        actionType,
        outcome: input.outcome,
        severity: input.outcome === 'success' ? 'warning' : 'notice',
        actorId: input.actorId,
        organizationId: organizationId || null,
        targetType: targetUserId ? 'user' : 'invite',
        targetId: targetId || null,
        entityId: inviteId || requestId || targetId || null,
        requestId,
        reason: input.reason,
        reasonPresent: Boolean(input.reason),
        requiredScope: input.requiredScope,
        scope: [input.requiredScope],
        expiresAt: input.approval.expiresAt || null,
        approvalStatus,
        approvalRequired: Boolean(input.approval.approvalRequired),
        requestedBy: input.approval.requestedBy || null,
        approvedBy: input.approval.approvedBy || null,
        approvedAt: input.approval.approvedAt || null,
        deniedBy: input.approval.deniedBy || null,
        deniedAt: input.approval.deniedAt || null,
        invite: input.approval.invite ? {
            id: input.approval.invite.id || inviteId || null,
            status: input.approval.invite.status || null,
            role: input.approval.invite.role || null,
            expiresAt: input.approval.invite.expiresAt || input.approval.expiresAt || null,
        } : null,
        auditEventIds: input.auditEventIds,
        replayFilters: {
            current: auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
            byRequest: auditFilterQuery({ request: requestId, source: 'admin', service: 'hanasand-api' }),
            byEntity: inviteId ? auditFilterQuery({ entity: inviteId, entityType: 'invite', request: requestId }) : null,
            byTarget: targetId ? auditFilterQuery({ target: targetId, action: actionType, request: requestId }) : null,
            byOutcome: auditFilterQuery({ org: organizationId, action: actionType, outcome: input.outcome, request: requestId }),
            bySupportSession: input.supportSessionId ? auditFilterQuery({ supportSession: input.supportSessionId, action: actionType, request: requestId }) : null,
            denied: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery.deny', outcome: 'denied', request: requestId }),
        },
        receiptSchemas: [
            'support.access_recovery.decision_receipt.v1',
            'support.access_recovery.approval_decision.v1',
            'support.access_recovery.execution_receipt.v1',
            'support.inspection.approval_decision_packet.v1',
            'support.inspection.receipt_replay_packet.v1',
            'support.access_recovery.decision_case_review.v1',
        ],
        decisionCaseReview: supportAccessRecoveryDecisionCaseReview({
            filters: {
                org: organizationId,
                request: requestId,
                action: actionType,
                outcome: input.outcome,
                source: 'admin',
                service: 'hanasand-api',
            },
            approvals: [input.approval],
            timeline: [],
            decisionReceipt: {
                actionType,
                decision: input.decision,
                outcome: input.outcome,
                actorId: input.actorId,
                targetId,
                organizationId,
                inviteId,
                requestId,
                reason: input.reason,
                supportSessionId: input.supportSessionId,
                auditEventIds: input.auditEventIds,
                blockers: input.blockers,
            },
        }),
        nextRoutes: {
            inspect: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}` : null,
            approve: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/approve` : null,
            deny: requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(requestId)}/deny` : null,
            organization: organizationId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}` : null,
            invite: organizationId && inviteId ? `/api/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}` : null,
            supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
            audit: auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' }),
            details: input.auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
        },
        denialCases: [
            'missing_support_reason',
            'support_role_required',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_user_mismatch',
            'support_session_scope_denied',
            'approval_not_required',
            'approval_not_pending',
            'self_approval_denied',
            'denied_recovery_approval',
            'missing_decision_audit_events',
        ],
        blockers: uniqueTimelineValues([
            input.reason ? '' : 'missing_support_reason',
            requestId ? '' : 'missing_request_id',
            input.auditEventIds.length ? '' : 'missing_decision_audit_events',
            ...input.blockers,
        ]),
        copyText: [
            `Access recovery decision ${input.decision} request=${requestId || '*'}`,
            `Org: ${organizationId || '*'}`,
            `Target: ${targetId || '*'}`,
            `Outcome: ${input.outcome}`,
            `Approval status: ${approvalStatus || '*'}`,
            `Audit events: ${input.auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery({ request: requestId, action: actionType, source: 'admin', service: 'hanasand-api' })}`,
        ].join('\n'),
    }
}

function supportAccessRecoveryApprovalTimeline(filters: Record<string, unknown>, approvals: Array<Record<string, any>>) {
    const auditFilters = accessRecoveryApprovalAuditFilters(filters)
    const timeline = approvals.map((approval) => {
        const actionType = approval.status === 'denied'
            ? 'support.organization.access_recovery.deny'
            : approval.status === 'approved'
                ? 'support.organization.access_recovery.approve'
                : 'support.organization.access_recovery.request'
        const auditEventIds = Array.isArray(approval.auditEventIds) ? approval.auditEventIds : []
        return {
            schemaVersion: 'admin.audit.timeline_event.v1',
            id: Number(auditEventIds[0] || 0),
            timestamp: approval.updatedAt || approval.createdAt,
            actionType,
            severity: approval.approvalRequired ? 'warning' : 'notice',
            outcome: approval.outcome || (approval.status === 'denied' ? 'denied' : 'success'),
            source: 'admin',
            service: 'hanasand-api',
            actor: {
                id: approval.approvedBy || approval.deniedBy || approval.requestedBy,
                name: null,
            },
            target: {
                type: 'invite',
                id: approval.inviteId,
                name: approval.invite?.email || null,
            },
            organization: {
                id: approval.organizationId,
                name: approval.organizationName || null,
            },
            entity: {
                id: approval.requestId,
                type: 'access_recovery_request',
            },
            requestId: approval.requestId,
            reason: approval.decisionReason || approval.requestedReason || '',
            scope: {
                approvalRequired: approval.approvalRequired,
                status: approval.status,
                expiresAt: approval.expiresAt,
            },
            before: null,
            after: {
                status: approval.status,
                outcome: approval.outcome,
                inviteStatus: approval.invite?.status || null,
            },
            context: {
                schemaVersion: 'support.access_recovery.approval_timeline.v1',
                requestId: approval.requestId,
                inviteId: approval.inviteId,
                targetUserId: approval.targetUserId || null,
                auditEventIds,
                redactionRequired: true,
            },
            links: {
                detail: auditEventIds[0] ? `/api/admin/audit-events/${encodeURIComponent(String(auditEventIds[0]))}` : null,
                request: `/api/admin/audit-events?request=${encodeURIComponent(String(approval.requestId))}&source=system&service=hanasand-api`,
                entity: `/api/admin/audit-events?entity=${encodeURIComponent(String(approval.requestId))}&source=system&service=hanasand-api`,
            },
        }
    })
    return {
        schemaVersion: 'support.access_recovery.approval_timeline.v1',
        filters,
        auditFilters,
        eventIds: timeline.map(event => event.id).filter(id => Number.isFinite(id) && id > 0),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(auditFilters, timeline),
        exportProof: supportAuditExportProof(auditFilters, timeline),
        workflowRollup: supportAuditWorkflowRollup(auditFilters, timeline),
        decisionCaseReview: supportAccessRecoveryDecisionCaseReview({
            filters: auditFilters,
            approvals,
            timeline,
        }),
        events: timeline,
        redacted: true,
        links: {
            timeline: auditFilterQuery(auditFilters),
            details: timeline.map(event => event.links.detail).filter(Boolean),
        },
        copyText: [
            `Access recovery approval timeline: ${auditFilterQuery(auditFilters)}`,
            `Requests: ${approvals.map(approval => approval.requestId).filter(Boolean).join(', ') || 'none'}`,
            `Audit events: ${timeline.flatMap(event => event.context.auditEventIds || []).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

function supportAccessRecoveryDecisionCaseReview(input: {
    filters: Record<string, unknown>
    approvals: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    decisionReceipt?: Record<string, any>
}) {
    const approvalEventIds = uniqueTimelineValues(input.approvals.flatMap(approval => approval.auditEventIds || []))
    const timelineEntries = supportCaseTimelineEntries(input.timeline)
    const receiptEventIds = Array.isArray(input.decisionReceipt?.auditEventIds) ? input.decisionReceipt.auditEventIds : []
    const auditEventIds = uniqueTimelineValues([...approvalEventIds, ...timelineEntries.map(entry => entry.auditEventId), ...receiptEventIds])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id))
    const requestIds = uniqueTimelineValues([
        input.filters.request,
        input.decisionReceipt?.requestId,
        ...input.approvals.map(approval => approval.requestId),
    ])
    const organizationIds = uniqueTimelineValues([
        input.filters.org,
        input.decisionReceipt?.organizationId,
        ...input.approvals.map(approval => approval.organizationId),
    ])
    const targetIds = uniqueTimelineValues([
        input.decisionReceipt?.targetId,
        ...input.approvals.map(approval => approval.targetUserId || approval.targetEmail || approval.invite?.email || approval.inviteId),
    ])
    const inviteIds = uniqueTimelineValues([
        input.decisionReceipt?.inviteId,
        ...input.approvals.map(approval => approval.inviteId || approval.invite?.id),
    ])
    const actions = uniqueTimelineValues([
        input.filters.action,
        input.decisionReceipt?.actionType,
        ...timelineEntries.map(entry => entry.actionType),
    ])
    const outcomes = uniqueTimelineValues([
        input.filters.outcome,
        input.decisionReceipt?.outcome,
        ...input.approvals.map(approval => approval.outcome),
        ...timelineEntries.map(entry => entry.outcome),
    ])
    const reasons = uniqueTimelineValues([
        input.decisionReceipt?.reason,
        ...input.approvals.map(approval => approval.decisionReason || approval.requestedReason),
        ...timelineEntries.map(entry => entry.operatorNotes?.reason),
    ])
    const blockerCodes = uniqueTimelineValues([
        ...(Array.isArray(input.decisionReceipt?.blockers) ? input.decisionReceipt.blockers : []),
        ...timelineEntries.flatMap(entry => entry.operatorNotes?.blockerCodes || []),
        ...input.approvals.flatMap(approval => {
            if (approval.status === 'denied') return ['denied_recovery_approval']
            if (approval.status === 'pending') return ['pending_approval_requires_decision']
            if (approval.outcome === 'failed') return ['access_recovery_decision_failed']
            return []
        }),
    ])
    const replayFilter = {
        ...input.filters,
        org: String(input.filters.org || organizationIds[0] || ''),
        target: String(input.filters.target || targetIds[0] || ''),
        entity: String(input.filters.entity || inviteIds[0] || ''),
        request: String(input.filters.request || requestIds[0] || ''),
        action: String(input.filters.action || actions[0] || 'support.organization.access_recovery'),
        outcome: String(input.filters.outcome || outcomes[0] || ''),
        source: 'admin',
        service: 'hanasand-api',
    }
    return {
        schemaVersion: 'support.access_recovery.decision_case_review.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        supportRoleRequired: true,
        expectedConsumers: ['support', 'case.replay', 'integration'],
        summary: {
            approvalCount: input.approvals.length,
            timelineEntryCount: timelineEntries.length,
            auditEventIds,
            requestIds,
            organizationIds,
            targetIds,
            inviteIds,
            actions,
            outcomes,
            reasonPresent: reasons.length > 0,
            blockerCodes,
            operatorReviewRequired: blockerCodes.length > 0 || outcomes.includes('denied') || outcomes.includes('failed'),
        },
        operatorNotes: {
            reasonValues: reasons,
            reasonRequired: true,
            contextRequired: true,
            denialReasonCodes: uniqueTimelineValues([
                ...blockerCodes,
                ...timelineEntries.flatMap(entry => entry.recoveryState?.denialReasonCodes || []),
            ]),
            reviewFields: ['reason', 'decisionReason', 'requestId', 'supportSessionId', 'auditEventIds', 'blockerCode'],
        },
        timelineEntries,
        replayFilters: {
            current: auditFilterQuery(replayFilter),
            byRequest: requestIds.map(request => auditFilterQuery({ request, source: 'admin', service: 'hanasand-api' })),
            byOrganization: organizationIds.map(org => auditFilterQuery({ org, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            byTarget: targetIds.map(target => auditFilterQuery({ target, action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            byInvite: inviteIds.map(entity => auditFilterQuery({ entity, entityType: 'invite', action: 'support.organization.access_recovery', source: 'admin', service: 'hanasand-api' })),
            denied: auditFilterQuery({ ...replayFilter, outcome: 'denied' }),
            byReasonCode: blockerCodes.map(blocker => auditFilterQuery({ ...replayFilter, blocker, outcome: 'denied' })),
        },
        safeHandoff: {
            noLiveAccessGrant: true,
            noSilentMembershipMutation: true,
            noSilentImpersonation: true,
            noCrossOrgLeakage: true,
            redactionRequired: true,
        },
        nextRoutes: {
            approvalSearch: '/api/admin/support/access-recovery',
            inspectRequests: requestIds.map(request => `/api/admin/support/access-recovery/${encodeURIComponent(String(request))}`),
            auditReplay: auditFilterQuery(replayFilter),
            auditDetails: auditEventIds.map(id => `/api/admin/audit-events/${encodeURIComponent(String(id))}`),
            receiptReplay: '/api/admin/support/receipt-replay',
        },
        denialStates: [
            'missing_support_reason',
            'support_role_required',
            'support_session_revoked',
            'support_session_expired',
            'support_session_scope_denied',
            'approval_not_pending',
            'self_approval_denied',
            'denied_recovery_approval',
            'missing_decision_audit_events',
            'redaction_required',
        ],
        blockers: uniqueTimelineValues([
            auditEventIds.length ? '' : 'missing_decision_audit_events',
            requestIds.length ? '' : 'missing_request_id',
            reasons.length ? '' : 'missing_support_reason',
            ...blockerCodes,
        ]),
        copyText: [
            `Access recovery case review request=${requestIds.join(', ') || '*'}`,
            `Outcomes: ${outcomes.join(', ') || 'none'}`,
            `Audit events: ${auditEventIds.join(', ') || 'none'}`,
            `Replay: ${auditFilterQuery(replayFilter)}`,
        ].join('\n'),
    }
}

function accessRecoveryApprovalAuditFilters(filters: Record<string, unknown>) {
    return {
        org: filters.org || '',
        request: filters.request || '',
        action: 'support.organization.access_recovery',
        outcome: filters.outcome || '',
        source: 'admin',
        service: 'hanasand-api',
        from: filters.from || '',
        to: filters.to || '',
        limit: filters.limit || '',
    }
}

function accessRecoveryApprovalMetadata(input: {
    actorId: string
    role: string
    expiresAt: unknown
    requestId: string
    outcome: 'success' | 'failure'
    context: string
    existingMembership: unknown
    requestedApprovalRequired: unknown
}) {
    const existingRole = typeof input.existingMembership === 'object' && input.existingMembership
        ? String((input.existingMembership as { role?: unknown }).role || '')
        : ''
    const approvalRequired = Boolean(input.requestedApprovalRequired)
        || input.role === 'admin'
        || existingRole === 'owner'
        || existingRole === 'admin'

    return {
        schemaVersion: 'support.access_recovery.approval.v1',
        requestedBy: input.actorId,
        approvalRequired,
        status: approvalRequired ? 'pending_approval' : 'not_required',
        approvedBy: null as string | null,
        approvedAt: null as string | null,
        expiresAt: input.expiresAt,
        requestId: input.requestId,
        outcome: input.outcome,
        context: input.context,
        enforcement: approvalRequired ? 'invite_revoked_until_approved' : 'invite_pending_immediately',
        reason: approvalRequired
            ? 'Admin-role recovery or elevated existing membership requires second review before use.'
            : 'Member recovery does not require second review by default.',
    }
}
