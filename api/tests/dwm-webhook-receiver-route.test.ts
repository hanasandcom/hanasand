import { afterEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { canonicalJson } from '../src/utils/dwm/customerOutputSafety.ts'
import { signDwmWebhookDeliveryBody } from '../src/utils/dwm/webhookTransport.ts'

const receiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
const databaseCalls: Array<{ sql: string, params: unknown[] }> = []
const receiverAuditRows: Array<Record<string, unknown>> = []

async function run(sql: string, params: unknown[] = []) {
    databaseCalls.push({ sql, params })
    if (!sql.includes('receiver.accepted')) return { rows: [] }

    const row = {
        id: params[0],
        owner_id: 'owner_receiver_test',
        actor_id: null,
        org_id: params[1],
        destination_id: params[2],
        delivery_id: null,
        action: 'receiver.accepted',
        metadata: JSON.parse(String(params[3])),
        created_at: '2026-10-16T10:00:00.000Z',
    }
    receiverAuditRows.push(row)
    return { rows: [row] }
}

mock.module('#db', () => ({
    default: run,
    identityQueryOnce: run,
    queryOnce: run,
    isTransientDatabaseError: () => false,
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    withIdentityAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    withTransaction: async (work: (query: typeof run) => Promise<unknown>) => work(run),
    withIdentityTransaction: async (work: (query: typeof run) => Promise<unknown>) => work(run),
}))

const { postDwmWebhookReceiver } = await import('../src/handlers/dwm/webhooks.ts')

afterEach(() => {
    databaseCalls.length = 0
    receiverAuditRows.length = 0
})

test('requires the service token before persisting receiver receipts', async () => {
    const previousToken = process.env.TI_SCRAPER_SERVICE_TOKEN
    const previousReceiverUrls = process.env.DWM_CONTROLLED_RECEIVER_URLS
    process.env.TI_SCRAPER_SERVICE_TOKEN = 'route-service-token'
    process.env.DWM_CONTROLLED_RECEIVER_URLS = receiverUrl

    const app = Fastify()
    app.post('/dwm/webhook-receiver', postDwmWebhookReceiver)
    const envelope = signedEnvelope()

    try {
        const missingToken = await app.inject({ method: 'POST', url: '/dwm/webhook-receiver', payload: envelope })
        expect(missingToken.statusCode).toBe(401)
        expect(missingToken.json()).toEqual({ error: 'Unauthorized.' })
        expect(databaseCalls).toHaveLength(0)

        const incorrectToken = await app.inject({
            method: 'POST',
            url: '/dwm/webhook-receiver',
            headers: { 'x-hanasand-service-token': 'incorrect-token' },
            payload: envelope,
        })
        expect(incorrectToken.statusCode).toBe(401)
        expect(incorrectToken.json()).toEqual({ error: 'Unauthorized.' })
        expect(databaseCalls).toHaveLength(0)

        const accepted = await app.inject({
            method: 'POST',
            url: '/dwm/webhook-receiver',
            headers: { 'x-hanasand-service-token': 'route-service-token' },
            payload: envelope,
        })
        expect(accepted.statusCode).toBe(201)
        expect(accepted.json()).toMatchObject({
            accepted: true,
            created: true,
            receipt: {
                orgId: 'org_receiver_test',
                destinationId: 'destination_receiver_test',
                payloadDeliveryId: 'delivery_receiver_test',
                eventType: 'dwm.alert.updated',
            },
        })
        expect(databaseCalls).toHaveLength(1)
        expect(databaseCalls[0]?.sql).toContain('INSERT INTO dwm_webhook_audit_events')
        expect(receiverAuditRows).toHaveLength(1)
    } finally {
        await app.close()
        if (previousToken === undefined) delete process.env.TI_SCRAPER_SERVICE_TOKEN
        else process.env.TI_SCRAPER_SERVICE_TOKEN = previousToken
        if (previousReceiverUrls === undefined) delete process.env.DWM_CONTROLLED_RECEIVER_URLS
        else process.env.DWM_CONTROLLED_RECEIVER_URLS = previousReceiverUrls
    }
})

function signedEnvelope() {
    const payload = {
        _hanasand: {
            schemaVersion: 'dwm.webhook.v1',
            idempotencyKey: 'dwm.alert.updated:org_receiver_test:destination_receiver_test:dedupe_receiver_test',
            eventType: 'dwm.alert.updated',
            org: { id: 'org_receiver_test' },
            destination: { id: 'destination_receiver_test' },
            delivery: { id: 'delivery_receiver_test' },
            alert: { id: 'alert_receiver_test' },
        },
    }
    const payloadBody = canonicalJson(payload)

    return {
        payload,
        payloadBody,
        receivedAt: '2026-10-16T10:00:00.000Z',
        signature: signDwmWebhookDeliveryBody(payloadBody, receiverUrl, process.env.TI_SCRAPER_SERVICE_TOKEN),
    }
}
