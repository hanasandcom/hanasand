import { describe, expect, test } from 'bun:test'
import { destinationTestResponseOutcome, deliveryResponseOutcome, webhookOrganizationVisibilityContext } from '../src/handlers/dwm/webhooks.ts'
import { organizationVisibilityDecision } from '../src/utils/organizations.ts'

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
