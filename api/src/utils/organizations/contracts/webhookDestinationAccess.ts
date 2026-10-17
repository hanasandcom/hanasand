import type { OrganizationVisibilityDenyReason } from '../../organizationVisibility.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from './alertBridge.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWebhookDestinationAccessReceipts } from './webhookAccess/receipts.ts'

type OrganizationWebhookDestinationAccessBase = {

    schemaVersion: 'organization.webhook_destination_access_decision.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    route: 'POST /v1/dwm/webhooks/deliver'
    destinationScope: {
        requiredDestinationOrgId: string
        selectedDestinationOrgField: 'destination.org_id'
        selectedDestinationIdField: 'webhookDestinationIds[]'
        crossOrgDestinationAllowed: false
        nonmemberDestinationEnumeration: false
    }
    allowedActions: {
        automaticDelivery: boolean
        manualTrigger: boolean
        configureDestination: boolean
        readDeliverySummary: true
    }
    roleGates: {
        automaticDelivery: Array<'owner' | 'admin' | 'editor'>
        manualTrigger: Array<'owner' | 'admin' | 'editor'>
        configureDestination: Array<'owner' | 'admin' | 'editor'>
        readDeliverySummary: OrganizationRole[]
    }
    denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | 'role_not_allowed' | null
    blockerCodes: string[]
    requiredAlertFields: string[]
    requiredDeliveryFields: string[]
}

export type OrganizationWebhookDestinationAccessDecision = OrganizationWebhookDestinationAccessBase & OrganizationWebhookDestinationAccessReceipts
