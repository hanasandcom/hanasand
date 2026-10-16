import { expect, test } from 'bun:test'
import {
    buildDwmWebhookDeliveryAuditTrail,
    buildDwmWebhookDeliveryReadinessConsumerProof,
    buildDwmWebhookDeliveryReplayGuard,
    buildDwmWebhookDeliveryReceipts,
    buildDwmWebhookDeliveryRetryQueue,
    buildDwmWebhookCustomerSetupProof,
    buildDwmWebhookDestinationAdminProof,
    buildDwmWebhookDestinationDeliveryMatrix,
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

test('destination and audit views preserve their permission-specific access fields', () => {
    const visibility = { role: 'admin' as const, status: 'active' as const, userActive: true as const, alertVisibilityPolicy: 'members' as const }
    const input = { destinations: [], deliveries: [], auditEvents: [], viewerRole: 'admin', canManage: true, visibility }

    expect(buildDwmWebhookDestinationDeliveryMatrix(input).access).toEqual({
        role: 'admin', canRead: true, canManage: true, canTest: true, canRetry: true, memberSafe: false,
    })
    expect(buildDwmWebhookDeliveryAuditTrail(input).access).toEqual({
        role: 'admin', canRead: true, canManage: true, memberSafe: false,
    })
    expect(buildDwmWebhookCustomerSetupProof(input).access).toEqual({
        role: 'admin', canRead: true, canCreate: true, canUpdate: true, canTest: true, canDelete: true, canDeliver: true, memberSafe: false,
    })
    expect(buildDwmWebhookDestinationAdminProof(input).access).toEqual({
        role: 'admin', canRead: true, canManage: true, canTest: true, canRetry: true, memberSafe: false,
    })
    expect(buildDwmWebhookDeliveryReplayGuard(input).access).toEqual({
        role: 'admin', canRead: true, canManage: true, canReplay: true, memberSafe: false,
    })

    const deniedInput = {
        ...input,
        visibility: { role: 'reader' as const, status: 'active' as const, userActive: true as const, alertVisibilityPolicy: 'admins' as const },
    }
    expect(buildDwmWebhookDestinationDeliveryMatrix(deniedInput).access).toEqual({
        role: 'admin', canRead: false, canManage: false, canTest: false, canRetry: false, memberSafe: false,
    })
    expect(buildDwmWebhookDeliveryAuditTrail(deniedInput).access).toEqual({
        role: 'admin', canRead: false, canManage: false, memberSafe: false,
    })
    expect(buildDwmWebhookCustomerSetupProof(deniedInput).access).toEqual({
        role: 'admin', canRead: false, canCreate: false, canUpdate: false, canTest: false, canDelete: false, canDeliver: false, memberSafe: false,
    })
    expect(buildDwmWebhookDestinationAdminProof(deniedInput).access).toEqual({
        role: 'admin', canRead: false, canManage: false, canTest: false, canRetry: false, memberSafe: false,
    })
    expect(buildDwmWebhookDeliveryReplayGuard(deniedInput).access).toEqual({
        role: 'admin', canRead: false, canManage: false, canReplay: false, memberSafe: false,
    })
})
