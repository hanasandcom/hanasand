import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { isTransientDatabaseError } from '#db'
import { hasHanasandInternalRouteAccess } from '#utils/auth/organizationPageAccess.ts'
import { normalizeConditions } from './sigma.ts'
import { canManageRules, readDatabase } from './shared.ts'
import { organizationAccess, loadConfiguredRules, saveRule, RuleConflict } from './ruleStorage.ts'
import { findConfiguredRule, isPlatformRetentionRule, normalizeBuiltinDefinition, ruleSlug, unavailableAnalysisRule } from './ruleCatalog.ts'
import type { RuleDefinition } from './types.ts'

export async function postRule(req: FastifyRequest, res: FastifyReply) {
    try {
        const access = await organizationAccess(req, res)
        if (!access) return
        if (!canManageRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage rules.' })
        const body = req.body as { name?: unknown, explanation?: unknown, severity?: unknown, conditions?: unknown, stage?: unknown, action?: unknown } | undefined
        const name = typeof body?.name === 'string' ? body.name.trim() : ''
        const explanation = typeof body?.explanation === 'string' ? body.explanation.trim() : ''
        const severity = typeof body?.severity === 'string' && ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity : 'medium'
        const conditionResult = normalizeConditions(body?.conditions)
        if (name.length < 2 || name.length > 120) return res.status(400).send({ error: 'Rule name must contain 2-120 characters.' })
        if (explanation.length < 10 || explanation.length > 500) return res.status(400).send({ error: 'Rule explanation must contain 10-500 characters.' })
        if (!conditionResult.conditions.length || conditionResult.error) return res.status(400).send({ error: conditionResult.error || 'Add at least one valid rule condition.' })
        const stage = body?.stage ?? 'match'
        const action = body?.action ?? 'keep'
        if (!['match', 'analyze', 'detect'].includes(String(stage)) || !['drop', 'keep'].includes(String(action)) || (stage !== 'analyze' && action !== 'keep')) return res.status(400).send({ error: 'Drop requires an Analyze rule.' })
        if (stage === 'analyze' && !(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required to change log retention.' })
        const ruleId = `custom.${randomUUID().replaceAll('-', '').slice(0, 20)}.v1`
        const rule = await saveRule(req, access, { id: ruleId, version: '1', name, family: 'Custom', severity, explanation, evidence: [], definition: { match: 'all', conditions: conditionResult.conditions, stage: stage as RuleDefinition['stage'], action: action as RuleDefinition['action'] }, source: 'owned', enabled: true }, 'event.rule.created')
        return res.status(201).send({ rule })
    } catch (error) {
        if (isRuleDatabaseBusy(error)) return sendRuleDatabaseBusy(res)
        throw error
    }
}

export async function postRuleAction(req: FastifyRequest<{ Params: { id: string }, Querystring: { organizationId?: string }, Body: { action?: unknown } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage rules.' })
    const action = req.body?.action === 'enable' || req.body?.action === 'disable' ? req.body.action : null
    if (!action) return res.status(400).send({ error: 'Action must be enable or disable.' })
    const rule = findConfiguredRule(await readDatabase(() => loadConfiguredRules(access.organizationId)), req.params.id)
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    if (isPlatformRetentionRule(rule) && !(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required to change platform log retention.' })
    if (action === 'enable' && unavailableAnalysisRule(rule.id)) return res.status(409).send({ error: unavailableAnalysisRule(rule.id) })
    try {
        const saved = await saveRule(req, access, { ...rule, enabled: action === 'enable' }, 'event.rule.updated', rule.version)
        return res.send({ rule: saved })
    } catch (error) {
        if (error instanceof RuleConflict) return res.status(409).send({ error: error.message })
        if (isRuleDatabaseBusy(error)) return sendRuleDatabaseBusy(res)
        throw error
    }
}

function isRuleDatabaseBusy(error: unknown) {
    const code = (error as { code?: string })?.code
    return isTransientDatabaseError(error) || code === '55P03' || code === '57014' || code === '40P01' || code === '40001' || code === 'DB_QUEUE_FULL'
}

function sendRuleDatabaseBusy(res: FastifyReply) {
    return res.header('Retry-After', '2').status(503).send({ error: 'The database is temporarily busy. Retry saving the rule shortly.' })
}


export async function putRule(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageRules(access.role)) return res.status(403).send({ error: 'Editor access is required to manage rules.' })
    const rule = (await loadConfiguredRules(access.organizationId)).find(rule => ruleSlug(rule.id) === ruleSlug(req.params.id))
    if (!rule) return res.status(404).send({ error: 'Rule not found.' })
    if (isPlatformRetentionRule(rule) && !(await hasHanasandInternalRouteAccess(req)).valid) return res.status(403).send({ error: 'Active Hanasand organization owner or editor access is required to change platform log retention.' })
    const body = (req.body || {}) as Record<string, unknown>
    if (body.enabled === true && unavailableAnalysisRule(rule.id)) return res.status(409).send({ error: unavailableAnalysisRule(rule.id) })
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : ''
    if (name.length < 2 || name.length > 120 || explanation.length < 10 || explanation.length > 500) return res.status(400).send({ error: 'Name must contain 2–120 characters and description 10–500 characters.' })
    if (!['low', 'medium', 'high', 'critical'].includes(String(body.severity)) || typeof body.enabled !== 'boolean' || typeof body.version !== 'string') return res.status(400).send({ error: 'A valid severity, enabled state and current version are required.' })
    let definition = rule.definition
    if (rule.source !== 'hanasand') {
        const normalized = normalizeConditions(body.conditions)
        if (normalized.error || !normalized.conditions.length) return res.status(400).send({ error: normalized.error || 'Add at least one condition.' })
        const action = body.action ?? rule.definition?.action ?? 'keep'
        if (!['keep', 'drop'].includes(String(action)) || (rule.definition?.stage !== 'analyze' && action !== 'keep')) return res.status(400).send({ error: 'Drop requires an Analyze rule.' })
        const storeScope = body.storeScope ?? rule.definition?.storeScope ?? 'all'
        if (!['all', 'custom_drop'].includes(String(storeScope))) return res.status(400).send({ error: 'Choose whether Store applies to all rules or custom Drop rules.' })
        definition = { ...rule.definition, match: 'all', conditions: normalized.conditions, action: action as 'drop' | 'keep', ...(body.storeScope !== undefined || rule.definition?.storeScope ? { storeScope: storeScope as 'all' | 'custom_drop' } : {}) }
    } else {
        if (body.conditions !== undefined) return res.status(400).send({ error: 'Use the detection definition to edit built-in selectors.' })
        if (body.definition !== undefined) {
            const normalized = normalizeBuiltinDefinition(rule.id, body.definition)
            if (normalized.error) return res.status(400).send({ error: normalized.error })
            definition = normalized.definition
        }
    }
    try {
        const saved = await saveRule(req, access, { ...rule, name, explanation, severity: String(body.severity), enabled: body.enabled, definition }, 'event.rule.updated', body.version)
        return res.send({ rule: saved })
    } catch (error) {
        if (error instanceof RuleConflict) return res.status(409).send({ error: error.message })
        if (isRuleDatabaseBusy(error)) return sendRuleDatabaseBusy(res)
        throw error
    }
}
