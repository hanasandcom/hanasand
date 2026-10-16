import { afterEach, mock } from 'bun:test'
import Fastify from 'fastify'
import { roleCanEditOrganization } from '../../src/utils/organizationRoles.ts'
import * as webhookUtils from '../../src/utils/dwm/webhooks.ts'

type User = { valid: boolean, id?: string }
type RetryResult = Record<string, unknown>

export const state: {
    user: User
    membership: Record<string, unknown> | null
    retryResult: RetryResult
} = {
    user: { valid: true, id: 'user_1' },
    membership: { role: 'admin', organization_status: 'active', privacy_deletion_run_id: null },
    retryResult: {
        ok: true,
        delivery: {
            id: 'delivery_retry_1',
            alertId: 'alert_1',
            destinationId: 'destination_1',
            status: 'delivered',
            error: null,
        },
    },
}

export const databaseQueries: Array<{ sql: string, params: unknown[] }> = []
export const retryCalls: Array<{ userId: string, orgId: string, deliveryId: string }> = []

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        databaseQueries.push({ sql, params })
        if (sql.includes('FROM organization_members member')) {
            return { rows: state.membership ? [state.membership] : [] }
        }
        throw new Error(`Unexpected delivery route query: ${sql}`)
    },
}))

mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => state.user }))
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
        return state.retryResult
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

const { postDwmWebhookDelivery } = await import('../../src/handlers/dwm/webhooks.ts')
export const app = Fastify()
app.post('/dwm/webhook-deliveries', postDwmWebhookDelivery)

afterEach(() => {
    state.user = { valid: true, id: 'user_1' }
    state.membership = { role: 'admin', organization_status: 'active', privacy_deletion_run_id: null }
    state.retryResult = {
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
