import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAdminSupport } from '../auth.ts'
import { supportTimelineAuditBridgeEvent } from '#utils/systemEvent.ts'
import { supportInspectionAuditMetadata } from '#utils/support/adminSupportInput.ts'
import { toOrganization, toInvite, toWatchlistItem, buildOrganizationDwmAlertReference, type OrganizationInviteRow, type OrganizationWatchlistRow } from '#utils/organizations.ts'
import { loadOrganizationSupportDetail } from './organizationReadData.ts'
import { loadSupportOrganizationInspectionData } from './subjectInspectionData.ts'
import { sendOrganizationEntityInspectionNotFound } from './organizationInspectionNotFound.ts'
import { toSupportWebhookDestination } from '../webhooks/destinationMapping.ts'
import { supportWebhookDestinationReadiness } from '../webhooks/destinationReadiness.ts'
import { supportRecentAuditTimeline } from './recentAuditTimeline.ts'
import { supportOrganizationActivityRollup } from './activityRollups.ts'
import { buildSupportSubjectInspectionContext } from './subjectInspectionContext.ts'
import { supportOrganizationCaseAccessReadiness } from './organizationAccessReadiness.ts'
import { supportOrganizationCaseHandoff } from './organizationHandoff.ts'
import { toSupportMember } from './subjectMapping.ts'
import { supportSubjectInspectionResponseFields } from './subjectInspectionPresentation.ts'
import { recordSupportSubjectInspection } from './subjectInspectionAudit.ts'

export async function getSupportOrganization(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const inspectionAudit = supportInspectionAuditMetadata(req)
    const organization = await loadOrganizationSupportDetail(req.params.id)
    if (!organization) {
        return sendOrganizationEntityInspectionNotFound({
            req, res, actorId: actor.id, metadata: inspectionAudit, kind: 'organization',
            targetId: req.params.id, organizationId: req.params.id,
            error: 'organization_not_found', responseError: 'Organization not found.',
        })
    }

    const {
        members, invites, watchlists,
        webhookDestinations: webhookDestinationsResult, audit, availability,
    } = await loadSupportOrganizationInspectionData(organization.id)
    const supportMembers = members.rows.map(toSupportMember)
    const supportInvites = (invites.rows as OrganizationInviteRow[]).map(toInvite)
    const supportWatchlistItems = (watchlists.rows as OrganizationWatchlistRow[]).map(toWatchlistItem)
    const pendingInviteCount = invites.rows.filter((invite: { status: string }) => invite.status === 'pending').length
    await recordSupportSubjectInspection({
        req,
        actorId: actor.id,
        kind: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        metadata: inspectionAudit,
        context: {
            memberCount: members.rows.length,
            pendingInviteCount,
            watchlistItemCount: watchlists.rows.length,
            webhookDestinationCount: webhookDestinationsResult.rows.length,
        },
    })

    const watchlistItems = watchlists.rows as OrganizationWatchlistRow[]
    const webhookDestinations = (webhookDestinationsResult.rows as Record<string, unknown>[]).map(toSupportWebhookDestination)
    const alertReferences = watchlistItems.map(item => buildOrganizationDwmAlertReference(organization, item))
    const webhookDestinationReadiness = supportWebhookDestinationReadiness({
        organizationId: organization.id,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        destinations: webhookDestinations,
    })
    const recentAuditTimeline = supportRecentAuditTimeline({
        org: organization.id,
        target: organization.id,
        entity: organization.id,
        request: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        action: 'support.organization',
    }, audit.rows as Record<string, unknown>[])
    const supportActivityRollup = supportOrganizationActivityRollup({
        organizationId: organization.id,
        requestId: inspectionAudit.requestId,
        timeline: recentAuditTimeline.events,
    })
    const { subjectAccessState, authorization, receipts: subjectReceipts } = buildSupportSubjectInspectionContext({
        kind: 'organization',
        actorId: actor.id,
        requestedId: req.params.id,
        targetId: organization.id,
        organizationIds: [organization.id],
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        users: members.rows as Record<string, unknown>[],
        memberships: members.rows as Record<string, unknown>[],
        invites: invites.rows as Record<string, unknown>[],
        approvalDetails: [],
        availability,
        timeline: recentAuditTimeline.events,
        supportActivityRollup,
    })
    const { accessStatus: organizationAccessStatus, accessRecoveryPlan } = subjectAccessState
    const caseAccessReadiness = supportOrganizationCaseAccessReadiness({
        organizationId: organization.id,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        members: supportMembers,
        invites: supportInvites,
        watchlistItems: supportWatchlistItems,
        alertReferences,
        webhookDestinations,
        webhookDestinationReadiness,
        accessStatus: organizationAccessStatus,
        accessRecoveryPlan,
        timeline: recentAuditTimeline.events,
    })
    const alertReadinessBridge = supportTimelineAuditBridgeEvent({
        workflow: 'watchlist',
        action: 'support.organization.alert_readiness.inspect',
        actorId: actor.id,
        targetType: 'organization',
        targetId: organization.id,
        organizationId: organization.id,
        entityId: organization.id,
        requestId: inspectionAudit.requestId,
        severity: 'info',
        outcome: 'success',
        reason: inspectionAudit.reason || 'Support inspected organization alert readiness.',
        source: 'support',
        service: 'hanasand-api',
        context: {
            watchlistItemCount: watchlistItems.length,
            generatedAlertReferenceCount: alertReferences.length,
            supportContext: inspectionAudit.supportContext || null,
        },
        after: {
            generatedAlertReferenceCount: alertReferences.length,
        },
    })
    const { actionHistoryExport } = subjectReceipts
    const caseHandoff = supportOrganizationCaseHandoff({
        actorId: actor.id,
        organizationId: organization.id,
        requestId: inspectionAudit.requestId,
        reason: inspectionAudit.reason,
        supportContext: inspectionAudit.supportContext,
        members: supportMembers,
        invites: supportInvites,
        watchlistItems: supportWatchlistItems,
        alertReferences,
        webhookDestinations,
        webhookDestinationReadiness,
        caseAccessReadiness,
        accessRecoveryPlan,
        actionHistoryExport,
        timeline: recentAuditTimeline.events,
    })
    return res.send({
        organization: toOrganization(organization),
        members: supportMembers,
        invites: supportInvites,
        watchlistItems: supportWatchlistItems,
        webhookDestinations,
        alertReadiness: {
            schemaVersion: 'support.organization.alert_readiness.v1',
            organizationId: organization.id,
            watchlistItemCount: alertReferences.length,
            generatedAlertReferences: alertReferences,
            links: {
                api: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`,
                console: `/dwm?organizationId=${encodeURIComponent(organization.id)}`,
                audit: `/system/impersonation?org=${encodeURIComponent(organization.id)}&action=support.organization`,
            },
            supportTimelineBridge: {
                schemaVersion: 'support.organization.alert_readiness.audit_bridge.v1',
                event: alertReadinessBridge,
                auditFields: ['actionType', 'actorId', 'targetType', 'targetId', 'organizationId', 'entityId', 'requestId', 'severity', 'outcome', 'reason', 'source', 'service', 'context'],
                testCommand: 'cd api && bun run smoke:admin-support-unit',
            },
        },
        webhookDestinationReadiness,
        supportLinks: {
            inspectUser: '/api/admin/support/users/:id',
            inviteAssist: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/invites`,
            accessRecovery: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}/access-recovery`,
            audit: `/api/admin/audit-events?org=${encodeURIComponent(organization.id)}`,
            webhookAudit: `/api/admin/audit-events?org=${encodeURIComponent(organization.id)}&action=webhook`,
            caseHandoff: `/api/admin/support/organizations/${encodeURIComponent(organization.id)}?include=caseHandoff`,
        },
        ...supportSubjectInspectionResponseFields({
            kind: 'organization',
            targetId: organization.id,
            authorization,
            subjectAccessState,
            receipts: subjectReceipts,
            caseAccessReadiness,
            caseHandoff,
            supportActivityRollup,
            recentAuditTimeline,
            relatedRecordCount: members.rows.length,
            pendingInviteCount,
        }),
    })
}
