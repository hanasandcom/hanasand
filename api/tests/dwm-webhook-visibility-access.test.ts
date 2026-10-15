import { expect, test } from 'bun:test'
import {
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryRetryQueue,
} from '../src/utils/dwm/webhooks.ts'

function deliveryAccess(visibility: { role: 'reader' | 'admin', status: 'active', userActive: true, alertVisibilityPolicy: 'admins' | 'members' }, viewerRole: string, canManage: boolean) {
    const input = {
        deliveries: [],
        auditEvents: [],
        destinations: [],
        filters: {},
        visibility,
        viewerRole,
        canManage,
    }

    return [
        buildDwmWebhookDeliveryReadinessConsumerProof(input).access,
        buildDwmWebhookDeliveryReceipts(input).access,
        buildDwmWebhookDeliveryRetryQueue(input).access,
    ]
}

test('DWM delivery read and retry views share the same visibility-gated access', () => {
    expect(deliveryAccess({
        role: 'reader',
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: 'admins',
    }, 'admin', true)).toEqual(Array(3).fill({
        role: 'admin',
        canRead: false,
        canManage: false,
        canRetry: false,
        memberSafe: false,
    }))

    expect(deliveryAccess({
        role: 'reader',
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: 'members',
    }, 'reader', false)).toEqual(Array(3).fill({
        role: 'reader',
        canRead: true,
        canManage: false,
        canRetry: false,
        memberSafe: true,
    }))

    expect(deliveryAccess({
        role: 'admin',
        status: 'active',
        userActive: true,
        alertVisibilityPolicy: 'admins',
    }, 'admin', true)).toEqual(Array(3).fill({
        role: 'admin',
        canRead: true,
        canManage: true,
        canRetry: true,
        memberSafe: false,
    }))
})
