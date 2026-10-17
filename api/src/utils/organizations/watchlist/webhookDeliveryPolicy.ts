import { organizationTenantIdentity } from '../identity.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../types.ts'
import type { OrganizationWebhookDestinationAccessDecision } from '../contracts/webhookDestinationAccess.ts'
import { organizationWebhookRequiredAlertFields, organizationWebhookRequiredDestinationFields } from './webhookDeliveryFields.ts'


export function buildWebhookDeliveryPolicy(input: {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    ownership: OrganizationWatchlistAlertTermsExport['webhookDestinationOwnership']
    canManageWebhookDestinations: boolean
}): Pick<OrganizationWebhookDestinationAccessDecision, 'allowedActions' | 'roleGates' | 'denialReason' | 'blockerCodes' | 'requiredAlertFields' | 'requiredDeliveryFields' | 'deliveryInputReceipt' | 'dryRunReceipt'> {
    const organizationId = input.organizationId
    const member = input.member
    const webhookDestinationOwnership = input.ownership
    const canManageWebhookDestinations = input.canManageWebhookDestinations
    const activeMemberActor = () => ({ userId: member.userId, role: member.role, status: 'active' as const })
    const webhookDestinationScope = () => ({ requiredDestinationOrgId: webhookDestinationOwnership.requiredDestinationOrgId, selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField, selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField, crossOrgDestinationAllowed: false as const, nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration })
    return {
        allowedActions: {
            automaticDelivery: webhookDestinationOwnership.roleGates.automaticDeliveryAllowed,
            manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowed,
            configureDestination: canManageWebhookDestinations,
            readDeliverySummary: true,
        },
        roleGates: {
            automaticDelivery: ['owner', 'admin', 'editor'],
            manualTrigger: webhookDestinationOwnership.roleGates.manualTriggerAllowedRoles,
            configureDestination: ['owner', 'admin', 'editor'],
            readDeliverySummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
        denialReason: webhookDestinationOwnership.roleGates.denialReason ?? (canManageWebhookDestinations ? null : 'role_not_allowed'),
        blockerCodes: Array.from(new Set([
            ...webhookDestinationOwnership.blockerCodes,
            ...(canManageWebhookDestinations ? [] : ['role_not_allowed']),
        ])),
        requiredAlertFields: webhookDestinationOwnership.requiredAlertFields,
        requiredDeliveryFields: webhookDestinationOwnership.requiredDeliveryFields,
        deliveryInputReceipt: {
            schemaVersion: 'organization.webhook_destination_delivery_input.v1',
            ...organizationTenantIdentity(organizationId, organizationId),
            route: webhookDestinationOwnership.route,
            eventType: webhookDestinationOwnership.eventType,
            requiredAlertFields: [...organizationWebhookRequiredAlertFields],
            requiredDestinationFields: [...organizationWebhookRequiredDestinationFields],
            selectedDestinationOrgField: webhookDestinationOwnership.selectedDestinationOrgField,
            selectedDestinationIdField: webhookDestinationOwnership.selectedDestinationIdField,
            idempotencyKeyFields: webhookDestinationOwnership.idempotency.keyFields,
            lifecycleBlockers: Array.from(new Set([
                'org_archived',
                'org_deleted',
                'member_revoked',
                'manual_webhook_selection_required',
            ])),
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: webhookDestinationOwnership.nonmemberDestinationEnumeration,
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
            ],
        },
        dryRunReceipt: {
            schemaVersion: 'organization.webhook_destination_dry_run_visibility.v1',
            ...organizationTenantIdentity(organizationId, organizationId),
            route: webhookDestinationOwnership.route,
            eventType: webhookDestinationOwnership.eventType,
            actor: activeMemberActor(),
            allowed: canManageWebhookDestinations,
            allowedRoles: ['owner', 'admin', 'editor'],
            summaryVisibleRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            deniedRoles: ['reader', 'member', 'viewer'],
            denialReason: canManageWebhookDestinations
                ? (webhookDestinationOwnership.blockerCodes.includes('manual_webhook_selection_required') ? 'manual_webhook_selection_required' : null)
                : 'role_not_allowed',
            destinationScope: webhookDestinationScope(),
            readiness: {
                destinationDeliveryReady: webhookDestinationOwnership.blockerCodes.length === 0,
                dryRunAllowed: canManageWebhookDestinations,
                manualSelectionRequired: webhookDestinationOwnership.blockerCodes.includes('manual_webhook_selection_required'),
                blockerCodes: Array.from(new Set([
                    ...webhookDestinationOwnership.blockerCodes,
                    ...(canManageWebhookDestinations ? [] : ['role_not_allowed']),
                ])),
            },
            requiredAlertFields: [...organizationWebhookRequiredAlertFields],
            requiredDestinationFields: [...organizationWebhookRequiredDestinationFields],
            noLeakFields: [
                'destination.secret',
                'destination.endpoint',
                'otherOrg.destinationIds',
                'otherOrg.alertGeneratorKeys',
            ],
        },
    }
}
