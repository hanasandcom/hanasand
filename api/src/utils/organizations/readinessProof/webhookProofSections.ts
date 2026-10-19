import type { ReadinessProofContext } from './context.ts'
import { buildWebhookDestinationReadinessBridge } from '../../webhookDestinationReadinessBridge.ts'
import { roleCanEditOrganization } from '../../organizationRoles.ts'

import { organizationTenantIdentity } from '../identity.ts'

export function webhookProofSections(context: ReadinessProofContext) {
    const { input, webhookBlockerCodes, webhookSelectedDestinationSource, proofOrganizationLifecycleBlockerPrefix } = context
    return {
        webhookDeliveryProof: {
            schemaVersion: 'organization.webhook_delivery_visibility_proof.v1',
            deliveryContractSchema: 'dwm.webhook.org_alert_delivery.v1',
            route: 'POST /dwm/webhook-deliveries',
            defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
            canUseDefaultDestinations: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            ownerAdminManualTriggerRequired: true,
            memberManualTriggerAllowed: false,
            nonmemberDestinationEnumeration: false,
            expectedDeliveryFields: [
                'orgAlertDelivery.organization.id',
                'orgAlertDelivery.alert.id',
                'orgAlertDelivery.watchlist.watchlistItemIds',
                'orgAlertDelivery.destinationSelection.selectedDestinations',
                'orgAlertDelivery.destinationSelection.skippedDestinations',
                'orgAlertDelivery.ledger.deliveries',
                'orgAlertDelivery.auditEventContracts',
            ] as string[],
            blockerCodes: webhookBlockerCodes,
            webhookDestinationReadinessBridge: buildWebhookDestinationReadinessBridge({
                defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
                canUseDefaultDestinations: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
                selectedDestinationSource: webhookSelectedDestinationSource,
                requiredDestinationOrgId: input.downstreamAuthorization.organizationId,
                blockerCodes: webhookBlockerCodes,
            }),
        },
        destinationOwnershipProof: {
            schemaVersion: 'organization.webhook_destination_ownership_readiness.v1',
            sourceContracts: [
                'organization.webhook_destination_ownership.v1',
                'organization.webhook_destination_access_decision.v1',
                'organization.webhook_destination_readiness_bridge.v1',
            ],
            route: 'POST /v1/dwm/webhooks/deliver',
            ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
            defaultWebhookPolicy: input.downstreamAuthorization.downstream.webhook.defaultPolicy,
            requiredDestinationOrgId: input.downstreamAuthorization.organizationId,
            requiredDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            selectedDestinationSource: webhookSelectedDestinationSource,
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
            ownerAdminConfigureAllowed: roleCanEditOrganization(input.downstreamAuthorization.member.role),
            memberConfigureAllowed: false,
            manualTriggerAllowedRoles: ['owner', 'admin', 'editor'],
            automaticDeliveryAllowed: input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            lifecycleBlockers: [
                ...proofOrganizationLifecycleBlockerPrefix(),
                'manual_webhook_selection_required',
            ],
            blockerCodes: webhookBlockerCodes,
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
            ],
            proofAssertions: [
                'destination_org_matches_alert_org',
                'nonmember_cannot_enumerate_destinations',
                'member_cannot_configure_destination',
                'support_reads_redacted_destination_summary',
            ],
        },
    } as const
}
