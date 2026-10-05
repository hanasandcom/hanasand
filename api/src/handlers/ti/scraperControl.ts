import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type ControlBody = {
    action?: 'source_status' | 'run_query' | 'public_channel_status' | 'scheduler_run_now' | 'scheduler_pause' | 'scheduler_resume' | 'request_source' | 'source_candidate_action' | 'create_watchlist' | 'rebuild_alerts'
    query?: string
    sourceId?: string
    tenantId?: string
    status?: 'active' | 'paused'
    candidateId?: string
    candidateAction?: 'inspect' | 'validate' | 'test' | 'activate' | 'promote' | 'reject' | 'retry' | 'suppress'
    target?: string
    targets?: string[]
    sourceType?: 'telegram_channel' | 'restricted_metadata'
    activate?: boolean
    approveMetadataOnly?: boolean
    reason?: string
    watchlistName?: string
    terms?: string[]
    webhookUrl?: string
}

type Actor = { token: string; id: string; impersonationToken?: string }
type ScraperReply = { ok: boolean; status: number; json?: unknown; error?: string }

export async function getTiScraperControl(request: FastifyRequest, reply: FastifyReply) {
    const actor = await requireActor(request, reply)
    if (!actor) return
    const base = scraperBase()
    if (!base) return unavailable(reply, 'TI_SCRAPER_API_BASE is not configured.')

    const query = typeof request.query === 'object' && request.query !== null && 'q' in request.query
        ? String((request.query as { q?: unknown }).q || '').trim() || 'APT29'
        : 'APT29'
    const tenantId = headerValue(request.headers['x-tenant-id']) || 'default'
    const schedulerTenantId = headerValue(request.headers['x-tenant-id']) || ''
    const authenticated = actorHeaders(actor)
    const [health, sources, frontier, resources, productSlo, scheduler, exposureParser, quality, publicChannel, restricted, contracts, sourceInventory, sourcePacks, alerts, watchlists, deliveries] = await Promise.all([
        fetchJson(base, '/v1/health'),
        fetchJson(base, '/v1/sources?limit=200'),
        fetchJson(base, '/v1/frontier'),
        fetchJson(base, '/v1/ops/resource-snapshot'),
        fetchJson(base, '/v1/ops/product-slo'),
        fetchJson(base, `/v1/ops/collection-scheduler${schedulerTenantId ? `?tenantId=${encodeURIComponent(schedulerTenantId)}` : ''}`, { headers: authenticated }),
        fetchJson(base, '/v1/dwm/exposure-parser/health'),
        fetchJson(base, `/v1/quality/evaluate?q=${encodeURIComponent(query)}`),
        fetchJson(base, `/v1/public-channels/status?query=${encodeURIComponent(query)}&tenantId=${encodeURIComponent(tenantId)}`),
        fetchJson(base, `/v1/restricted-metadata/status?q=${encodeURIComponent(query)}`),
        fetchJson(base, '/v1/contracts'),
        fetchJson(base, `/v1/dwm/source-inventory?full=true&tenantId=${encodeURIComponent(tenantId)}`),
        fetchJson(base, `/v1/dwm/source-packs?terms=${encodeURIComponent(query)}&tenantId=${encodeURIComponent(tenantId)}`),
        fetchJson(base, '/v1/dwm/alerts?tenantId=default'),
        fetchJson(base, '/v1/dwm/watchlists?tenantId=default'),
        fetchJson(base, '/v1/dwm/webhooks/deliveries?tenantId=default'),
    ])

    const scraperUnavailable = !health.ok
    reply.header('cache-control', 'no-store, max-age=0')
    return reply.code(scraperUnavailable ? 503 : 200).send({
        ok: !scraperUnavailable,
        generatedAt: new Date().toISOString(),
        query,
        baseConfigured: true,
        ...(scraperUnavailable ? { error: { code: 'ti_scraper_unavailable', message: 'The scraper health endpoint is unavailable.' } } : {}),
        endpoints: Object.fromEntries(Object.entries({ health, sources, frontier, resources, productSlo, scheduler, exposureParser, quality, publicChannel, restricted, contracts, sourceInventory, sourcePacks, alerts, watchlists, deliveries }).map(([key, value]) => [key, endpointResult(value)])),
        health: health.json,
        sources: sources.json,
        frontier: frontier.json,
        resources: resources.json,
        productSlo: productSlo.json,
        scheduler: scheduler.json,
        exposureParser: exposureParser.json,
        quality: quality.json,
        publicChannel: publicChannel.json,
        restricted: restricted.json,
        contracts: contracts.json,
        sourceInventory: sourceInventory.json,
        sourcePacks: sourcePacks.json,
        alerts: alerts.json,
        watchlists: watchlists.json,
        deliveries: deliveries.json,
    })
}

export async function postTiScraperControl(request: FastifyRequest<{ Body: ControlBody }>, reply: FastifyReply) {
    const actor = await requireActor(request, reply)
    if (!actor) return
    const base = scraperBase()
    if (!base) return unavailable(reply, 'TI_SCRAPER_API_BASE is not configured.')
    const body = request.body || {}

    if (body.action === 'source_status') {
        if (typeof body.sourceId !== 'string' || !body.sourceId.trim() || !['active', 'paused'].includes(body.status || '') || (body.tenantId !== undefined && !validTenantId(body.tenantId))) {
            return reply.code(400).send({ ok: false, error: { message: 'A source and valid status are required.' } })
        }
        return forward(reply, base, `/v1/sources/${encodeURIComponent(body.sourceId)}`, { status: body.status, ...(body.tenantId ? { tenantId: body.tenantId } : {}) }, actor, 'PATCH')
    }

    const query = body.query?.trim() || 'APT29'
    if (body.action === 'run_query') {
        return forward(reply, base, '/v1/intel/runs', {
            query,
            entityType: 'actor',
            includeClearWeb: true,
            includeTelegram: true,
            includeDarknetMetadata: true,
            maxTasks: 40,
            tenantId: 'hanasand-dashboard',
            requesterId: 'dashboard/ti/control',
            reason: 'operator requested collection run',
        }, actor)
    }
    if (body.action === 'public_channel_status') {
        const result = await fetchJson(base, `/v1/public-channels/status?query=${encodeURIComponent(query)}&tenantId=hanasand-dashboard`)
        return reply.code(result.ok ? 200 : 502).send({ ok: result.ok, status: result.status, payload: result.json, error: result.error })
    }
    if (body.action === 'scheduler_run_now' || body.action === 'scheduler_pause' || body.action === 'scheduler_resume') {
        return forward(reply, base, '/v1/ops/collection-scheduler', {
            action: body.action === 'scheduler_run_now' ? 'run_now' : body.action === 'scheduler_pause' ? 'pause' : 'resume',
            approvedBy: 'dashboard/ti/control',
            reason: 'operator source scheduler control',
        }, actor)
    }
    if (body.action === 'request_source') {
        return forward(reply, base, '/v1/dwm/source-requests', {
            tenantId: 'default', target: body.target || query, targets: body.targets,
            type: body.sourceType || 'telegram_channel', scope: query, activate: body.activate !== false,
            approveMetadataOnly: body.approveMetadataOnly === true, approvedBy: 'dashboard/ti/control',
            requestedBy: 'dashboard/ti/control', priority: 'high',
        }, actor)
    }
    if (body.action === 'source_candidate_action') {
        return forward(reply, base, '/v1/dwm/source-requests', {
            action: body.candidateAction || 'inspect', sourceId: body.sourceId, candidateId: body.candidateId,
            approveMetadataOnly: body.approveMetadataOnly === true, approvedBy: 'dashboard/ti/control',
            decidedBy: 'dashboard/ti/control', reason: body.reason || 'operator source action from collection view',
        }, actor)
    }
    if (body.action === 'create_watchlist') {
        return forward(reply, base, '/v1/dwm/watchlists', {
            tenantId: 'default', name: body.watchlistName || `${query} watchlist`,
            terms: body.terms?.length ? body.terms : [query], webhookUrl: body.webhookUrl, status: 'active',
        }, actor)
    }
    if (body.action === 'rebuild_alerts') {
        return forward(reply, base, '/v1/dwm/alerts/rebuild', { tenantId: 'default', actor: 'dashboard/ti/control' }, actor)
    }
    return reply.code(400).send({ ok: false, error: { code: 'unsupported_action', message: 'Unsupported scraper control action.' } })
}

async function requireActor(request: FastifyRequest, reply: FastifyReply): Promise<Actor | null> {
    const auth = await tokenWrapper(request, reply)
    if (!auth.valid || !auth.id) {
        reply.header('cache-control', 'no-store, max-age=0')
        reply.code(401).send({ error: 'authentication_required' })
        return null
    }
    const authorization = headerValue(request.headers.authorization) || ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
        reply.code(401).send({ error: 'authentication_required' })
        return null
    }
    return { token, id: auth.id, impersonationToken: headerValue(request.headers['x-impersonation-token']) }
}

function scraperBase() { return process.env.TI_SCRAPER_API_BASE?.trim().replace(/\/$/, '') }
function actorHeaders(actor: Actor) { return { authorization: `Bearer ${actor.token}`, id: actor.id, 'x-actor-id': actor.id, ...(actor.impersonationToken ? { 'x-impersonation-token': actor.impersonationToken } : {}) } }
function validTenantId(value: unknown) { return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value) }
function headerValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }

async function forward(reply: FastifyReply, base: string, path: string, body: unknown, actor: Actor, method = 'POST') {
    const result = await fetchJson(base, path, { method, headers: { 'content-type': 'application/json', ...actorHeaders(actor) }, body: JSON.stringify(body) })
    return reply.header('cache-control', 'no-store, max-age=0').code(result.ok ? 200 : 502).send({ ok: result.ok, status: result.status, payload: result.json, error: result.error })
}

async function fetchJson(base: string, path: string, init?: RequestInit): Promise<ScraperReply> {
    try {
        const response = await fetch(new URL(path, base), { ...init, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
        const text = await response.text()
        let json: unknown = {}
        try { json = text ? JSON.parse(text) : {} } catch { json = { body: text } }
        return { ok: response.ok, status: response.status, json }
    } catch (error) {
        return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
    }
}

function endpointResult(result: ScraperReply) { return { ok: result.ok, status: result.status, error: result.error } }
function unavailable(reply: FastifyReply, message: string) {
    return reply.header('cache-control', 'no-store, max-age=0').code(503).send({ ok: false, generatedAt: new Date().toISOString(), baseConfigured: false, error: { code: 'ti_scraper_unavailable', message } })
}
