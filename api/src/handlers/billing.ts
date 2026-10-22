import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { stripeRequest } from './billingStripe.ts'

export { receiveStripeWebhook, verifyStripeSignature } from './billingStripe.ts'


export type BillingQuotaKey = 'searchesPerDay' | 'watchTerms' | 'monitoredTargets'
type BillingQuotaPeriod = 'day' | 'month' | 'lifetime'
type BillingQuota = { key: BillingQuotaKey, limit: number | null, used: number, remaining: number | null, periodStart: Date | null, resetsAt: Date | null }

const quotaPeriods: Record<BillingQuotaKey, BillingQuotaPeriod> = {
    searchesPerDay: 'day',
    watchTerms: 'lifetime',
    monitoredTargets: 'lifetime',
}

export async function getBillingQuota(userId: string, key: BillingQuotaKey): Promise<BillingQuota> {
    const storagePeriod = periodStartFor(quotaPeriods[key])
    const [entitlements, usage] = await Promise.all([
        run(`
            SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota
            FROM billing_entitlements
            WHERE user_id = $1 AND active IS TRUE AND quotas ? $2
        `, [userId, key]),
        run('SELECT used FROM billing_usage WHERE user_id = $1 AND quota_key = $2 AND period_start = $3', [userId, key, storagePeriod]),
    ])
    const limit = Number(entitlements.rows[0]?.quota || 0) || null
    const used = Number(usage.rows[0]?.used || 0)
    return { key, limit, used, remaining: limit === null ? null : Math.max(0, limit - used), periodStart: quotaPeriods[key] === 'lifetime' ? null : storagePeriod, resetsAt: resetAtFor(quotaPeriods[key]) }
}

export async function consumeBillingQuota(userId: string, key: BillingQuotaKey, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Quota amount must be a positive integer.')
    const period = quotaPeriods[key]
    const periodStart = periodStartFor(period)
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`billing:${userId}:${key}:${periodStart?.toISOString() || 'lifetime'}`])
        const entitlements = await query(`
            SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota
            FROM billing_entitlements WHERE user_id = $1 AND active IS TRUE AND quotas ? $2
        `, [userId, key])
        const limit = Number(entitlements.rows[0]?.quota || 0) || null
        const current = await query('SELECT used FROM billing_usage WHERE user_id = $1 AND quota_key = $2 AND period_start = $3 FOR UPDATE', [userId, key, periodStart])
        const used = Number(current.rows[0]?.used || 0)
        const allowed = limit !== null && used + amount <= limit
        if (allowed) {
            await query(`
                INSERT INTO billing_usage (user_id, quota_key, period_start, used) VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, quota_key, period_start) DO UPDATE SET used = EXCLUDED.used, updated_at = NOW()
            `, [userId, key, periodStart, used + amount])
        }
        return { key, limit, used: allowed ? used + amount : used, remaining: limit === null ? null : Math.max(0, limit - (allowed ? used + amount : used)), periodStart: period === 'lifetime' ? null : periodStart, resetsAt: resetAtFor(period), allowed, subscriptionRequired: limit === null }
    })
}

export async function checkBillingCapacity(userId: string, key: BillingQuotaKey, used: number) {
    const quota = await getBillingQuota(userId, key)
    return { ...quota, allowed: quota.limit !== null && used < quota.limit, subscriptionRequired: quota.limit === null }
}

export async function getBillingSubscription(req: FastifyRequest, reply: FastifyReply) {
    const auth = await tokenWrapper(req, reply)
    if (!auth.valid || !auth.id) return reply.status(401).send({ error: 'Unauthorized.' })
    const result = await run(`
        SELECT plan_id, status, current_period_start, current_period_end, cancel_at_period_end
        FROM billing_subscriptions
        WHERE user_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
    `, [auth.id])
    const entitlements = await run(`
        SELECT plan_id, quotas, features
        FROM billing_entitlements
        WHERE user_id = $1 AND active IS TRUE
        ORDER BY updated_at DESC
    `, [auth.id])
    const subscription = result.rows[0]
    const quotaKeys: BillingQuotaKey[] = ['searchesPerDay', 'watchTerms', 'monitoredTargets']
    const quotas = await Promise.all(quotaKeys.map(key => getBillingQuota(auth.id!, key)))
    return reply.send({
        subscription: subscription ? {
            planId: subscription.plan_id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        } : null,
        entitlements: entitlements.rows.map(row => ({ planId: row.plan_id, quotas: row.quotas, features: row.features })),
        quotas: quotas.map(quota => ({ ...quota, periodStart: quota.periodStart?.toISOString() || null, resetsAt: quota.resetsAt?.toISOString() || null })),
    })
}

export async function createBillingPortal(req: FastifyRequest, reply: FastifyReply) {
    const auth = await tokenWrapper(req, reply)
    if (!auth.valid || !auth.id) return reply.status(401).send({ error: 'Unauthorized.' })
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return reply.status(503).send({ error: 'Billing is temporarily unavailable.' })
    const customer = await run('SELECT stripe_customer_id FROM billing_customers WHERE user_id = $1', [auth.id])
    const customerId = customer.rows[0]?.stripe_customer_id as string | undefined
    if (!customerId) return reply.status(409).send({ error: 'Complete a purchase before opening billing management.' })
    const body = new URLSearchParams({
        customer: customerId,
        return_url: process.env.PUBLIC_SITE_URL || 'https://hanasand.com/subscription',
    })
    const response = await stripeRequest('/v1/billing_portal/sessions', secret, body)
    if (!response.ok || typeof response.payload.url !== 'string') return reply.status(502).send({ error: 'Billing management could not be opened.' })
    return reply.send({ url: response.payload.url })
}

function periodStartFor(period: BillingQuotaPeriod) {
    if (period === 'lifetime') return new Date(0)
    const now = new Date()
    return period === 'day'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
function resetAtFor(period: BillingQuotaPeriod) {
    if (period === 'lifetime') return null
    const now = new Date()
    return period === 'day'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}
