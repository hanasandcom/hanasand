import type { OrganizationDefaultWebhookPolicy } from '../inputTypes.ts'
import type { OrganizationVisibilityDenyReason } from '../../organizationVisibility.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from './alertBridge.ts'

export type OrganizationWebhookDestinationOwnershipContract = {
    schemaVersion: 'organization.webhook_destination_ownership.v1'
    route: 'POST /v1/dwm/webhooks/deliver'
    eventType: 'dwm.alert'
    organizationId: string
    tenantId: string
    policy: OrganizationDefaultWebhookPolicy
    selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
    requiredDestinationOrgId: string
    selectedDestinationOrgField: 'destination.org_id'
    selectedDestinationIdField: 'webhookDestinationIds[]'
    skippedDestinationReasons: Array<'org_mismatch' | 'destination_disabled' | 'event_not_subscribed' | 'manual_selection_required' | 'webhook_policy_disabled'>
    nonmemberDestinationEnumeration: false
    idempotency: {
        scope: 'organization_destination_alert'
        keyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
    }
    roleGates: {
        automaticDeliveryAllowed: boolean
        manualTriggerAllowed: boolean
        manualTriggerAllowedRoles: Array<'owner' | 'admin' | 'editor'>
        memberManualTriggerAllowed: false
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
    }
    requiredAlertFields: string[]
    requiredDeliveryFields: string[]
    redactedFields: string[]
    blockerCodes: string[]
}
