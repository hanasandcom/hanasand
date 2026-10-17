import type { OrganizationAlertCaseAction, OrganizationAlertCaseRole } from '../../inputTypes.ts'
import type { OrganizationAlertVisibilityPolicy, OrganizationVisibilityDenyReason } from '../../../organizationVisibility.ts'
import type { OrganizationRole } from '../../../organizationRoles.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../alertBridge.ts'

export type OrganizationSharedWatchlistDownstreamProofAlertCase = {
    alertBridge: {
        route: 'organization_watchlist'
        canGenerateAlerts: boolean
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertGenerationRefField: 'activeTerms[].alertGenerationRef'
        dedupeScope: 'organization_watchlist_term'
        persistenceContract: {
            schemaVersion: 'organization.watchlist_alert_persistence_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            storageModule: 'scraper/src/storage/dwmAlertRepository.ts'
            upsertFunction: 'upsertDwmAlert'
            requiredInputFields: string[]
            persistedAlertFields: string[]
            workflowContextFields: string[]
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                alertGenerationRefField: 'workflowContext.alertGenerationRefs[]'
                watchlistItemIdField: 'watchlistItemIds[]'
            }
            dedupe: {
                scope: 'organization_watchlist_term'
                keyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
                crossTenantCollisionAllowed: false
            }
            lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
            visibilityDecisionField: 'workflowContext.visibilityDecision'
            casePathField: 'casePath'
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
        queueVisibilityContract: {
            schemaVersion: 'organization.watchlist_alert_visibility_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            routes: {
                list: 'GET /v1/dwm/alerts'
                detail: 'GET /v1/dwm/alerts/:id'
                update: 'PATCH /v1/dwm/alerts/:id'
                replay: 'POST /v1/dwm/alerts/:id/replay'
            }
            requiredQueryFields: Array<'organizationId'>
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
                dedupeScope: 'organization_watchlist_term'
            }
            actorVisibility: {
                policy: OrganizationAlertVisibilityPolicy
                allowed: boolean
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
                allowedRoles: OrganizationRole[]
                actorRole: OrganizationRole
                nonmemberEnumeration: false
            }
            actionGates: {
                readAlertsAllowed: boolean
                acknowledgeAllowed: boolean
                assignAllowed: boolean
                linkCaseAllowed: boolean
                replayAllowed: boolean
                mutateAllowedRoles: OrganizationAlertCaseRole[]
            }
            requiredAlertFields: string[]
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
        expectedAlertFields: string[]
        blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
    }
    caseBridge: {
        route: 'POST /v1/cases'
        casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        caseWorkflowContract: {
            schemaVersion: 'organization.watchlist_case_workflow_contract.v1'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            routes: {
                open: 'POST /v1/cases'
                list: 'GET /v1/cases'
                detail: 'GET /v1/cases/:id'
                update: 'PATCH /v1/cases/:id'
            }
            requiredQueryFields: Array<'organizationId'>
            casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
            watchlistScope: {
                watchlistItemIds: string[]
                alertGeneratorKeys: string[]
                evidenceRefField: 'case.evidence.watchlistItemIds[]'
            }
            actorActions: {
                canReadCases: boolean
                canOpenCase: boolean
                canAssignCase: boolean
                canLinkCase: boolean
                canCloseCase: boolean
                allowedActions: OrganizationAlertCaseAction[]
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
            }
            requiredCaseFields: string[]
            timelineEventTypes: Array<'case.opened' | 'case.linked_alert' | 'case.assigned' | 'case.status_changed' | 'case.note_added'>
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
        }
        expectedCaseFields: string[]
        allowedActions: OrganizationAlertCaseAction[]
        blockerCodes: OrganizationWatchlistAlertBridgeBlockerCode[]
    }

}
