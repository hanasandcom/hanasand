import { object, stringValue } from './shared.ts'
import type { Condition } from '#utils/events/conditions.ts'

export function normalizeConditions(value: unknown, limit = 8): { conditions: Condition[], error?: string } {
    if (!Array.isArray(value) || value.length < 1 || value.length > limit) return { conditions: [], error: `Conditions must contain 1-${limit} items.` }
    const conditions: Condition[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { conditions: [], error: 'Each condition must be an object.' }
        const condition = item as Record<string, unknown>
        const path = typeof condition.path === 'string' ? condition.path.trim() : ''
        const operator = condition.operator
        const conditionValue = typeof condition.value === 'string' ? condition.value : ''
        if (condition.caseSensitive !== undefined && typeof condition.caseSensitive !== 'boolean') return { conditions: [], error: 'Match case must be true or false.' }
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(path)) return { conditions: [], error: 'Condition paths may contain only letters, numbers, dots, hyphens, and underscores.' }
        if (operator !== 'equals' && operator !== 'contains' && operator !== 'regex') return { conditions: [], error: 'Condition operators must be equals, contains, or regex.' }
        if (!conditionValue || conditionValue.length > 200) return { conditions: [], error: 'Condition values must contain 1-200 characters.' }
        if (operator === 'regex') {
            try { new RegExp(conditionValue) } catch { return { conditions: [], error: 'Regex condition is invalid.' } }
        }
        conditions.push({ path, operator, value: conditionValue, ...(condition.caseSensitive !== undefined ? { caseSensitive: condition.caseSensitive } : {}) })
    }
    return { conditions }
}

export function compileSigmaDocument(value: unknown): { rules: Array<{ id: string, name: string, severity: string, explanation: string, conditions: Condition[] }> } | { error: string } {
    const document = object(value)
    const title = stringValue(document.title)
    const detection = object(document.detection)
    if (!title || !Object.keys(detection).length) return { error: 'Sigma document must contain title and detection.' }
    const conditionText = stringValue(detection.condition) || 'selection'
    const selectors = Object.entries(detection).filter(([key]) => key !== 'condition')
    const selectorMap = new Map<string, Condition[]>()
    for (const [selectorName, selectorValue] of selectors) {
        const conditions = sigmaSelectionConditions(selectorValue)
        if ('error' in conditions) return { error: `${selectorName}: ${conditions.error}` }
        selectorMap.set(selectorName, conditions.conditions)
    }
    const names = Array.from(selectorMap.keys())
    const groups = conditionText.toLowerCase().includes(' or ')
        ? conditionText.split(/\s+or\s+/i).map(item => item.trim())
        : conditionText.match(/^\s*\d+\s+of\s+([a-z0-9_*.-]+)\s*$/i)
            ? names.filter(name => name.startsWith(conditionText.match(/^\s*\d+\s+of\s+([a-z0-9_*.-]+)\s*$/i)![1].replace('*', '')))
            : [conditionText.trim()]
    const rules = []
    for (const [index, group] of groups.entries()) {
        const referenced = [...group.matchAll(/[a-zA-Z0-9_.-]+/g)].map(match => match[0]).filter(name => selectorMap.has(name))
        const conditions = (referenced.length ? referenced : [group]).flatMap(name => selectorMap.get(name) || [])
        if (!conditions.length || conditions.length > 8 || /\bnot\b|\bnear\b|\bwithin\b|\bregex\b/i.test(group)) return { error: `Unsupported Sigma condition '${group}'. Use bounded selection, OR, or 1 of selection* syntax.` }
        rules.push({ id: `${slug(title)}-${index + 1}`, name: referenced.length > 1 ? `${title} (${referenced.join(' + ')})` : title, severity: sigmaSeverity(document.level), explanation: `Imported Sigma rule from ${stringValue(object(document.logsource).product) || 'declared log source'} using bounded field selections.`, conditions })
    }
    return { rules }
}

function sigmaSelectionConditions(value: unknown): { conditions: Condition[] } | { error: string } {
    const selection = object(value)
    const entries = Object.entries(selection)
    if (!entries.length) return { error: 'selection must contain fields.' }
    const conditions: Condition[] = []
    for (const [rawPath, rawValue] of entries) {
        const [path, modifier] = rawPath.split('|', 2)
        if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(path)) return { error: `field '${path}' is outside the bounded field syntax.` }
        const values = Array.isArray(rawValue) ? rawValue : [rawValue]
        const strings = values.map(value => typeof value === 'string' ? value : String(value)).filter(Boolean)
        if (!strings.length || strings.join('|').length > 200) return { error: `field '${path}' has an invalid value.` }
        if (strings.length > 1) {
            conditions.push({ path, operator: 'regex', value: `^(?:${strings.map(escapeRegex).join('|')})$` })
            continue
        }
        const valueText = strings[0]
        if (modifier === 're') conditions.push({ path, operator: 'regex', value: valueText })
        else if (modifier === 'startswith') conditions.push({ path, operator: 'regex', value: `^${escapeRegex(valueText)}` })
        else if (modifier === 'endswith') conditions.push({ path, operator: 'regex', value: `${escapeRegex(valueText)}$` })
        else if (modifier === 'contains' || valueText.includes('*')) conditions.push({ path, operator: 'contains', value: valueText.replaceAll('*', '') })
        else conditions.push({ path, operator: 'equals', value: valueText })
    }
    return { conditions }
}
function sigmaSeverity(value: unknown) { return value === 'critical' || value === 'high' || value === 'medium' || value === 'low' ? value : 'medium' }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rule' }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
export function eventConditionEvidence(value: unknown) {
    const conditions = (value as { conditions?: unknown })?.conditions
    return Array.isArray(conditions) ? conditions.map(condition => typeof condition === 'object' && condition && 'path' in condition ? String(condition.path) : 'condition') : []
}
