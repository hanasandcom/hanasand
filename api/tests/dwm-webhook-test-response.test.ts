import { describe, expect, test } from 'bun:test'
import { buildDwmWebhookDestinationChangeResponse, buildDwmWebhookDestinationTestResponse, destinationTestResponseOutcome, deliveryResponseOutcome, webhookOrganizationVisibilityContext } from '../src/handlers/dwm/webhooks.ts'
import { organizationVisibilityDecision } from '../src/utils/organizations.ts'

function testDestination(id: string, endpointHash: string) {
    return {
        id,
        ownerId: 'owner_1',
        orgId: 'org_1',
        name: id === 'destination_1' ? 'Research receiver' : 'Other receiver',
        kind: 'webhook' as const,
        endpointHint: 'receiver.example/...',
        endpointHash,
        status: 'active' as const,
        events: ['dwm.alert.updated' as const],
        createdBy: 'owner_1',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-10-16T10:00:00.000Z',
        updatedAt: '2026-10-16T10:00:00.000Z',
        signingConfigured: false,
    }
}

function testDelivery(destinationId: string | null) {
    return {
        id: 'delivery_1',
        destinationId,
        ownerId: 'owner_1',
        orgId: 'org_1',
        alertId: 'alert_1',
        eventType: 'dwm.alert.test' as const,
        status: 'dry_run' as const,
        dryRun: true,
        endpointHint: 'receiver.example/...',
        endpointHash: 'endpoint_hash_1',
        payloadHash: 'payload_hash_1',
        payload: {},
        responseStatus: null,
        responseBody: null,
        error: null,
        errorClass: null,
        attemptCount: 1,
        nextRetryAt: null,
        idempotencyKey: 'dwm.alert.test:org_1:destination_1:webhook_test',
        watchlistId: null,
        watchlistName: null,
        route: null,
        casePath: null,
        attemptedAt: null,
        completedAt: null,
        deliveredAt: null,
        createdAt: '2026-10-16T10:00:00.000Z',
    }
}

describe('DWM webhook destination test response', () => {
    test('returns a failure response when the persisted test row failed', () => {
        expect(destinationTestResponseOutcome({ status: 'failed' })).toEqual({
            status: 502,
            failed: true,
            code: 'webhook_destination_test_failed',
            error: 'Webhook destination test failed.',
        })
        expect(destinationTestResponseOutcome({ status: 'delivered', error: 'transport failed' })).toMatchObject({ status: 502, failed: true, code: 'webhook_destination_test_failed' })
    })

    test('keeps accepted status for durable non-failed outcomes', () => {
        expect(destinationTestResponseOutcome({ status: 'dry_run' })).toEqual({ status: 202, failed: false })
        expect(destinationTestResponseOutcome({ status: 'delivered' })).toEqual({ status: 202, failed: false })
    })

    test('does not report a durable failed delivery as accepted', () => {
        expect(deliveryResponseOutcome([{ status: 'failed', error: 'receiver unavailable' }])).toEqual({
            status: 502,
            failed: true,
            code: 'webhook_delivery_failed',
            error: 'Webhook delivery failed.',
        })
        expect(deliveryResponseOutcome([{ status: 'dry_run' }, { status: 'skipped' }])).toEqual({ status: 202, failed: false })
        expect(deliveryResponseOutcome([{ status: 'skipped', error: 'Delivery selection skipped because the requested webhook destination was not found.' }])).toEqual({
            status: 502,
            failed: true,
            code: 'webhook_delivery_failed',
            error: 'Webhook delivery failed.',
        })
        expect(deliveryResponseOutcome([{ status: 'delivered' }])).toEqual({ status: 202, failed: false })
    })
})

describe('DWM webhook destination change response', () => {
    test('keeps the action, changed destination, and destination list together', () => {
        const destination = {
            id: 'destination_1',
            ownerId: 'owner_1',
            orgId: 'org_1',
            name: 'Research receiver',
            kind: 'webhook' as const,
            endpointHint: 'receiver.example/...',
            endpointHash: 'endpoint_hash_1',
            status: 'active' as const,
            events: ['dwm.alert.updated' as const],
            createdBy: 'owner_1',
            lastTestedAt: null,
            lastTestStatus: null,
            lastTestError: null,
            lastTestHttpStatus: null,
            lastDeliveryAt: null,
            createdAt: '2026-10-16T10:00:00.000Z',
            updatedAt: '2026-10-16T10:00:00.000Z',
            signingConfigured: false,
        }
        const otherDestination = { ...destination, id: 'destination_2', endpointHash: 'endpoint_hash_2' }
        const response = buildDwmWebhookDestinationChangeResponse({
            action: 'update',
            ownerId: 'owner_1',
            input: { orgId: 'org_1' },
            destination,
            destinations: [destination, otherDestination],
            deliveries: [],
            auditEvents: [],
        })

        expect(response.destination).toBe(destination)
        expect(response.destinationCrud).toMatchObject({ action: 'update', ownerId: 'owner_1', orgId: 'org_1' })
        expect(response.destinationContract).toMatchObject({ id: 'destination_1' })
        expect(response.destinationHealth).toMatchObject({ destinationId: 'destination_1' })
        expect(response.customerSetup.summary.destinationCount).toBe(2)
        expect(response.destinationLifecycle).toMatchObject({ destinationId: 'destination_1' })
        expect(response.destinationAdminProof.destinations).toHaveLength(1)
        expect(response.auditEventContracts).toEqual([])

        const testResponse = buildDwmWebhookDestinationChangeResponse({
            action: 'test',
            ownerId: 'owner_1',
            input: { orgId: 'org_1' },
            destination,
            destinations: [destination, otherDestination],
            deliveries: [],
            auditEvents: [],
            includeDestination: false,
        })
        expect(testResponse).not.toHaveProperty('destination')
        expect(testResponse.destinationCrud).toMatchObject({ action: 'test', ownerId: 'owner_1', orgId: 'org_1' })
        expect(testResponse.destinationContract).toMatchObject({ id: 'destination_1' })
        expect(testResponse.destinationHealth).toMatchObject({ destinationId: 'destination_1' })
        expect(testResponse.customerSetup.summary.destinationCount).toBe(2)
        expect(testResponse.destinationLifecycle).toMatchObject({ destinationId: 'destination_1' })
        expect(testResponse.destinationAdminProof.destinations).toHaveLength(1)
        expect(testResponse.auditEventContracts).toEqual([])

        const archivedDestination = { ...destination, status: 'archived' as const }
        const deleteResponse = buildDwmWebhookDestinationChangeResponse({
            action: 'delete',
            ownerId: 'owner_1',
            input: { orgId: 'org_1' },
            destination: archivedDestination,
            destinations: [archivedDestination, otherDestination],
            deliveries: [],
            auditEvents: [],
        })
        expect(deleteResponse.destinationCrud).toMatchObject({
            action: 'delete',
            orgId: 'org_1',
            destination: { id: 'destination_1', status: 'archived' },
        })
        expect(deleteResponse.customerSetup.deliveryReadiness.destinations.map(item => item.destinationId)).toEqual(['destination_1', 'destination_2'])
    })
})

describe('DWM webhook destination test response assembly', () => {
    test('preserves destination-specific contracts when the refreshed destination is present', () => {
        const destination = testDestination('destination_1', 'endpoint_hash_1')
        const destinations = [destination, testDestination('destination_2', 'endpoint_hash_2')]
        const delivery = testDelivery(destination.id)
        const response = buildDwmWebhookDestinationTestResponse({
            delivery,
            ownerId: 'owner_1',
            orgId: 'org_1',
            input: {},
            destination,
            destinations,
            deliveries: [delivery],
            auditEvents: [],
        })

        expect(response.preview.requestId).toBe('delivery_1')
        expect(response.destinationCrud).toMatchObject({ action: 'test', orgId: 'org_1' })
        expect(response.destinationTest).toMatchObject({ destinationId: 'destination_1' })
        expect(response.customerSetup.summary.destinationCount).toBe(2)
        expect(response.destinationLifecycle).toMatchObject({ destinationId: 'destination_1' })
        expect(response.destinationAdminProof.destinations).toHaveLength(1)
        expect(response).not.toHaveProperty('destination')
    })

    test('keeps whole-list fallback contracts when the refreshed destination is missing', () => {
        const destinations = [testDestination('destination_1', 'endpoint_hash_1'), testDestination('destination_2', 'endpoint_hash_2')]
        const delivery = testDelivery(null)
        const auditEvent = {
            id: 'audit_1',
            ownerId: 'owner_1',
            actorId: 'owner_1',
            orgId: 'org_1',
            destinationId: 'destination_2',
            deliveryId: null,
            action: 'destination.updated',
            metadata: {},
            createdAt: '2026-10-16T10:00:00.000Z',
        }
        const response = buildDwmWebhookDestinationTestResponse({
            delivery,
            ownerId: 'owner_1',
            orgId: 'org_1',
            input: {},
            destination: null,
            destinations,
            deliveries: [delivery],
            auditEvents: [auditEvent],
        })

        expect(response).toMatchObject({
            destinationCrud: null,
            destinationContract: null,
            destinationHealth: null,
            destinationTest: null,
            destinationLifecycle: null,
            destinationAdminProof: null,
        })
        expect(response.customerSetup.summary.destinationCount).toBe(2)
        expect(response.auditEventContracts[0]).toMatchObject({
            destinationId: 'destination_2',
            destination: {
                id: 'destination_2',
                label: 'Other receiver',
                redactedEndpoint: {
                    endpointHint: 'receiver.example/...',
                    endpointHash: 'endpoint_hash_2',
                },
            },
        })
        expect(response).not.toHaveProperty('destination')
    })
})

describe('DWM webhook organization visibility context', () => {
    test('keeps verified destination membership defaults and organization policy together', () => {
        const context = webhookOrganizationVisibilityContext('org-1', 'actor-1', {
            role: 'reader',
            alert_visibility_policy: 'admins',
        }, { membershipIsActive: true })

        expect(context).toEqual({
            role: 'reader',
            status: 'active',
            userActive: true,
            alertVisibilityPolicy: 'admins',
        })
        expect(organizationVisibilityDecision(context!).reason).toBe('role_not_allowed')
    })

    test('preserves live delivery membership status and self-scope behavior', () => {
        expect(webhookOrganizationVisibilityContext('org-1', 'actor-1', {
            role: 'reader',
            status: 'removed',
            user_active: false,
            alert_visibility_policy: 'members',
        })).toEqual({
            role: 'reader',
            status: 'removed',
            userActive: false,
            alertVisibilityPolicy: 'members',
        })
        expect(webhookOrganizationVisibilityContext('actor-1', 'actor-1', null)).toBeNull()
    })
})
