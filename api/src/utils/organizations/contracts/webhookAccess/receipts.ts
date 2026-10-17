import type { OrganizationRole } from '../../../organizationRoles.ts'
import type { WatchlistKind } from '../../inputTypes.ts'

export type OrganizationWebhookDestinationAccessReceipts = {
    deliveryInputReceipt: {
        schemaVersion: 'organization.webhook_destination_delivery_input.v1'
        organizationId: string
        tenantId: string
        route: 'POST /v1/dwm/webhooks/deliver'
        eventType: 'dwm.alert'
        requiredAlertFields: Array<'alert.organizationId' | 'alert.tenantId' | 'alert.watchlistItemIds' | 'alert.workflowContext.alertGeneratorKeys' | 'alert.dedupeKey'>
        requiredDestinationFields: Array<'destination.id' | 'destination.org_id' | 'destination.enabled' | 'destination.eventSubscriptions'>
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        idempotencyKeyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'manual_webhook_selection_required'>
        crossOrgDestinationAllowed: false
        nonmemberDestinationEnumeration: false
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds'>
    }
    dryRunReceipt: {
        schemaVersion: 'organization.webhook_destination_dry_run_visibility.v1'
        organizationId: string
        tenantId: string
        route: 'POST /v1/dwm/webhooks/deliver'
        eventType: 'dwm.alert'
        actor: {
            userId: string
            role: OrganizationRole
            status: 'active'
        }
        allowed: boolean
        allowedRoles: Array<'owner' | 'admin' | 'editor'>
        summaryVisibleRoles: OrganizationRole[]
        deniedRoles: Array<'reader' | 'member' | 'viewer'>
        denialReason: 'role_not_allowed' | 'manual_webhook_selection_required' | null
        destinationScope: {
            requiredDestinationOrgId: string
            selectedDestinationOrgField: 'destination.org_id'
            selectedDestinationIdField: 'webhookDestinationIds[]'
            crossOrgDestinationAllowed: false
            nonmemberDestinationEnumeration: false
        }
        readiness: {
            destinationDeliveryReady: boolean
            dryRunAllowed: boolean
            manualSelectionRequired: boolean
            blockerCodes: string[]
        }
        requiredAlertFields: Array<'alert.organizationId' | 'alert.tenantId' | 'alert.watchlistItemIds' | 'alert.workflowContext.alertGeneratorKeys' | 'alert.dedupeKey'>
        requiredDestinationFields: Array<'destination.id' | 'destination.org_id' | 'destination.enabled' | 'destination.eventSubscriptions'>
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds' | 'otherOrg.alertGeneratorKeys'>
    }
    alertDeliveryReadiness: {
        schemaVersion: 'organization.webhook_alert_delivery_readiness.v1'
        organizationId: string
        tenantId: string
        sourceFamily: 'organization_watchlist'
        route: 'POST /v1/dwm/webhooks/deliver'
        eventType: 'dwm.alert'
        actor: {
            userId: string
            role: OrganizationRole
            status: 'active'
        }
        watchlistScope: {
            watchlistItemIds: string[]
            alertGeneratorKeys: string[]
            provenanceHashes: string[]
            crossOrgDeliveryAllowed: false
        }
        workflowState: {
            alertGenerationReady: boolean
            caseReplayReady: boolean
            destinationDeliveryReady: boolean
            dryRunReady: boolean
        }
        deliveryContract: {
            selectedDestinationOrgField: 'destination.org_id'
            selectedDestinationIdField: 'webhookDestinationIds[]'
            requiredAlertFields: Array<'alert.organizationId' | 'alert.tenantId' | 'alert.watchlistItemIds' | 'alert.workflowContext.alertGeneratorKeys' | 'alert.dedupeKey'>
            requiredDestinationFields: Array<'destination.id' | 'destination.org_id' | 'destination.enabled' | 'destination.eventSubscriptions'>
            idempotencyKeyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
        }
        roleGates: {
            automaticDelivery: Array<'owner' | 'admin' | 'editor'>
            manualTrigger: Array<'owner' | 'admin' | 'editor'>
            readDeliverySummary: OrganizationRole[]
        }
        blockerCodes: string[]
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds' | 'otherOrg.alertGeneratorKeys' | 'case.evidence.rawContent'>
    }
    deliveryConsumerReceipt: {
        schemaVersion: 'organization.webhook_destination_delivery_consumer.v1'
        organizationId: string
        tenantId: string
        route: 'POST /v1/dwm/webhooks/deliver'
        eventType: 'dwm.alert'
        actor: {
            userId: string
            role: OrganizationRole
            status: 'active'
        }
        readyForDelivery: boolean
        destinationDeliveryReady: boolean
        dryRunReady: boolean
        blockerReason: string | null
        roleGates: {
            automaticDelivery: Array<'owner' | 'admin' | 'editor'>
            manualTrigger: Array<'owner' | 'admin' | 'editor'>
            readDeliverySummary: OrganizationRole[]
        }
        destinationScope: {
            selectedDestinationOrgField: 'destination.org_id'
            selectedDestinationIdField: 'webhookDestinationIds[]'
            crossOrgDestinationAllowed: false
            nonmemberDestinationEnumeration: false
        }
        watchlistMatches: Array<{
            organizationId: string
            tenantId: string
            watchlistId: string
            watchlistItemId: string
            watchedEntity: {
                type: WatchlistKind
                value: string
                normalizedValue: string
            }
            matchReason: {
                kind: 'shared_watchlist_term'
                code: 'organization_watchlist_term_match'
            }
            actorRef: {
                userId: string
                role: OrganizationRole
                source: 'organization_member'
            }
            sourceRefs: {
                sourceFamily: 'organization_watchlist'
                exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms'
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility'
            }
            provenanceHash: string
            workflowStatus: 'ready_for_delivery' | 'blocked'
            destinationReadiness: {
                destinationDeliveryReady: boolean
                dryRunReady: boolean
                selectedDestinationOrgField: 'destination.org_id'
                selectedDestinationIdField: 'webhookDestinationIds[]'
                blockerReason: string | null
            }
        }>
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'member_revoked' | 'watchlist_paused' | 'watchlist_archived' | 'manual_webhook_selection_required' | 'role_not_allowed'>
        blockerCodes: string[]
        noLeakFields: Array<'destination.secret' | 'destination.endpoint' | 'otherOrg.destinationIds' | 'otherOrg.alertGeneratorKeys' | 'case.evidence.rawContent'>
    }
    proofAssertions: Array<
        | 'destination_org_matches_alert_org'
        | 'idempotency_scoped_to_org_destination_alert'
        | 'manual_trigger_owner_admin_only'
        | 'member_viewer_cannot_configure_destination'
        | 'nonmember_cannot_enumerate_destinations'
    >
    noLeakFields: Array<
        | 'destination.secret'
        | 'destination.endpoint'
        | 'otherOrg.destinationIds'
        | 'otherOrg.alertGeneratorKeys'
        | 'activeTerms[].term'
    >
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
