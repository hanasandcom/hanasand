import { rows } from './rowHelpers.ts'
import type { SmokeQueryHandler } from './queryTypes.ts'

export const handleRuleQueries: SmokeQueryHandler = (compact, params, state) => {
    if (compact.startsWith('SET LOCAL lock_timeout=')) return rows([])

    if (compact.startsWith('SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota FROM billing_entitlements')) {
        return rows([{ quota: state.users.has(params[0]) && params[1] === 'watchTerms' ? 25 : 0 }])
    }

    if (compact.startsWith('SELECT used FROM billing_usage')) return rows([{ used: 0 }])

    if (compact.startsWith('WITH installed AS ( INSERT INTO rules(')) {
        const [organizationId, ruleId, name, family, severity, explanation, definition, source] = params
        if (state.organizations.has(organizationId)) {
            const key = `${organizationId}:${ruleId}`
            if (!state.rules.has(key)) {
                state.rules.set(key, {
                    id: key,
                    organization_id: organizationId,
                    rule_id: ruleId,
                    version: '1',
                    name,
                    family,
                    severity,
                    explanation,
                    definition: JSON.parse(definition),
                    source,
                    enabled: true,
                })
            }
        }
        return rows([])
    }

    if (compact.startsWith('WITH previous AS MATERIALIZED ( SELECT * FROM rules')) {
        const [organizationId, ruleId, previousDefinition, nextDefinition] = params
        for (const rule of state.rules.values()) {
            if (rule.rule_id !== ruleId || rule.source !== 'owned'
                || (organizationId && rule.organization_id !== organizationId)
                || JSON.stringify(rule.definition) !== previousDefinition
                || !/^\d{1,9}$/.test(rule.version)) continue

            rule.definition = JSON.parse(nextDefinition)
            rule.version = String(Number(rule.version) + 1)
        }
        return rows([])
    }

    if (compact.startsWith('INSERT INTO system_events')) return rows([])

    if (compact.startsWith('SELECT r.rule_id AS id, r.organization_id, r.version, r.severity, r.source, r.enabled, r.definition FROM rules r JOIN organizations scope')) {
        const [organizationId, platformOrganizationId, applicationErrorRuleId] = params
        const scopedOrganizationId = organizationId ?? platformOrganizationId
        return rows([...state.rules.values()]
            .filter(rule => rule.organization_id === scopedOrganizationId)
            .filter(rule => ((rule.source === 'owned' || Object.hasOwn(rule.definition, 'protection')) && rule.enabled)
                || rule.rule_id === applicationErrorRuleId)
            .filter(rule => rule.definition?.stage === 'analyze')
            .map(rule => ({
                id: rule.rule_id,
                organization_id: rule.organization_id,
                version: rule.version,
                severity: rule.severity,
                source: rule.source,
                enabled: rule.enabled,
                definition: rule.definition,
            })))
    }

    return undefined
}
