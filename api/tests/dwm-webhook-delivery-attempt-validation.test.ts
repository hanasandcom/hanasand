import { expect, test } from 'bun:test'
import { buildDwmWebhookDeliveryAttemptContract } from '../src/utils/dwm/webhooks.ts'
import { input } from './fixtures/dwm-webhook-delivery-attempt.ts'

test('delivery attempt contracts reject malformed, cross-org, and unsupported targets', () => {
    const missing = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input: {
            orgId: '',
            eventType: 'dwm.alert.created',
            alert: {
                id: '',
                title: '',
                severity: '',
                sourceFamily: '',
                evidence: [],
                provenance: {},
                watchlist: {},
                dedupeKey: '',
                casePath: '',
            },
            dryRun: true,
        },
        destinations: [],
    })
    expect(missing.ok).toBe(false)
    expect(missing.blockers.map(item => item.code)).toContain('missing_alert_title')
    expect(missing.blockers.map(item => item.code)).toContain('missing_destination')
    expect(missing.payloadContract.missingRequired).toContain('orgId')
    expect(missing.payloadContract.missingRequired).toContain('title')
    expect(missing.payloadContract.missingRequired).toContain('dedupeKey')
    expect(missing.requiredFields).toEqual({
        orgId: false,
        destinationId: false,
        alertId: false,
        watchlistId: false,
        severity: false,
        title: false,
        sourceFamily: false,
        evidence: false,
        provenance: false,
        timestamp: false,
        link: true,
        dedupeKey: false,
    })
    expect(missing.requiredFields).toEqual(Object.fromEntries(
        missing.payloadContract.required.map(field => [field.key, field.present]),
    ))

    const wrongOrg = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input,
        destinations: [{
            id: 'destination_wrong_org_contract',
            org_id: 'org_wrong',
            name: 'Wrong org Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        }],
    })
    expect(wrongOrg.ok).toBe(false)
    expect(wrongOrg.destinationSelection.skippedDestinations.some(item => item.reason === 'org_mismatch')).toBe(true)
    expect(wrongOrg.attempts.every(item => item.orgId === 'org_contract' && item.destinationId !== 'destination_wrong_org_contract')).toBe(true)

    const unsupported = buildDwmWebhookDeliveryAttemptContract({
        ownerId: 'owner_contract',
        input,
        destinations: [{
            id: 'destination_unsupported_contract',
            org_id: 'org_contract',
            name: 'Email destination',
            kind: 'email',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        } as never],
    })
    expect(unsupported.ok).toBe(false)
    expect(unsupported.blockers.some(item => item.code === 'unsupported_destination_type')).toBe(true)
    expect(unsupported.attempts[0]?.redactedDestination.endpointExposed).toBe(false)
})
