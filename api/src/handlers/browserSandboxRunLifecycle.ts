import run, { withTransaction } from '#db'
import { BrowserLeaseExpiredError } from '../utils/ws/browserLease.ts'
import { browserResultId } from '../utils/ws/browserResultIdentity.ts'
import { rowToBrowserRunRecord, type BrowserNetwork, type BrowserProviderRunResult, type BrowserRunRecord } from '../utils/ws/browserRunViews.ts'
import { browserRunIdentityForSocket, browserRunIdentityForUser, loadBrowserQuota, type BrowserQuota } from '../utils/ws/browserRunIdentity.ts'
import { invalidateBrowserRunStatsCache } from './browserSandboxRunHistory.ts'

type PrepareBrowserRunInput = {
    id: string
    target: string
    network: BrowserNetwork
    clientId?: string
    userId?: string
    sessionToken?: string
}

export async function prepareBrowserRun(input: PrepareBrowserRunInput): Promise<
    { allowed: true; run: BrowserRunRecord; quota: BrowserQuota } |
    { allowed: false; quota: BrowserQuota | null; reason: 'concurrency_limit' | 'identity_required' | 'run_exists' }
> {
    const identity = await browserRunIdentityForSocket(input)
    if (!identity) return { allowed: false, quota: null, reason: 'identity_required' }
    return withTransaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identity.quotaIdentity])
        const quota = await loadBrowserQuota(identity, query)
        if (quota.active >= quota.concurrentLimit) return { allowed: false as const, quota, reason: 'concurrency_limit' as const }
        const result = await query(`
            INSERT INTO browser_runs (id, owner_id, quota_identity, quota_plan, client_id_hash, target, network, status, metadata, result_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', $8::jsonb, $9::uuid)
            ON CONFLICT (id) DO NOTHING
            RETURNING id, target, network, status, title, created_at
        `, [input.id, identity.ownerId, identity.quotaIdentity, identity.quotaPlan, identity.clientIdHash, input.target, input.network,
            JSON.stringify({ identityKind: identity.identityKind, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }), browserResultId(input.target)])
        if (!result.rows.length) return { allowed: false as const, quota, reason: 'run_exists' as const }
        invalidateBrowserRunStatsCache()
        return { allowed: true as const, run: rowToBrowserRunRecord(result.rows[0]), quota: { ...quota, active: quota.active + 1, used: quota.used + 1 } }
    })
}

export async function refreshBrowserRunLease(id: string) {
    const result = await run(`UPDATE browser_runs SET metadata = metadata || jsonb_build_object('leaseExpiresAt', NOW() + INTERVAL '2 minutes')
        WHERE id = $1 AND status IN ('running', 'unreachable')
            AND (metadata->>'leaseExpiresAt')::timestamptz > NOW()`, [id])
    if (!result.rowCount) throw new BrowserLeaseExpiredError('Browser run lease expired')
}

export async function finishBrowserRun(id: string, status: 'ended' | 'failed' | 'unreachable' = 'ended', title = '') {
    if (!id) return
    await run(`
        UPDATE browser_runs
        SET status = CASE
                WHEN $2 = 'ended' AND status IN ('failed', 'unreachable') THEN status
                ELSE $2
            END,
            title = COALESCE(NULLIF($3, ''), title),
            metadata = CASE WHEN $2 IN ('ended', 'failed')
                THEN metadata || jsonb_build_object('leaseExpiresAt', NOW()) ELSE metadata END,
            updated_at = NOW()
        WHERE id = $1
    `, [id, status, title])
}

export async function updateBrowserRunProviderResult(id: string, provider: string, result: BrowserProviderRunResult) {
    if (!id || !/^[a-z0-9_-]+$/i.test(provider)) return
    await run(`
        UPDATE browser_runs
        SET metadata = metadata || jsonb_build_object('providerResults', COALESCE(metadata->'providerResults', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb)),
            updated_at = NOW()
        WHERE id = $1
    `, [id, provider, JSON.stringify(result)])
}

export async function browserPaidExtensionAllowed(id: string) {
    if (!id) return false
    const result = await run('SELECT owner_id FROM browser_runs WHERE id = $1', [id])
    const owner = result.rows[0]?.owner_id
    return owner ? (await browserRunIdentityForUser(owner)).access.paid : false
}

