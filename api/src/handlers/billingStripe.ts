import { applyStripeEvent } from './billingStripeEvents.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { withTransaction } from '#db'

type StripeEvent = { id: string, type?: string, data?: { object?: Record<string, unknown> } }

export async function receiveStripeWebhook(req: FastifyRequest, reply: FastifyReply) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return reply.status(503).send({ error: 'Stripe webhook is not configured.' })
    const previousSecret = process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    const signature = header(req.headers['stripe-signature'])
    const candidateSecrets = previousSecret ? [secret, previousSecret] : [secret]
    let signatureValid = false
    for (const candidate of candidateSecrets) signatureValid = verifyStripeSignature(rawBody, signature, candidate) || signatureValid
    if (!signatureValid) return reply.status(400).send({ error: 'Invalid Stripe signature.' })
    let event: StripeEvent
    try {
        event = JSON.parse(rawBody) as StripeEvent
    } catch {
        return reply.status(400).send({ error: 'Invalid Stripe event.' })
    }
    const eventType = event.type
    if (!event.id || !eventType || !event.data?.object) return reply.status(400).send({ error: 'Incomplete Stripe event.' })
    const outcome = await withTransaction(async query => {
        // Claim the event before applying it; a failed transaction remains retryable.
        const inserted = await query(`
            INSERT INTO stripe_webhook_events (event_id, event_type, payload)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING event_id
        `, [event.id, eventType, JSON.stringify({ id: event.id, type: eventType })])
        if (!inserted.rowCount) return { duplicate: true }
        const applied = await applyStripeEvent({ ...event, type: eventType }, query)
        // Retain only the event ID/type for deleted accounts, not their erased data.
        if (applied === false) return { ignored: true }
        await query('UPDATE stripe_webhook_events SET payload = $2::jsonb WHERE event_id = $1', [event.id, rawBody])
        return {}
    })
    return reply.send({ received: true, ...outcome })
}

export async function stripeRequest(path: string, secret: string, body: URLSearchParams) {
    const response = await fetch(`https://api.stripe.com${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    const payload = await response.json() as Record<string, unknown>
    return { ok: response.ok, payload }
}

export function verifyStripeSignature(payload: string, signature: string, secret: string, now = Math.floor(Date.now() / 1000)) {
    const parts = Object.fromEntries(signature.split(',').map(item => item.split('=')))
    const timestamp = Number(parts.t)
    const digest = parts.v1
    if (!Number.isFinite(timestamp) || !digest || Math.abs(now - timestamp) > 300) return false
    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    const actual = Buffer.from(digest, 'hex')
    const wanted = Buffer.from(expected, 'hex')
    return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

function header(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || '' : value || '' }
