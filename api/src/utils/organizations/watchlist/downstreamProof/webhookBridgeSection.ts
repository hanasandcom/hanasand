import type { DownstreamProofContext } from './context.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../../contracts/downstreamProof.ts'
import { organizationTenantIdentity } from '../../identity.ts'
import { organizationWebhookDeliveryEvidenceFields } from '../workflowContractFields.ts'

export function webhookBridgeSection(context: DownstreamProofContext): Pick<OrganizationSharedWatchlistDownstreamProof, 'webhookBridge'> {
    const { organization, downstreamAuthorization, webhookBlockers, webhookDeliveryAllowedByRole, webhookPolicy, selectedDestinationSource, webhookManualDenialReason } = context
    return {
        webhookBridge: {
            route: 'POST /v1/dwm/webhooks/deliver',
            defaultWebhookPolicy: downstreamAuthorization.downstream.webhook.defaultPolicy,
            canUseDefaultDestinations: downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
            deliveryContract: {
                schemaVersion: 'organization.watchlist_webhook_delivery_contract.v1',
                eventType: 'dwm.alert',
                ...organizationTenantIdentity(organization.id, organization.id),
                sourceFamily: 'organization_watchlist',
                destinationSelection: {
                    policy: webhookPolicy,
                    selectedDestinationSource,
                    requiredDestinationOrgId: organization.id,
                    selectedDestinationOrgField: 'destination.org_id',
                    selectedDestinationIdField: 'webhookDestinationIds[]',
                    skippedDestinationReasons: [
                        'org_mismatch',
                        'destination_disabled',
                        'event_not_subscribed',
                        'manual_selection_required',
                        'webhook_policy_disabled',
                    ],
                    nonmemberDestinationEnumeration: false,
                },
                roleGates: {
                    automaticDeliveryAllowed: downstreamAuthorization.downstream.webhook.canUseDefaultDestinations,
                    manualTriggerAllowed: webhookDeliveryAllowedByRole && downstreamAuthorization.organizationLifecycleState === 'active',
                    manualTriggerAllowedRoles: ['owner', 'admin', 'editor'],
                    memberManualTriggerAllowed: false,
                    denialReason: webhookManualDenialReason,
                },
                idempotency: {
                    scope: 'organization_destination_alert',
                    keyFields: ['eventType', 'organizationId', 'destinationId', 'alert.dedupeKey'],
                },
                requiredAlertFields: [
                    'alert.id',
                    'alert.organizationId',
                    'alert.tenantId',
                    'alert.dedupeKey',
                    'alert.watchlistItemIds',
                    'alert.casePath',
                ],
                requiredDeliveryFields: [
                    'deliveryId',
                    'organizationId',
                    'destinationId',
                    'eventType',
                    'status',
                    'idempotencyKey',
                ],
                evidenceFields: [...organizationWebhookDeliveryEvidenceFields],
                redactedFields: [
                    'destination.endpoint',
                    'destination.secret',
                    'activeTerms[].term',
                    'activeTerms[].value',
                ],
                blockerCodes: webhookBlockers,
            },
            expectedDeliveryFields: [
                'organizationId',
                'alertId',
                'webhookDestinationIds',
                'watchlistItemIds',
                'deliveryId',
                'casePath',
                'auditEventContracts',
            ],
            blockerCodes: webhookBlockers,
        },
    }
}
