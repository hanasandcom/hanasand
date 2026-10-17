import { organizationTenantIdentity } from '../identity.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWatchlistAlertTermsExport, OrganizationWatchlistAlertGenerationContract } from '../types.ts'
import type { OrganizationWebhookDestinationAccessDecision } from '../contracts/webhookDestinationAccess.ts'
import type { buildOrganizationActiveWatchlistTerms } from './exportProjections.ts'
import { organizationWebhookRequiredAlertFields, organizationWebhookRequiredDestinationFields } from './webhookDeliveryFields.ts'

import { organizationWatchlistMatchProjection, organizationWatchlistMatchProvenanceHash } from './generationReferences.ts'


export function buildWebhookDeliveryConsumer(input: {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    ownership: OrganizationWatchlistAlertTermsExport['webhookDestinationOwnership']
    canManageWebhookDestinations: boolean
    activeTerms: ReturnType<typeof buildOrganizationActiveWatchlistTerms>
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    integrationGuardrails: OrganizationWatchlistAlertTermsExport['sharedWatchlistIntegrationGuardrails']
    deliveryBlockerCodes: string[]
}): Pick<OrganizationWebhookDestinationAccessDecision, 'alertDeliveryReadiness' | 'deliveryConsumerReceipt'> {
    const organizationId = input.organizationId
    const member = input.member
    const webhookDestinationOwnership = input.ownership
    const canManageWebhookDestinations = input.canManageWebhookDestinations
    const activeTerms = input.activeTerms
    const alertGeneration = input.alertGeneration
    const sharedWatchlistIntegrationGuardrails = input.integrationGuardrails
    const deliveryBlockerCodes = input.deliveryBlockerCodes
    const activeMemberActor = () => ({ userId: member.userId, role: member.role, status: 'active' as const })
    return {
        alertDeliveryReadiness: {
            schemaVersion: 'organization.webhook_alert_delivery_readiness.v1',
            ...organizationTenantIdentity(organizationId, organizationId),
            sourceFamily: 'organization_watchlist',
            route: webhookDestinationOwnership.route,
            eventType: webhookDestinationOwnership.eventType,
            actor: activeMemberActor(),
            watchlistScope: {
                watchlistItemIds: activeTerms.map(term => term.watchlistItemId),
                alertGeneratorKeys: activeTerms.map(term => term.alertGeneratorKey),
                provenanceHashes: activeTerms.map(term => organizationWatchlistMatchProvenanceHash(term)),
                crossOrgDeliveryAllowed: false,
            },
            workflowState: {
                alertGenerationReady: alertGeneration.canGenerateAlerts,
                caseReplayReady: sharedWatchlistIntegrationGuardrails.caseSafety.ok,
                destinationDeliveryReady: webhookDestinationOwnership.blockerCodes.length === 0,
                dryRunReady: canManageWebhookDestinations,
            },
            deliveryContract: {
                selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
                selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
                requiredAlertFields: [...organizationWebhookRequiredAlertFields],
                requiredDestinationFields: [...organizationWebhookRequiredDestinationFields],
                idempotencyKeyFields: webhookDestinationOwnership.idempotency.keyFields,
            },
            roleGates: {
                automaticDelivery: ['owner', 'admin', 'editor'],
                manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles,
                readDeliverySummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            },
            blockerCodes: [...deliveryBlockerCodes],
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
            ],
        },
        deliveryConsumerReceipt: {
            schemaVersion: 'organization.webhook_destination_delivery_consumer.v1',
            ...organizationTenantIdentity(organizationId, organizationId),
            route: webhookDestinationOwnership.route,
            eventType: webhookDestinationOwnership.eventType,
            actor: activeMemberActor(),
            readyForDelivery: alertGeneration.canGenerateAlerts
            && sharedWatchlistIntegrationGuardrails.caseSafety.ok
            && webhookDestinationOwnership.blockerCodes.length === 0
            && canManageWebhookDestinations,
            destinationDeliveryReady: webhookDestinationOwnership.blockerCodes.length === 0,
            dryRunReady: canManageWebhookDestinations,
            blockerReason: deliveryBlockerCodes[0] ?? null,
            roleGates: {
                automaticDelivery: ['owner', 'admin', 'editor'],
                manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles,
                readDeliverySummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            },
            destinationScope: {
                selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
                selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
                crossOrgDestinationAllowed: false,
                nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration,
            },
            watchlistMatches: activeTerms.map(term => {
                const provenanceHash = organizationWatchlistMatchProvenanceHash(term)
                const matchProjection = organizationWatchlistMatchProjection(term, member)

                return {
                    ...organizationTenantIdentity(term.organizationId, term.tenantId),
                    watchlistId: term.watchlistItemId,
                    watchlistItemId: term.watchlistItemId,
                    watchedEntity: matchProjection.watchedEntity,
                    matchReason: {
                        kind: 'shared_watchlist_term' as const,
                        code: 'organization_watchlist_term_match' as const,
                    },
                    actorRef: matchProjection.actorRef,
                    sourceRefs: matchProjection.sourceRefs,
                    provenanceHash,
                    workflowStatus: deliveryBlockerCodes.length === 0 ? 'ready_for_delivery' as const : 'blocked' as const,
                    destinationReadiness: {
                        destinationDeliveryReady: webhookDestinationOwnership.blockerCodes.length === 0,
                        dryRunReady: canManageWebhookDestinations,
                        selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
                        selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
                        blockerReason: deliveryBlockerCodes[0] ?? null,
                    },
                }
            }),
            lifecycleBlockers: [
                'org_archived',
                'org_deleted',
                'member_revoked',
                'watchlist_paused',
                'watchlist_archived',
                'manual_webhook_selection_required',
                'role_not_allowed',
            ],
            blockerCodes: [...deliveryBlockerCodes],
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
                'otherOrg.alertGeneratorKeys',
                'case.evidence.rawContent',
            ],
        },
    }
}
