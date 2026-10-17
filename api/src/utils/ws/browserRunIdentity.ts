import { createHash } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { validateSession } from '#utils/auth/session.ts'
import { browserAccess, type BrowserAccess } from './browserAccess.ts'

export type BrowserQuota = BrowserAccess & {
    plan: string
    limit: null
    used: number
    active: number
    remaining: null
    resetsAt: string | null
    identityKind: 'anonymous' | 'user'
}

type BrowserRunIdentity = {
    identityKind: 'anonymous' | 'user'
    quotaIdentity: string
    quotaPlan: string
    ownerId: string | null
    clientIdHash: string | null
    periodStart: Date | null
    access: BrowserAccess
}

export async function browserRunIdentityForSocket(input: { clientId?: string; userId?: string; sessionToken?: string }) {
    const sessionToken = cleanText(input.sessionToken)
    const userId = cleanText(input.userId)
    const clientId = cleanClientId(input.clientId)
    if (sessionToken) {
        const session = await validateSession({ id: userId || undefined, token: sessionToken })
        if (session?.user?.id) return browserRunIdentityForUser(session.user.id, clientId)
    }
    return browserRunIdentityForClient(clientId)
}

export async function browserRunIdentityForRequest(req: FastifyRequest, res: FastifyReply, clientId: unknown) {
    const user = await tokenWrapper(req, res)
    const cleanId = cleanClientId(clientId)
    return user.valid && user.id
        ? browserRunIdentityForUser(user.id, cleanId)
        : browserRunIdentityForClient(cleanId)
}

export async function browserRunIdentityForUser(userId: string, clientId?: string): Promise<BrowserRunIdentity> {
    const result = await run(`
        SELECT EXISTS (SELECT 1 FROM billing_entitlements WHERE user_id = $1 AND plan_id = 'browser' AND active IS TRUE) AS paid,
            (SELECT plan FROM browser_subscriptions WHERE owner_id = $1 AND active IS TRUE LIMIT 1) AS legacy_plan
    `, [userId])
    const plan = result.rows[0]?.paid ? 'browser' : cleanText(result.rows[0]?.legacy_plan) || 'free'
    const now = new Date()
    return {
        identityKind: 'user', quotaIdentity: `browser:user:${userId}`, quotaPlan: plan,
        ownerId: userId, clientIdHash: clientId ? hashValue(clientId) : null,
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        access: browserAccess(plan),
    }
}

function browserRunIdentityForClient(clientId?: string): BrowserRunIdentity | null {
    const clean = cleanClientId(clientId)
    if (!clean) return null
    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return {
        identityKind: 'anonymous',
        quotaIdentity: `browser:anonymous:${hashValue(clean)}`,
        quotaPlan: 'anonymous',
        ownerId: null,
        clientIdHash: hashValue(clean),
        periodStart,
        access: browserAccess('anonymous'),
    }
}

export function browserRunScope(identity: BrowserRunIdentity) {
    return identity.ownerId
        ? {
            where: '(owner_id = $1 OR ($2::text IS NOT NULL AND client_id_hash = $2))',
            params: [identity.ownerId, identity.clientIdHash],
        }
        : { where: 'client_id_hash = $1', params: [identity.clientIdHash] }
}

export async function loadBrowserQuota(identity: BrowserRunIdentity, query: typeof run = run): Promise<BrowserQuota> {
    const result = await query(`
        SELECT COUNT(*) FILTER (WHERE created_at >= $2::timestamptz)::int AS used,
            COUNT(*) FILTER (WHERE status IN ('running', 'unreachable') AND
                COALESCE((metadata->>'leaseExpiresAt')::timestamptz, updated_at + INTERVAL '2 minutes') > NOW())::int AS active
        FROM browser_runs WHERE quota_identity = $1
    `, [identity.quotaIdentity, identity.periodStart?.toISOString() || new Date(0).toISOString()])
    return {
        ...identity.access, plan: identity.quotaPlan, limit: null, used: Number(result.rows[0]?.used || 0),
        active: Number(result.rows[0]?.active || 0), remaining: null, resetsAt: null, identityKind: identity.identityKind,
    }
}

export async function loadAccessibleBrowserRun(req: FastifyRequest, res: FastifyReply, id: string, clientId?: string, token?: string) {
    const result = await run('SELECT * FROM browser_runs WHERE id = $1 LIMIT 1', [id])
    const row = result.rows[0] as (Record<string, any> & { metadata?: Record<string, any> }) | undefined
    if (!row || row.metadata?.historyDeletedAt) return null
    if (token && (row.metadata?.reportToken === token || token === id)) return row

    const user = await tokenWrapper(req, res).catch(() => ({ valid: false, id: '' }))
    if (user.valid && user.id && row.owner_id === user.id) return row
    const clientHash = cleanClientId(clientId) ? hashValue(cleanClientId(clientId)) : ''
    if (clientHash && row.client_id_hash === clientHash) return row
    return null
}

export function cleanClientId(value: unknown) {
    const text = cleanText(value)
    return /^[a-zA-Z0-9_.:-]{8,160}$/.test(text) ? text : ''
}

function cleanText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export function hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex')
}

