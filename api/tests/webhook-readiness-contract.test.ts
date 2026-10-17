import { expect, test } from 'bun:test'
import { dwmBridge, organizationBridge, organizationReadiness } from './webhook-destination-readiness-bridge.fixtures.ts'
import type { OrganizationReadinessProof } from '../src/utils/organizations.ts'

test('organization and DWM readiness bridges share ordered contract fields', () => {
    const organization = organizationBridge()
    const dwm = dwmBridge()

    expect(Object.keys(organization)).toEqual([
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'defaultWebhookPolicy',
        'canUseDefaultDestinations', 'selectedDestinationSource', 'requiredDestinationOrgId',
        'selectedDestinationOrgField', 'selectedDestinationIdField', 'ownerAdminManualTriggerRequired',
        'memberManualTriggerAllowed', 'requiredAlertFields', 'expectedDeliveryFields',
        'skippedDestinationReasons', 'lifecycleBlockers', 'blockerCodes', 'nonmemberDestinationEnumeration',
    ])
    expect(Object.keys(dwm)).toEqual([
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'noNetwork', 'ready',
        'defaultWebhookPolicy', 'canUseDefaultDestinations', 'selectedDestinationSource',
        'requiredDestinationOrgId', 'selectedDestinationOrgField', 'selectedDestinationIdField',
        'ownerAdminManualTriggerRequired', 'memberManualTriggerAllowed', 'requiredAlertFields',
        'expectedDeliveryFields', 'selectedDestination', 'skippedDestinationReasons', 'lifecycleBlockers',
        'blockerCodes', 'nonmemberDestinationEnumeration', 'retry', 'idempotency', 'redaction',
    ])
    for (const field of [
        'schemaVersion', 'deliveryContractSchema', 'sourceContract', 'route', 'selectedDestinationOrgField',
        'selectedDestinationIdField', 'ownerAdminManualTriggerRequired', 'memberManualTriggerAllowed',
        'requiredAlertFields', 'expectedDeliveryFields', 'skippedDestinationReasons', 'lifecycleBlockers',
        'nonmemberDestinationEnumeration',
    ] as const) {
        expect(dwm[field]).toEqual(organization[field])
    }
    expect(organization).toMatchObject({
        defaultWebhookPolicy: 'manual_selection',
        canUseDefaultDestinations: false,
        selectedDestinationSource: 'manual_selection_required',
        requiredDestinationOrgId: 'org_1',
    })
    expect(dwm).toMatchObject({
        noNetwork: true,
        ready: true,
        defaultWebhookPolicy: 'manual_selection',
        canUseDefaultDestinations: false,
        selectedDestinationSource: 'manual_selection',
        requiredDestinationOrgId: 'org_1',
        selectedDestination: { id: 'destination_1', orgId: 'org_1', endpointExposed: false },
        retry: { retryable: false, attemptCount: 1 },
        idempotency: { key: 'dwm.alert.updated:org_1:destination_1:case_1', dedupeKey: 'case_1' },
        redaction: { safeForCustomerDisplay: true, endpointExposed: false, webhookSecretExposed: false },
    })
})

test('organization readiness proof keeps its stable top-level response shape', () => {
    const readiness: OrganizationReadinessProof = organizationReadiness()

    expect(Object.keys(readiness)).toEqual([
        'schemaVersion', 'organizationId', 'tenantId', 'actor', 'counts', 'readiness', 'routes',
        'worker3Proof', 'alertQueueProof', 'caseAssignmentProof', 'webhookDeliveryProof',
        'destinationOwnershipProof', 'memberLifecycleProof', 'inviteLifecycleProof',
        'lifecycleCleanupProof', 'tenMemberWorkspaceProof', 'alertGenerationHandoff', 'uiProof',
        'cleanupProof', 'customerWorkflowProof', 'auditTimelineProof', 'blockers',
    ])
    expect(readiness.schemaVersion).toBe('organization.worker3_ui_readiness_proof.v1')
    const requiredQueryFields: ['organizationId'] = readiness.alertQueueProof.requiredQueryFields
    const replayRoute: 'POST /v1/dwm/alerts/:id/replay' = readiness.alertQueueProof.routes.replay
    expect(requiredQueryFields).toEqual(['organizationId'])
    expect(replayRoute).toBe('POST /v1/dwm/alerts/:id/replay')

    const nestedFields = readiness.alertQueueProof.expectedVisibilityFields
    const originalNestedFields = [...nestedFields]
    nestedFields.push('temporary.mutable-field')
    expect(nestedFields).toContain('temporary.mutable-field')
    nestedFields.pop()
    expect(nestedFields).toEqual(originalNestedFields)
})
