import { randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { invalidateReadCache, cachedRead } from '#utils/readCache.ts'
import { eventConditionEvidence } from './sigma.ts'
import { BUILTIN_RULES, builtinDefinition, defaultRuleDefinition, platformRetentionRuleIds } from './ruleCatalog.ts'
import type { Rule } from './types.ts'

export class RuleConflict extends Error { constructor() { super('This rule changed since you opened it. Reload the rule before saving again.') } }

export async function saveRule(req: FastifyRequest, access: { organizationId: string, userId: string }, rule: Rule, action: string, expectedVersion?: string, preserveEnabled = false) {
    const saved = await withTransaction(async query => {
        // Serialize edits even when a built-in rule has no organization override yet.
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`event-rule:${access.organizationId}:${rule.id}`])
        const existing = await query('SELECT * FROM rules WHERE organization_id = $1 AND rule_id = $2 FOR UPDATE', [access.organizationId, rule.id])
        const row = existing.rows[0]
        const builtin = BUILTIN_RULES.find(item => item.id === rule.id)
        const version = String(row?.version || builtin?.version || '0')
        if (expectedVersion !== undefined && expectedVersion !== version) throw new RuleConflict()
        const before = row ? { name: row.name, explanation: row.explanation, severity: row.severity, enabled: row.enabled, definition: builtin ? builtinDefinition(builtin, row.definition) : row.definition, version } : builtin ? { name: builtin.name, explanation: builtin.explanation, severity: builtin.severity, enabled: true, definition: defaultRuleDefinition(builtin.id), version } : null
        const after = { name: rule.name, explanation: rule.explanation, severity: rule.severity, enabled: preserveEnabled && row ? Boolean(row.enabled) : rule.enabled !== false, definition: rule.definition || {}, version: String(Number(version) + 1) }
        if (action === 'event.rule.updated' && before && ['name', 'explanation', 'severity', 'enabled', 'definition'].every(key => JSON.stringify(before[key as keyof typeof before]) === JSON.stringify(after[key as keyof typeof after]))) return { ...rule, version, recordId: row?.id }
        const result = await query(`INSERT INTO rules (id, organization_id, rule_id, version, name, family, severity, explanation, definition, source, source_reference, enabled, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
            ON CONFLICT (organization_id, rule_id) DO UPDATE SET version=EXCLUDED.version, name=EXCLUDED.name, family=EXCLUDED.family, severity=EXCLUDED.severity, explanation=EXCLUDED.explanation, definition=EXCLUDED.definition, source=EXCLUDED.source, source_reference=EXCLUDED.source_reference, enabled=EXCLUDED.enabled, updated_at=NOW()
            RETURNING id`, [row?.id || randomUUID(), access.organizationId, rule.id, after.version, rule.name, rule.family, rule.severity, rule.explanation, JSON.stringify(after.definition), rule.source || 'owned', rule.sourceReference || null, after.enabled, access.userId])
        await recordSystemEvent(req, { actionType: action, actorId: access.userId, organizationId: access.organizationId, source: 'event', targetType: 'event_rule', targetId: rule.id, context: { ruleId: rule.id, before, after } }, query)
        return { ...rule, version: after.version, enabled: after.enabled, recordId: result.rows[0].id }
    })
    invalidateReadCache(`rules:${access.organizationId}:`)
    invalidateReadCache(`rule-hits:${access.organizationId}:`)
    invalidateReadCache(`rule-detail:${access.organizationId}:`)
    return saved
}

export async function organizationAccess(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    // tokenWrapper may have already sent the authoritative auth failure.
    // Do not append a second response from the organization boundary.
    if (res.sent) return null
    const { valid, id: userId } = auth
    if (!valid || !userId) {
        res.status(401).send({ error: 'Unauthorized.' })
        return null
    }
    const query = req.query as { organizationId?: string }
    const organizationId = query.organizationId || (req.params as { organizationId?: string }).organizationId || ''
    if (!organizationId) {
        res.status(400).send({ error: 'organizationId is required.' })
        return null
    }
    const result = await run(`
        SELECT o.id, om.role
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id AND om.user_id = $2 AND om.status = 'active'
        WHERE o.id = $1 AND o.status = 'active'
    `, [organizationId, userId])
    if (!result.rows[0]) {
        res.status(403).send({ error: 'Organization access denied.' })
        return null
    }
    return { organizationId, userId, role: result.rows[0].role as string }
}

export async function loadConfiguredRules(organizationId: string, query: typeof run = run, summary = false): Promise<Rule[]> {
    if (process.env.NODE_ENV !== 'test' && (query as typeof run & { primaryDatabaseRunner?: boolean }).primaryDatabaseRunner) {
        return cachedRead(`rules:${organizationId}:${summary ? 'summary' : 'full'}`, 5000, () => loadConfiguredRulesUncached(organizationId, query, summary))
    }
    return loadConfiguredRulesUncached(organizationId, query, summary)
}

async function loadConfiguredRulesUncached(organizationId: string, query: typeof run, summary = false): Promise<Rule[]> {
    const result = await query(`
        SELECT id, rule_id, version, name, family, severity, explanation,
            ${summary ? 'jsonb_build_object(\'stage\', definition->\'stage\', \'action\', definition->\'action\') AS definition, NULL AS source_reference' : 'definition, source_reference'}, source, enabled
        FROM rules
        WHERE organization_id = $1
        ORDER BY created_at ASC
    `, [organizationId])
    const overrides = new Map((result.rows as Array<Record<string, unknown>>).map(row => [String(row.rule_id), row]))
    const builtIns = BUILTIN_RULES.filter(rule => !platformRetentionRuleIds.has(rule.id) || overrides.has(rule.id)).map(rule => {
        const override = overrides.get(rule.id)
        return { ...rule, definition: builtinDefinition(rule, override?.definition), detectionLogic: rule.explanation, ...(override ? { recordId: String(override.id), version: String(override.version), name: String(override.name), explanation: String(override.explanation), severity: String(override.severity) } : {}), enabled: override ? Boolean(override.enabled) : rule.enabled !== false, source: 'hanasand' as const }
    })
    const custom = (result.rows as Array<Record<string, unknown>>)
        .filter(row => !BUILTIN_RULES.some(rule => rule.id === row.rule_id))
        .map(row => ({
            id: String(row.rule_id), recordId: String(row.id), version: String(row.version), name: String(row.name), family: String(row.family), severity: String(row.severity), explanation: String(row.explanation), evidence: eventConditionEvidence(row.definition), enabled: Boolean(row.enabled), source: (row.source === 'open_source' ? 'open_source' : 'owned') as 'open_source' | 'owned', sourceReference: typeof row.source_reference === 'string' ? row.source_reference : undefined, definition: row.definition as Rule['definition'],
        }))
    return [...builtIns, ...custom]
}
