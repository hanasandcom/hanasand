import { expect, test } from 'bun:test'
import { destination, payload } from './fixtures/dwm-webhook-delivery-projection.ts'
import {
    buildDwmAlertWebhookReadinessHandoff,
    buildDwmOrgAlertWebhookDeliveryContract,
    buildDwmOrgAlertWebhookDeliveryOutcome,
    buildDwmWebhookDeliveryRetryContract,
    buildDwmWebhookDestinationReadModels,
} from '../src/utils/dwm/webhooks.ts'

test('organization delivery contracts select only eligible destination rows', () => {
    const destinations = [
        destination,
        { ...destination, id: 'destination_unsubscribed', events: ['dwm.alert.created'] },
        { ...destination, id: 'destination_paused', status: 'paused' as const },
        { ...destination, id: 'destination_other_org', orgId: 'org_2' },
        { ...destination, id: 'destination_legacy_org', orgId: ' org_1 ' },
    ]
    const input = {
        orgId: 'org_1',
        destinationId: 'destination_1',
        eventType: 'dwm.alert.updated' as const,
        alert: payload.alert,
    }
    const common = { ownerId: 'owner_1', input, destinations, deliveries: [], auditEvents: [], liveDeliveryEnabled: false }
    const retry = buildDwmWebhookDeliveryRetryContract({ ...common, canManage: true })
    const contract = buildDwmOrgAlertWebhookDeliveryContract({ ...common, viewerRole: 'owner', canManage: true })
    const destinationReadModels = buildDwmWebhookDestinationReadModels({ ...common, viewerRole: 'owner', canManage: true })
    const outcome = buildDwmOrgAlertWebhookDeliveryOutcome(common)
    const readiness = buildDwmAlertWebhookReadinessHandoff(common)
    const skipped = [
        { id: 'destination_unsubscribed', reason: 'event_not_subscribed' },
        { id: 'destination_paused', reason: 'disabled' },
        { id: 'destination_other_org', reason: 'org_mismatch' },
        { id: 'destination_legacy_org', reason: 'org_mismatch' },
    ]

    expect(contract.destinationHealth).toEqual(destinationReadModels.destinationHealth)
    expect(contract.destinationLifecycle).toEqual(destinationReadModels.destinationLifecycle)
    expect(contract.destinationAdminProof).toEqual(destinationReadModels.destinationAdminProof)
    expect(retry.destinationSelection).toMatchObject({ selectedDestinationIds: ['destination_1'], skippedDestinations: skipped })
    expect(contract.destinationSelection.selectedDestinations.map(row => row.id)).toEqual(['destination_1'])
    expect(contract.destinationSelection.skippedDestinations).toMatchObject(skipped)

    const expectedFilters = {
        orgId: 'org_1',
        destinationId: 'destination_1',
        alertId: 'alert_1',
        casePath: '/dwm?alert=alert_1',
        dedupeKey: 'case_1',
    }
    expect(contract.deliveryTimeline.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryActionPlan.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryReplayGuard.filters).toMatchObject(expectedFilters)
    expect(contract.deliveryReadinessConsumer.filters).toMatchObject(expectedFilters)
    expect(outcome.selectedDestinations.map(row => row.destinationId)).toEqual(['destination_1'])
    expect(outcome.skippedDestinations.map(row => [row.destinationId, row.reason])).toEqual([
        ['destination_unsubscribed', 'event_not_subscribed'],
        ['destination_paused', 'disabled'],
        ['destination_other_org', 'org_mismatch'],
        ['destination_legacy_org', 'org_mismatch'],
    ])
    expect(readiness.destinationSelection).toMatchObject({ selectedDestinationIds: ['destination_1'], skippedDestinations: skipped })
})
