import type { OrganizationAlertCaseRole, OrganizationDefaultWebhookPolicy, OrganizationSharedWatchlistAuditEventAction, OrganizationSharedWatchlistMonitoringWorkflowStep } from '../../inputTypes.ts'
import type { OrganizationVisibilityDenyReason } from '../../../organizationVisibility.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../alertBridge.ts'

export type OrganizationSharedWatchlistDownstreamProofDelivery = {
    webhookBridge: {
        route: 'POST /v1/dwm/webhooks/deliver'
        defaultWebhookPolicy: OrganizationDefaultWebhookPolicy
        canUseDefaultDestinations: boolean
        deliveryContract: {
            schemaVersion: 'organization.watchlist_webhook_delivery_contract.v1'
            eventType: 'dwm.alert'
            organizationId: string
            tenantId: string
            sourceFamily: 'organization_watchlist'
            destinationSelection: {
                policy: OrganizationDefaultWebhookPolicy
                selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
                requiredDestinationOrgId: string
                selectedDestinationOrgField: 'destination.org_id'
                selectedDestinationIdField: 'webhookDestinationIds[]'
                skippedDestinationReasons: Array<'org_mismatch' | 'destination_disabled' | 'event_not_subscribed' | 'manual_selection_required' | 'webhook_policy_disabled'>
                nonmemberDestinationEnumeration: false
            }
            roleGates: {
                automaticDeliveryAllowed: boolean
                manualTriggerAllowed: boolean
                manualTriggerAllowedRoles: Array<'owner' | 'admin' | 'editor'>
                memberManualTriggerAllowed: false
                denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
            }
            idempotency: {
                scope: 'organization_destination_alert'
                keyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
            }
            requiredAlertFields: string[]
            requiredDeliveryFields: string[]
            evidenceFields: string[]
            redactedFields: string[]
            blockerCodes: string[]
        }
        expectedDeliveryFields: string[]
        blockerCodes: string[]
    }
    monitoringWorkflow: {
        schemaVersion: 'organization.shared_watchlist_monitoring_workflow.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        persistenceLevel: 'organization_persisted'
        expectedAdapter: 'organizationSharedWatchlistMonitoringWorkflow'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
        entrypoint: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms'
            requiredQueryFields: Array<'organizationId' | 'requestId'>
            responseField: 'alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow'
        }
        steps: Array<{
            id: OrganizationSharedWatchlistMonitoringWorkflowStep
            ownerLane: 'org_watchlist' | 'dwm_alert_workflow' | 'case_workflow' | 'webhook_delivery' | 'support_audit'
            route: string
            storageModule: string
            requiredPayloadFields: string[]
            requiredAuditActions: OrganizationSharedWatchlistAuditEventAction[]
            allowedRoles: OrganizationAlertCaseRole[]
            state: 'ready' | 'blocked'
            blockerCodes: string[]
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'destination.secret' | 'case.evidence.rawContent' | 'member.userId'>
        }>
        operatorActions: {
            acknowledgeAlert: boolean
            assignCase: boolean
            linkCase: boolean
            replayAlert: boolean
            deliverWebhook: boolean
        }
        evidenceContract: {
            requiredFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'casePath' | 'audit.eventBridge' | 'visibilityDecision'>
            redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'destination.secret' | 'case.evidence.rawContent'>
            containsRawTerms: false
        }
        blockerCodes: string[]
    }

}
