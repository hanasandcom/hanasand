import type { FastifyReply, FastifyRequest } from 'fastify'
import { supportError, supportInspectionQueryFilters } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { requireAdminSupport } from '../../auth.ts'
import { loadInspectionAuditEvents } from '../../inspectionEventLoaders.ts'
import { toSupportAuditTimelineEvent } from '../../audit/auditEventProjection.ts'
import { auditTimelineSummary } from '../../audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from '../../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../../audit/auditExportPackets.ts'
import { supportTimelineFilter } from './timelineFilter.ts'
import { prepareSupportInspectionRequest, type SupportInspectionQuery } from './inspectionRequest.ts'
import { supportInspectionFilterError } from './inspectionFilterValidation.ts'
import { loadSupportInspectionData } from './inspectionData.ts'
import { buildSupportInspectionCaseModels } from './inspectionCaseModels.ts'
import { buildSupportInspectionProofs } from './inspectionProofs.ts'
import { sendSupportInspectionResponse } from './inspectionPresentation.ts'
import { buildSupportWorkbench } from './workbench.ts'
import { supportReadinessExport } from '../readiness/readinessExport.ts'
import { supportWorkbenchAdapter } from '../workbenchAdapter.ts'

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
