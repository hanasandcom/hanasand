import type { FastifyReply, FastifyRequest } from 'fastify'
import { parse as parseYaml } from 'yaml'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { normalizeConditions, compileSigmaDocument } from './sigma.ts'
import { canManageRules } from './shared.ts'
import { organizationAccess, saveRule } from './ruleStorage.ts'
import type { Condition } from '#utils/events/conditions.ts'
type RulePackMetadata = { packName: string, packVersion: string, sourceReference: string }
type RulePackFormat = 'open-source' | 'Sigma'

function rulePackMetadata(body: { packName?: unknown, packVersion?: unknown, sourceReference?: unknown } | undefined, format: RulePackFormat): RulePackMetadata | { error: string } {
    const packName = typeof body?.packName === 'string' ? body.packName.trim() : ''
    const packVersion = typeof body?.packVersion === 'string' ? body.packVersion.trim() : ''
    const sourceReference = typeof body?.sourceReference === 'string' ? body.sourceReference.trim() : ''
    if (packName.length < 2 || packName.length > 100 || packVersion.length < 1 || packVersion.length > 40) return { error: 'Pack name must contain 2-100 characters and version 1-40 characters.' }
    const sourceError = `${format === 'Sigma' ? 'Sigma source' : 'Open-source pack'} reference must be an HTTPS URL of at most 300 characters.`
    let reference: URL
    try { reference = new URL(sourceReference) } catch { return { error: sourceError } }
    if (reference.protocol !== 'https:' || !reference.hostname || sourceReference.length > 300) return { error: sourceError }
    return { packName, packVersion, sourceReference }
}

function rulePackSlug(packName: string) {
    return packName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export async function postRulePack(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageRules(access.role)) return res.status(403).send({ error: 'Editor access is required to import rules.' })
    const body = req.body as { packName?: unknown, packVersion?: unknown, sourceReference?: unknown, rules?: unknown } | undefined
    const metadata = rulePackMetadata(body, 'open-source')
    if ('error' in metadata) return res.status(400).send({ error: metadata.error })
    const { packName, packVersion, sourceReference } = metadata
    if (!Array.isArray(body?.rules) || body.rules.length < 1 || body.rules.length > 100) return res.status(400).send({ error: 'Import 1-100 rules per pack.' })
    const packSlug = rulePackSlug(packName)
    if (!packSlug) return res.status(400).send({ error: 'Pack name must contain letters or numbers.' })
    const prepared: Array<{ ruleId: string, name: string, severity: string, explanation: string, definition: { match: 'all', conditions: Condition[] } }> = []
    for (const item of body.rules) {
        const rule = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
        const rawId = typeof rule.id === 'string' ? rule.id.trim() : ''
        const name = typeof (rule.name ?? rule.title) === 'string' ? String(rule.name ?? rule.title).trim() : ''
        const explanation = typeof (rule.explanation ?? rule.description) === 'string' ? String(rule.explanation ?? rule.description).trim() : ''
        const severity = typeof (rule.severity ?? rule.level) === 'string' && ['low', 'medium', 'high', 'critical'].includes(String(rule.severity ?? rule.level)) ? String(rule.severity ?? rule.level) : 'medium'
        const conditions = normalizeConditions(rule.conditions)
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(rawId) || name.length < 2 || name.length > 120 || explanation.length < 10 || explanation.length > 500 || conditions.error || !conditions.conditions.length) return res.status(400).send({ error: `Invalid imported rule: ${rawId || 'missing id'}.`, detail: conditions.error || 'Rule needs valid conditions.' })
        prepared.push({ ruleId: `open.${packSlug}.${rawId}.v1`, name, severity, explanation, definition: { match: 'all', conditions: conditions.conditions } })
    }
    for (const rule of prepared) {
        await saveRule(req, access, { id: rule.ruleId, version: '1', name: rule.name, family: packName, severity: rule.severity, explanation: rule.explanation, definition: rule.definition, evidence: [], source: 'open_source', sourceReference, enabled: true }, 'event.rule.imported', undefined, true)
    }
    await recordSystemEvent(req, { actionType: 'event.rule_pack.imported', actorId: access.userId, organizationId: access.organizationId, targetType: 'event_rule_pack', targetId: `${packSlug}@${packVersion}`, context: { packName, packVersion, sourceReference, ruleCount: prepared.length } })
    return res.status(201).send({ imported: prepared.length, pack: { name: packName, version: packVersion, sourceReference } })
}

export async function postEventSigmaPack(req: FastifyRequest, res: FastifyReply) {
    const access = await organizationAccess(req, res)
    if (!access) return
    if (!canManageRules(access.role)) return res.status(403).send({ error: 'Editor access is required to import Sigma rules.' })
    const body = req.body as { packName?: unknown, packVersion?: unknown, sourceReference?: unknown, yaml?: unknown } | undefined
    const metadata = rulePackMetadata(body, 'Sigma')
    if ('error' in metadata) return res.status(400).send({ error: metadata.error })
    const { packName, packVersion, sourceReference } = metadata
    if (typeof body?.yaml !== 'string' || body.yaml.length > 200_000) return res.status(400).send({ error: 'Provide one Sigma YAML document up to 200,000 characters.' })
    let document: unknown
    try { document = parseYaml(body.yaml) } catch (error) { return res.status(400).send({ error: 'Sigma YAML is invalid.', detail: error instanceof Error ? error.message.slice(0, 300) : 'Unable to parse YAML.' }) }
    const compiled = compileSigmaDocument(document)
    if ('error' in compiled) return res.status(400).send({ error: compiled.error })
    const packSlug = rulePackSlug(packName)
    if (!packSlug) return res.status(400).send({ error: 'Pack name must contain letters or numbers.' })
    for (const rule of compiled.rules) {
        const ruleId = `sigma.${packSlug}.${rule.id}.v1`
        await saveRule(req, access, { id: ruleId, version: '1', name: rule.name, family: 'Sigma', severity: rule.severity, explanation: rule.explanation, definition: { match: 'all', conditions: rule.conditions }, evidence: [], source: 'open_source', sourceReference, enabled: true }, 'event.rule.imported', undefined, true)
    }
    await recordSystemEvent(req, { actionType: 'event.sigma_pack.imported', actorId: access.userId, organizationId: access.organizationId, targetType: 'event_sigma_pack', targetId: `${packSlug}@${packVersion}`, context: { packName, packVersion, sourceReference, ruleCount: compiled.rules.length } })
    return res.status(201).send({ imported: compiled.rules.length, pack: { name: packName, version: packVersion, sourceReference } })
}
