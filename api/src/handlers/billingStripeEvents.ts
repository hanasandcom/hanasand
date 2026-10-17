import { applyContainerStripeEvent } from './containerBilling.ts'
import run from '#db'

const plans = {
    'threat-intelligence': { quotas: { searchesPerDay: 100 }, features: ['actor profiles', 'intelligence search', 'API access', 'saved searches'] },
    monitoring: { quotas: { watchTerms: 25 }, features: ['customer watchlists', 'evidence-backed alerts', 'case workflow', 'source freshness'] },
    scanner: { quotas: { monitoredTargets: 10 }, features: ['scheduled scans', 'severity findings', 'scan history', 'run-now controls'] },
    browser: { quotas: { browserRunsPerMonth: 100 }, features: ['clearweb browsing', 'safe darkweb previews', 'evidence capture', 'run history'] },
} as const

type StripeEvent = { id: string, type?: string, data?: { object?: Record<string, unknown> } }

export async function applyStripeEvent(event: StripeEvent, query: typeof run) {
    const object = event.data!.object!
    if (await applyContainerStripeEvent(event.type || '', object)) return
    if (event.type === 'checkout.session.completed') {
        const userId = text((object.metadata as Record<string, unknown> | undefined)?.user_id)
        const planId = text((object.metadata as Record<string, unknown> | undefined)?.plan_id)
        const customerId = text(object.customer)
        const subscriptionId = text(object.subscription)
        if (userId && !(await query('SELECT id FROM users WHERE id = $1 FOR KEY SHARE', [userId])).rowCount) return false
        if (userId && customerId) await query(`
            INSERT INTO billing_customers (user_id, stripe_customer_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()
        `, [userId, customerId])
        if (userId && customerId && subscriptionId && planId && planId in plans) {
            await upsertSubscription({ userId, customerId, subscriptionId, planId, status: 'active' }, query)
        }
        return
    }
    if (!event.type || !event.type.startsWith('customer.subscription.')) return
    const subscriptionId = text(object.id)
    const customerId = text(object.customer)
    if (!subscriptionId || !customerId) return
    const metadata = (object.metadata as Record<string, unknown> | undefined) || {}
    const existing = await query('SELECT user_id, plan_id FROM billing_subscriptions WHERE stripe_subscription_id = $1', [subscriptionId])
    const userId = text(metadata.user_id) || text(existing.rows[0]?.user_id)
    const planId = text(metadata.plan_id) || text(existing.rows[0]?.plan_id)
    if (!userId || !(planId in plans)) return
    if (!(await query('SELECT id FROM users WHERE id = $1 FOR KEY SHARE', [userId])).rowCount) return false
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : text(object.status) || 'active'
    await query(`
        INSERT INTO billing_customers (user_id, stripe_customer_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()
    `, [userId, customerId])
    await upsertSubscription({
        userId,
        customerId,
        subscriptionId,
        planId,
        status,
        currentPeriodStart: stripeDate(object.current_period_start),
        currentPeriodEnd: stripeDate(object.current_period_end),
        cancelAtPeriodEnd: object.cancel_at_period_end === true,
    }, query)
}

async function upsertSubscription(input: { userId: string, customerId: string, subscriptionId: string, planId: string, status: string, currentPeriodStart?: Date | null, currentPeriodEnd?: Date | null, cancelAtPeriodEnd?: boolean }, query: typeof run) {
    const entitlement = plans[input.planId as keyof typeof plans]
    await query(`
        INSERT INTO billing_subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET
            user_id = EXCLUDED.user_id, stripe_customer_id = EXCLUDED.stripe_customer_id, plan_id = EXCLUDED.plan_id,
            status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()
    `, [input.userId, input.customerId, input.subscriptionId, input.planId, input.status, input.currentPeriodStart || null, input.currentPeriodEnd || null, input.cancelAtPeriodEnd || false])
    await query(`
        INSERT INTO billing_entitlements (user_id, plan_id, active, quotas, features)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        ON CONFLICT (user_id, plan_id) DO UPDATE SET active = EXCLUDED.active, quotas = EXCLUDED.quotas, features = EXCLUDED.features, updated_at = NOW()
    `, [input.userId, input.planId, ['active', 'trialing'].includes(input.status), JSON.stringify(entitlement.quotas), JSON.stringify(entitlement.features)])
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '' }
function stripeDate(value: unknown) { const number = Number(value); return Number.isFinite(number) && number > 0 ? new Date(number * 1000) : null }
