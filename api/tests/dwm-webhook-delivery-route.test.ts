import { afterEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { roleCanEditOrganization } from '../src/utils/organizationRoles.ts'
import * as webhookUtils from '../src/utils/dwm/webhooks.ts'

let authenticatedUser: { valid: boolean, id?: string } = { valid: true, id: 'user_1' }
let organizationMembership: Record<string, unknown> | null = {
    role: 'admin',
    organization_status: 'active',
    privacy_deletion_run_id: null,
}
const databaseQueries: Array<{ sql: string, params: unknown[] }> = []
const retryCalls: Array<{ userId: string, orgId: string, deliveryId: string }> = []
let retryResult: Record<string, unknown> = {
    ok: true,
    delivery: {
        id: 'delivery_retry_1',
        alertId: 'alert_1',
        destinationId: 'destination_1',
        status: 'delivered',
        error: null,
    },
}

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        databaseQueries.push({ sql, params })
        if (sql.includes('FROM organization_members member')) {
            return { rows: organizationMembership ? [organizationMembership] : [] }
        }
        throw new Error(`Unexpected delivery route query: ${sql}`)
    },
}))

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async () => authenticatedUser,
}))

mock.module('#utils/organizations.ts', () => ({
    roleCanEditOrganization,
    organizationVisibilityDecision: () => ({ allowed: true, reason: null }),
}))

const readModel = () => ({ ok: true })
mock.module('#utils/dwm/webhooks.ts', () => ({
    ...webhookUtils,
    clean: (value: unknown) => typeof value === 'string' ? value.trim() : '',
    buildDwmWebhookDeliveryRequestInput: (input: Record<string, any>) => ({
        ...input,
        orgId: input.orgId || input.organizationId || input.tenantId,
    }),
    retryDwmWebhookDelivery: async (userId: string, orgId: string, deliveryId: string) => {
        retryCalls.push({ userId, orgId, deliveryId })
        return retryResult
    },
    listDwmWebhookDestinations: async () => [],
    listDwmWebhookDeliveries: async () => [],
    listDwmWebhookAuditEvents: async () => [],
    buildDwmWebhookDeliveryReadiness: readModel,
    buildDwmWebhookDestinationHealth: readModel,
    buildDwmWebhookDestinationLifecycle: readModel,
    buildDwmWebhookDestinationAdminProof: readModel,
    buildDwmWebhookDeliveryOperations: readModel,
    buildDwmWebhookDeliveryHistory: readModel,
    buildDwmWebhookDeliveryReadinessConsumerProof: readModel,
    buildDwmWebhookDeliveryPersistenceProof: readModel,
    buildDwmWebhookDeliveryAttemptContract: readModel,
    buildDwmWebhookDeliveryAttemptPersistenceProof: readModel,
    buildDwmWebhookDeliveryReceipts: readModel,
    buildDwmWebhookDeliveryTimeline: readModel,
    buildDwmWebhookDeliveryActionPlan: readModel,
    buildDwmWebhookDeliveryReplayGuard: readModel,
    buildDwmWebhookDeliveryRetryContract: readModel,
    buildDwmWebhookDeliveryRetryPersistence: readModel,
    buildDwmWebhookDeliveryRetryQueue: readModel,
    buildDwmWebhookDeliveryRetryRequestContract: readModel,
    buildDwmWebhookDeliveryRetryWorkOrders: readModel,
    buildDwmWebhookDestinationDeliveryMatrix: readModel,
    buildDwmWebhookDeliveryAuditTrail: readModel,
    buildDwmWebhookDashboardReadinessAdapter: readModel,
    buildDwmOrgAlertWebhookDeliveryContract: readModel,
    buildDwmWebhookAuditEventContracts: readModel,
}))

const { postDwmWebhookDelivery } = await import('../src/handlers/dwm/webhooks.ts')
const app = Fastify()
app.post('/dwm/webhook-deliveries', postDwmWebhookDelivery)

afterEach(() => {
    authenticatedUser = { valid: true, id: 'user_1' }
    organizationMembership = {
        role: 'admin',
        organization_status: 'active',
        privacy_deletion_run_id: null,
    }
    retryResult = {
        ok: true,
        delivery: {
            id: 'delivery_retry_1',
            alertId: 'alert_1',
            destinationId: 'destination_1',
            status: 'delivered',
            error: null,
        },
    }
    databaseQueries.length = 0
    retryCalls.length = 0
})

test('authorized organization member can retry a delivery through the public route', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
        deliveries: [{
            id: 'delivery_retry_1',
            alertId: 'alert_1',
            destinationId: 'destination_1',
            status: 'delivered',
        }],
    })
    expect(retryCalls).toEqual([{
        userId: 'user_1',
        orgId: 'org_1',
        deliveryId: 'delivery_failed_1',
    }])
    expect(databaseQueries).toHaveLength(1)
    expect(databaseQueries[0]?.params).toEqual(['org_1', 'user_1'])
})

test('unauthenticated delivery retry returns 401 before permission lookup or retry', async () => {
    authenticatedUser = { valid: false }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized.' })
    expect(databaseQueries).toHaveLength(0)
    expect(retryCalls).toHaveLength(0)
})

test('cross-organization delivery retry returns 404 before retry execution', async () => {
    organizationMembership = null

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_other', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Organization not found.' })
    expect(databaseQueries).toHaveLength(1)
    expect(databaseQueries[0]?.params).toEqual(['org_other', 'user_1'])
    expect(retryCalls).toHaveLength(0)
})

test('organization deletion blocks delivery retry with 409 before retry execution', async () => {
    organizationMembership = {
        role: 'admin',
        organization_status: 'active',
        privacy_deletion_run_id: 'deletion_run_1',
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Organization deletion is in progress; writes are blocked.' })
    expect(retryCalls).toHaveLength(0)
})

test('a non-editor organization member receives 403 before delivery retry', async () => {
    organizationMembership = {
        role: 'reader',
        organization_status: 'active',
        privacy_deletion_run_id: null,
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
        error: 'Only organization owners, admins, and editors can configure webhook destinations.',
    })
    expect(retryCalls).toHaveLength(0)
})

test('retry failures preserve the retry helper HTTP status, code, and due time', async () => {
    retryResult = {
        ok: false,
        status: 409,
        code: 'delivery_retry_not_ready',
        error: 'Delivery retry is not due yet.',
        nextRetryAt: '2099-07-23T10:01:00.000Z',
    }

    const response = await app.inject({
        method: 'POST',
        url: '/dwm/webhook-deliveries',
        payload: { orgId: 'org_1', deliveryId: 'delivery_failed_1' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
        error: 'Delivery retry is not due yet.',
        code: 'delivery_retry_not_ready',
        nextRetryAt: '2099-07-23T10:01:00.000Z',
    })
    expect(retryCalls).toHaveLength(1)
})
