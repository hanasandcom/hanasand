import type { DownstreamProofContext } from './context.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../../contracts/downstreamProof.ts'
import { organizationTenantIdentity } from '../../identity.ts'
import { organizationCaseWorkflowRequiredFields, organizationCaseWorkflowTimelineEvents, organizationCaseWorkflowEvidenceFields } from '../workflowContractFields.ts'

export function caseBridgeSection(context: DownstreamProofContext): Pick<OrganizationSharedWatchlistDownstreamProof, 'caseBridge'> {
    const { organization, downstreamAuthorization, activeTerms, alertGeneratorKeys, caseBlockers, caseWorkflowDenialReason, caseReadAllowed } = context
    return {
        caseBridge: {
            route: 'POST /v1/cases',
            casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
            caseWorkflowContract: {
                schemaVersion: 'organization.watchlist_case_workflow_contract.v1',
                ...organizationTenantIdentity(organization.id, organization.id),
                sourceFamily: 'organization_watchlist',
                routes: {
                    open: 'POST /v1/cases',
                    list: 'GET /v1/cases',
                    detail: 'GET /v1/cases/:id',
                    update: 'PATCH /v1/cases/:id',
                },
                requiredQueryFields: ['organizationId'],
                casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId',
                watchlistScope: {
                    watchlistItemIds: activeTerms.map(term => term.watchlistItemId),
                    alertGeneratorKeys,
                    evidenceRefField: 'case.evidence.watchlistItemIds[]',
                },
                actorActions: {
                    canReadCases: caseReadAllowed,
                    canOpenCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('link_case'),
                    canAssignCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('assign_case'),
                    canLinkCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('link_case'),
                    canCloseCase: caseReadAllowed && downstreamAuthorization.allowedActions.includes('assign_case'),
                    allowedActions: downstreamAuthorization.allowedActions,
                    denialReason: caseWorkflowDenialReason,
                },
                requiredCaseFields: [...organizationCaseWorkflowRequiredFields],
                timelineEventTypes: [...organizationCaseWorkflowTimelineEvents],
                evidenceFields: [...organizationCaseWorkflowEvidenceFields],
                redactedFields: [
                    'activeTerms[].term',
                    'activeTerms[].value',
                    'case.evidence.rawContent',
                ],
                blockerCodes: caseBlockers,
            },
            expectedCaseFields: [
                'organizationId',
                'tenantId',
                'alertId',
                'casePath',
                'watchlistItemIds',
                'allowedActions',
                'visibilityDecision',
            ],
            allowedActions: downstreamAuthorization.allowedActions,
            blockerCodes: caseBlockers,
        },
    }
}
