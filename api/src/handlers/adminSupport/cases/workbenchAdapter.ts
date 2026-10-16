import { auditFilterQuery, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { supportAuditActionEvidenceRollup } from '../audit/auditEvidenceRollups.ts'

export function supportWorkbenchAdapter(input: {
    org: string
    user: string
    email: string
    request: string
    workbench: Record<string, any>
    caseSummary: Record<string, any>
    accessStatus: Record<string, any>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
}) {
    const memberships = Array.isArray(input.caseSummary.state?.memberships) ? input.caseSummary.state.memberships : []
    const pendingInvites = Array.isArray(input.caseSummary.state?.pendingInvites) ? input.caseSummary.state.pendingInvites : []
    const recoveryRequests = Array.isArray(input.caseSummary.state?.recoveryRequests) ? input.caseSummary.state.recoveryRequests : []
    const rows = [
        ...memberships.map((member: Record<string, any>) => ({
            id: `member:${member.organizationId || input.org}:${member.userId || member.id || 'unknown'}`,
            type: 'member',
            label: member.userEmail || member.userName || member.userId || 'Organization member',
            organizationId: member.organizationId || input.org || null,
            targetUserId: member.userId || null,
            status: member.status || 'unknown',
            role: member.role || null,
            outcome: member.status === 'active' ? 'success' : 'denied',
            route: member.organizationId && member.userId ? `/api/admin/support/organizations/${encodeURIComponent(String(member.organizationId))}/members/${encodeURIComponent(String(member.userId))}` : null,
            actionRoute: member.organizationId && member.userId ? `/api/admin/support/organizations/${encodeURIComponent(String(member.organizationId))}/members/${encodeURIComponent(String(member.userId))}/role-recovery` : null,
        })),
        ...pendingInvites.map((invite: Record<string, any>) => ({
            id: `invite:${invite.organizationId || input.org}:${invite.id || invite.email || 'unknown'}`,
            type: 'invite',
            label: invite.email || invite.id || 'Pending invite',
            organizationId: invite.organizationId || input.org || null,
            targetUserId: null,
            status: invite.status || 'pending',
            role: invite.role || null,
            outcome: 'success',
            route: invite.organizationId && invite.id ? `/api/admin/support/organizations/${encodeURIComponent(String(invite.organizationId))}/invites/${encodeURIComponent(String(invite.id))}` : null,
            actionRoute: invite.organizationId && invite.id ? `/api/admin/support/organizations/${encodeURIComponent(String(invite.organizationId))}/invites/${encodeURIComponent(String(invite.id))}/actions` : null,
        })),
        ...recoveryRequests.map((request: Record<string, any>) => ({
            id: `recovery:${request.requestId || 'unknown'}`,
            type: 'access_recovery',
            label: request.requestId || request.inviteId || 'Access recovery request',
            organizationId: request.organizationId || input.org || null,
            targetUserId: request.targetUserId || null,
            status: request.status || 'unknown',
            role: null,
            outcome: request.outcome || 'success',
            route: request.requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(String(request.requestId))}` : null,
            actionRoute: request.requestId ? `/api/admin/support/access-recovery/${encodeURIComponent(String(request.requestId))}/approve` : null,
        })),
    ].slice(0, 100)
    const selected = rows[0] || null
    const timelineRows = input.timeline.slice(0, 25).map(event => ({
        id: event.id,
        timestamp: event.createdAt || event.timestamp || null,
        actionType: event.action || event.actionType || null,
        severity: event.severity || null,
        outcome: event.outcome || null,
        requestId: event.requestId || null,
        entityId: event.entityId || event.entity?.id || null,
        reasonPresent: Boolean(event.reason),
        actionEvidence: event.actionEvidence || null,
        detail: event.links?.detail || null,
    }))

    return {
        schemaVersion: 'support.workbench.adapter.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        route: '/api/admin/support/inspect',
        query: {
            org: input.org || null,
            user: input.user || null,
            email: input.email || null,
            request: input.request || null,
            filters: input.timelineFilter,
        },
        list: {
            schemaVersion: 'support.workbench.list.v1',
            rows,
            rowCount: rows.length,
            searchableFields: ['type', 'label', 'organizationId', 'targetUserId', 'status', 'role', 'outcome', 'requestId'],
            emptyState: rows.length ? null : 'No members, invites, or recovery requests matched the support filters.',
        },
        selectedDetail: selected ? {
            schemaVersion: 'support.workbench.detail.v1',
            row: selected,
            accessStatus: input.accessStatus,
            requiredOperatorInputs: {
                reason: true,
                context: true,
                scope: ['invite:create', 'invite:resend', 'invite:revoke', 'recovery:invite', 'member:role_recovery', 'read_profile', 'read_org'],
                durationMinutesFor: ['impersonation'],
                expiresAtFor: ['invite_assistance', 'access_recovery'],
            },
            actions: {
                inspect: selected.route,
                execute: selected.actionRoute,
                audit: auditFilterQuery({
                    org: selected.organizationId || input.org,
                    target: selected.targetUserId || input.user || input.email,
                    entity: selected.type === 'access_recovery' ? input.request : selected.id,
                    request: input.request,
                    outcome: selected.outcome,
                    source: 'admin',
                    service: 'hanasand-api',
                }),
            },
        } : null,
        timeline: {
            schemaVersion: 'support.workbench.timeline_adapter.v1',
            rows: timelineRows,
            filter: input.timelineFilter,
            eventIds: timelineRows.map(row => row.id).filter((id): id is number => Number.isFinite(id)),
            actionEvidenceRollup: supportAuditActionEvidenceRollup(input.timeline),
            links: {
                replay: auditFilterQuery(input.timelineFilter),
                details: timelineRows.map(row => row.detail).filter(Boolean),
            },
        },
        backedActions: {
            inviteAssistance: input.workbench.inviteAssistance?.endpoints || [],
            inviteActions: rows.filter(row => row.type === 'invite').map(row => row.actionRoute).filter(Boolean),
            accessRecovery: input.workbench.accessRecovery?.endpoints || [],
            memberRoleRecovery: rows.filter(row => row.type === 'member').map(row => row.actionRoute).filter(Boolean),
            impersonation: input.workbench.impersonationAssistance?.endpoint || null,
        },
        readinessProof: {
            schemaVersion: 'support.workbench.adapter_readiness.v1',
            routeAvailable: true,
            supportRoleRequired: true,
            reasonRequiredForActions: true,
            auditFiltersAvailable: ['org', 'actor', 'target', 'action', 'severity', 'outcome', 'entity', 'request', 'time', 'reason', 'blocker'],
            noSilentMutation: true,
            redactionRequired: true,
            blockers: input.workbench.blockers || [],
            focusedCheck: 'cd api && bun run smoke:admin-support-unit',
        },
        copyText: [
            `Support workbench adapter org=${input.org || '*'} user=${input.user || '*'} email=${input.email || '*'} request=${input.request || '*'}`,
            `Rows: ${rows.length}`,
            `Timeline events: ${timelineRows.length}`,
            `Selected: ${selected?.id || 'none'}`,
            `Audit replay: ${auditFilterQuery(input.timelineFilter)}`,
        ].join('\n'),
    }
}
