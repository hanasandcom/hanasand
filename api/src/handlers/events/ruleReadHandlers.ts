import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { hasHanasandInternalRouteAccess } from '#utils/auth/organizationPageAccess.ts'
import { internalRetentionRuleIds, listRule, ruleCategory, loadRuleHits, getPreviousRuleHitCounts } from '#utils/events/ruleList.ts'
import { getStoredRuleEstimate } from '#utils/events/rulePreview.ts'
import { ReadAdmissionError, cachedRead } from '#utils/readCache.ts'
import { canManageRules, readDatabase } from './shared.ts'
import { organizationAccess, loadConfiguredRules } from './ruleStorage.ts'
import { builtinDefinition, findConfiguredRule, isPlatformRetentionRule } from './ruleCatalog.ts'
import type { ReadAwareRun, Rule } from './types.ts'

function reportedRuleHitCount(rule: Pick<Rule, 'id' | 'definition'>, hits: ReadonlyMap<string, number>) {
    return rule.definition?.stage === 'analyze' && rule.definition.action === 'keep' ? null : hits.get(rule.id) ?? 0
}

export async function getRules(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string, view?: string, category?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    if (query.category && !['analysis', 'match', 'detection'].includes(query.category)) return res.status(400).send({ error: 'Unknown rule category.' })
    const compact = query.view === 'list'
    const [configured, retentionRole] = await Promise.all([
        loadConfiguredRules(access.organizationId, run, compact),
        canManageRules(access.role) ? hasHanasandInternalRouteAccess(req) : Promise.resolve({ valid: false }),
    ])
    const hitRules = configured.filter(rule => !internalRetentionRuleIds.has(rule.id))
    const rules = hitRules.filter(rule => !query.category || ruleCategory(rule) === query.category)
    let hits: Map<string, number>
    try { hits = query.view === 'definitions' ? new Map<string, number>() : await loadRuleHits(access.organizationId, hitRules, run) }
    catch (error) {
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        throw error
    }
    const previousHitCounts = getPreviousRuleHitCounts(access.organizationId, hitRules, hits)
    return res.send({ organizationId: access.organizationId, rules: rules.map(rule => ({ ...(compact ? listRule(rule) : rule),
        hitCount: reportedRuleHitCount(rule, hits),
        ...(Object.hasOwn(previousHitCounts, rule.id) ? { previousHitCount: previousHitCounts[rule.id] } : {}),
    })), canManageRetention: retentionRole.valid })
}

export async function getRuleHitCounts(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const rules = (await loadConfiguredRules(access.organizationId, run, true)).filter(rule => !internalRetentionRuleIds.has(rule.id))
    try {
        const hits = await loadRuleHits(access.organizationId, rules, run)
        const previousHitCounts = getPreviousRuleHitCounts(access.organizationId, rules, hits)
        return res.header('Cache-Control', 'no-store').send({ organizationId: access.organizationId, previousHitCounts, hitCounts: Object.fromEntries(rules.map(rule => [rule.id,
            reportedRuleHitCount(rule, hits),
        ])) })
    } catch (error) {
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        throw error
    }
}

export async function getRuleHitCount(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const rule = findConfiguredRule(await loadConfiguredRules(access.organizationId, run, true), req.params.id)
    if (!rule || internalRetentionRuleIds.has(rule.id)) return res.status(404).send({ error: 'Rule not found.' })
    try {
        const hits = await loadRuleHits(access.organizationId, [rule], run)
        const triggerCount = reportedRuleHitCount(rule, hits)
        return res.header('Cache-Control', 'no-store').send({ organizationId: access.organizationId, triggerCount })
    } catch (error) {
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        throw error
    }
}

export async function getRuleStorageEstimate(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const query = req.query as { organizationId?: string }
    if (query.organizationId !== access.organizationId) return res.status(403).send({ error: 'Organization access denied.' })
    const rule = findConfiguredRule(await loadConfiguredRules(access.organizationId, run, true), req.params.id)
    if (!rule || internalRetentionRuleIds.has(rule.id)) return res.status(404).send({ error: 'Rule not found.' })
    if (rule.definition?.stage !== 'analyze' || rule.definition.action !== 'drop')
        return res.send({ organizationId: access.organizationId, estimate: null })
    try {
        const estimate = await getStoredRuleEstimate(access.organizationId, rule.id, rule.version)
        return res.header('Cache-Control', 'private, max-age=60').send({ organizationId: access.organizationId, estimate })
    } catch (error) {
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        throw error
    }
}

export async function getRule(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string, offset?: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    const rule = findConfiguredRule(await readDatabase(() => loadConfiguredRules(access.organizationId)), req.params.id)
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    const requestedVersion = /\.v(\d+)$/.exec(req.params.id)?.[1]
    const isHistorical = Boolean(requestedVersion && requestedVersion !== rule.version)
    let displayedRule = rule
    if (isHistorical) {
        const history = await readDatabase(() => run(`SELECT context FROM system_events WHERE organization_id = $1 AND object_type = 'event_rule'
            AND (object_id = $2 OR object_id = $3 OR context->>'ruleId' = $2)
            AND (context->'after'->>'version' = $4 OR context->'before'->>'version' = $4)
            ORDER BY created_at DESC, id DESC LIMIT 1`, [access.organizationId, rule.id, rule.recordId || rule.id, requestedVersion!]))
        const context = history.rows[0]?.context
        const snapshot = context?.after?.version === requestedVersion ? context.after : context?.before
        if (!snapshot) return res.status(404).send({ error: 'This historical rule version is unavailable. Open the current rule using its version-free URL.' })
        displayedRule = { ...rule, ...snapshot, definition: rule.source === 'hanasand' ? builtinDefinition(rule, snapshot.definition) : snapshot.definition }
    }
    const offset = Math.max(0, Math.min(1000000, Number.parseInt(req.query.offset || '0', 10) || 0))
    try {
        const loadDetail = async () => {
            const objectIds = [...new Set([rule.id, rule.recordId || rule.id])]
            const [audit, hits] = await readDatabase(() => Promise.all([
                run(`SELECT id, event_type, actor_id, created_at, context
                    FROM (
                        SELECT id, event_type, actor_id, created_at, context
                        FROM system_events
                        WHERE organization_id = $1 AND object_type = 'event_rule'
                            AND object_id = ANY($2::text[])
                        UNION ALL
                        SELECT id, event_type, actor_id, created_at, context
                        FROM system_events
                        WHERE organization_id = $1 AND object_type = 'event_rule'
                            AND context->>'ruleId' = $3
                            AND (object_id IS NULL OR NOT (object_id = ANY($2::text[])))
                    ) AS audit_events
                    ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET $4`, [access.organizationId, objectIds, rule.id, offset]),
                loadRuleHits(access.organizationId, [rule], run),
            ]))
            const hitCount = reportedRuleHitCount(rule, hits)
            const canEdit = !isHistorical && canManageRules(access.role) && (!isPlatformRetentionRule(rule) || (await hasHanasandInternalRouteAccess(req)).valid)
            return { organizationId: access.organizationId, canEdit, isHistorical, currentVersion: rule.version, rule: displayedRule, triggerCount: hitCount, audit: audit.rows.slice(0, 50), nextOffset: audit.rows.length > 50 ? offset + 50 : null }
        }
        const payload = process.env.NODE_ENV === 'test' || !(run as ReadAwareRun).withReadDatabase
            ? await loadDetail()
            : await cachedRead(`rule-detail:${access.organizationId}:${access.role}:${req.params.id}:${offset}`, 10000, loadDetail)
        return res.send(payload)
    } catch (error) {
        if (error instanceof ReadAdmissionError) return res.header('Retry-After', '2').status(503).send({ error: error.message })
        throw error
    }
}
