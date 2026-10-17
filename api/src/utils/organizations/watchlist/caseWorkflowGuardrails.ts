import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import { organizationCaseWorkflowRequiredFields, organizationCaseWorkflowTimelineEvents, organizationCaseWorkflowEvidenceFields } from './workflowContractFields.ts'

export function organizationSharedWatchlistCaseWorkflowGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails['caseSafety'] {
    const workflow = proof.caseBridge.caseWorkflowContract
    const requiredCaseFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredCaseFields'] = [
        ...organizationCaseWorkflowRequiredFields,
    ]
    const requiredTimelineEvents: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredTimelineEvents'] = [
        ...organizationCaseWorkflowTimelineEvents,
    ]
    const requiredEvidenceFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredEvidenceFields'] = [
        ...organizationCaseWorkflowEvidenceFields,
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['requiredRedactedFields'] = [
        'activeTerms[].term',
        'case.evidence.rawContent',
    ]
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrails['caseSafety']['blockerCodes'] = []

    if (workflow.organizationId !== proof.organizationId || workflow.tenantId !== proof.organizationId) {
        blockerCodes.push('case_org_scope_missing')
    }
    if (workflow.casePathTemplate !== '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId') {
        blockerCodes.push('case_path_missing')
    }
    if (!requiredCaseFields.every(field => workflow.requiredCaseFields.includes(field))) {
        blockerCodes.push('case_fields_missing')
    }
    if (!requiredTimelineEvents.every(event => workflow.timelineEventTypes.includes(event))) {
        blockerCodes.push('case_timeline_missing')
    }
    if (!requiredEvidenceFields.every(field => workflow.evidenceFields.includes(field))) {
        blockerCodes.push('case_evidence_missing')
    }
    if (!requiredRedactedFields.every(field => workflow.redactedFields.includes(field))) {
        blockerCodes.push('case_redaction_missing')
    }
    if (workflow.actorActions.canOpenCase && !workflow.actorActions.allowedActions.includes('link_case')) {
        blockerCodes.push('case_role_gate_missing')
    }
    if (workflow.actorActions.canAssignCase && !workflow.actorActions.allowedActions.includes('assign_case')) {
        blockerCodes.push('case_role_gate_missing')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_case_workflow_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredCaseFields,
        requiredTimelineEvents,
        requiredEvidenceFields,
        requiredRedactedFields,
        casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
        actorCanOpenCase: workflow.actorActions.canOpenCase,
        actorCanAssignCase: workflow.actorActions.canAssignCase,
        blockerCodes: [...new Set(blockerCodes)],
    }
}
