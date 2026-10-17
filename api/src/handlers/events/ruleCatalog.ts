import { applicationErrorRule, applicationErrorRuleId, applicationErrorDefinition } from '#utils/events/applicationError.ts'
import { cdnDeliveryRule, cdnDeliveryRuleId, cdnDeliveryDefinition } from '#utils/events/analyzeCdnDelivery.ts'
import { sshTransportRule, sshTransportRuleId, sshTransportDefinition } from '#utils/events/analyzeSshTransport.ts'
import { eventProtectionRule, eventProtectionRuleId, eventProtectionDefinition, normalizeEventProtection } from '#utils/events/eventProtection.ts'
import { ingestionRule, ingestionRuleId, ingestionDefinition } from '#utils/events/analyzeIngestion.ts'
import { cdnRefreshRule, cdnRefreshRuleId, cdnRefreshDefinition } from '#utils/events/analyzeCdnRefresh.ts'
import { modelDiscoveryRule, modelDiscoveryRuleId, modelDiscoveryDefinition, modelDiscoveryConfigured, modelDiscoveryUnavailableReason, modelHealthRule, modelHealthRuleId, modelHealthDefinition } from '#utils/events/analyzeModelDiscovery.ts'
import { readinessAuditRule, readinessAuditRuleId, readinessAuditDefinition, readinessAuditConfigured, readinessAuditUnavailable } from '#utils/events/analyzeReadinessAudit.ts'
import { telemetryRule, telemetryRuleId, sshWindowRule, sshWindowRuleId, telemetryDefinition, sshWindowDefinition, validateRoutineGroupParameters } from '#utils/events/analyzeRoutineGroups.ts'
import { collectorRule, collectorRuleId, collectorDefinition } from '#utils/events/analyzeCollector.ts'
import { proxyRule, proxyRuleId, proxyDefinition } from '#utils/events/analyzeProxy.ts'
import { postgresRule, postgresRuleId, postgresDefinition, validPostgresParameters } from '#utils/events/analyzePostgres.ts'
import { securityRules } from '#utils/events/securityRules.ts'
import { mongoRule, mongoRuleId, mongoDefinition } from '#utils/events/analyzeMongo.ts'
import { accessRule, accessRuleId, accessDefinition, accountDeleteRule, accountDeleteRuleId, accountDeleteDefinition } from '#utils/events/analyzeAccess.ts'
import { normalizeConditions } from './sigma.ts'
import { object } from './shared.ts'
import type { Rule, RuleDefinition } from './types.ts'

export const platformRetentionRuleIds = new Set([
    accessRuleId, mongoRuleId, postgresRuleId, proxyRuleId, ingestionRuleId,
    collectorRuleId, telemetryRuleId, sshWindowRuleId, cdnRefreshRuleId,
    cdnDeliveryRuleId, modelDiscoveryRuleId, modelHealthRuleId, readinessAuditRuleId,
])

export function isPlatformRetentionRule(rule: Pick<Rule, 'id' | 'definition'>) {
    return platformRetentionRuleIds.has(rule.id) || rule.definition?.stage === 'analyze'
}

export const BUILTIN_RULES: Rule[] = [
    applicationErrorRule,
    eventProtectionRule,
    cdnRefreshRule,
    cdnDeliveryRule,
    modelDiscoveryRule,
    modelHealthRule,
    readinessAuditRule,
    telemetryRule,
    sshWindowRule,
    sshTransportRule,
    collectorRule,
    postgresRule,
    accessRule,
    accountDeleteRule,
    proxyRule,
    ingestionRule,
    mongoRule,
    ...securityRules.map(({ id, name, family, severity, explanation }) => ({ id, name, family, severity, explanation, version: '1', evidence: ['process executable', 'command line', 'host', 'user'] })),
    { id: 'auth.brute_force_success.v1', version: '1', name: 'Brute-force success', family: 'Authentication', severity: 'high', explanation: 'Multiple failed logins followed by a successful login for the same user.', evidence: ['failed event IDs', 'successful event ID', 'time window'] },
    { id: 'auth.password_spray.v1', version: '1', name: 'Password spray', family: 'Authentication', severity: 'high', explanation: 'One source IP produced failed logins for multiple users within 15 minutes.', evidence: ['source IP', 'target user IDs', 'failed event IDs', 'time window'] },
    { id: 'auth.impossible_travel.v1', version: '1', name: 'Impossible travel', family: 'Authentication', severity: 'high', explanation: 'Successful logins for one user occurred more than 500 km apart within 12 hours, with coordinates present in both events.', evidence: ['coordinates', 'distance', 'elapsed time', 'related event IDs'] },
    { id: 'auth.new_country.v1', version: '1', name: 'New country', family: 'Authentication', severity: 'medium', explanation: 'A successful login came from a country not seen in the user’s recent successful login history.', evidence: ['current country', 'previous country', 'related event IDs'] },
    { id: 'auth.new_device.v1', version: '1', name: 'New device', family: 'Authentication', severity: 'medium', explanation: 'A successful login used a device identifier not seen in the user’s recent successful login history.', evidence: ['current device', 'previous device', 'related event IDs'] },
    { id: 'network.signature_alert.v1', version: '1', name: 'Network signature alert', family: 'Network Detection', severity: 'high', explanation: 'A network telemetry record reported a matched signature with protocol and flow context.', evidence: ['signature ID or name', 'source and destination', 'protocol', 'event ID'] },
    { id: 'vulnerability.cve_asset_context.v1', version: '1', name: 'CVE on identified asset', family: 'Vulnerability', severity: 'high', explanation: 'A vulnerability event linked a CVE to an identified asset and version, giving analysts context for prioritization.', evidence: ['CVE', 'asset ID or hostname', 'asset version', 'event ID'] },
]

// Stored IDs remain unchanged so existing findings and organization overrides retain their lineage.
export function ruleSlug(id: string) { return id.replace(/\.v\d+$/, '') }
export function findConfiguredRule(rules: Rule[], id: string) {
    return rules.find(rule => ruleSlug(rule.id) === ruleSlug(id) || rule.recordId === id)
}
export function defaultRuleDefinition(id: string): RuleDefinition {
    if (id === applicationErrorRuleId) return structuredClone(applicationErrorDefinition)
    if (id === cdnDeliveryRuleId) return structuredClone(cdnDeliveryDefinition)
    if (id === cdnRefreshRuleId) return structuredClone(cdnRefreshDefinition)
    if (id === modelDiscoveryRuleId) return structuredClone(modelDiscoveryDefinition)
    if (id === modelHealthRuleId) return structuredClone(modelHealthDefinition)
    if (id === readinessAuditRuleId) return structuredClone(readinessAuditDefinition)
    if (id === telemetryRuleId) return structuredClone(telemetryDefinition)
    if (id === sshTransportRuleId) return structuredClone(sshTransportDefinition)
    if (id === sshWindowRuleId) return structuredClone(sshWindowDefinition)
    if (id === eventProtectionRuleId) return { ...structuredClone(eventProtectionDefinition), parameters: {} }
    if (id === collectorRuleId) return structuredClone(collectorDefinition)
    if (id === postgresRuleId) return structuredClone(postgresDefinition)
    if (id === ingestionRuleId) return structuredClone(ingestionDefinition)
    if (id === proxyRuleId) return structuredClone(proxyDefinition)
    if (id === mongoRuleId) return structuredClone(mongoDefinition)
    if (id === accessRuleId) return structuredClone(accessDefinition)
    if (id === accountDeleteRuleId) return structuredClone(accountDeleteDefinition)
    const parameters: Record<string, number> = {}
    if (['auth.brute_force_success', 'auth.password_spray'].includes(ruleSlug(id))) Object.assign(parameters, { windowMinutes: 15, minimumCount: 3 })
    if (ruleSlug(id) === 'auth.impossible_travel') Object.assign(parameters, { windowMinutes: 720, distanceKm: 500, historyLimit: 30 })
    if (['auth.new_country', 'auth.new_device'].includes(ruleSlug(id))) parameters.historyLimit = 30
    return { match: 'all', conditions: [], parameters, ...(ruleSlug(id) === 'auth.brute_force_success' ? { failureConditions: [] } : {}) }
}
export function builtinDefinition(rule: Rule, value?: unknown): RuleDefinition {
    const defaults = defaultRuleDefinition(rule.id)
    const stored = object(value)
    return { ...defaults, ...stored, parameters: { ...defaults.parameters, ...object(stored.parameters) } } as RuleDefinition
}
export function unavailableAnalysisRule(id: string) {
    if (id === readinessAuditRuleId && !readinessAuditConfigured()) return readinessAuditUnavailable
    if (id === modelDiscoveryRuleId && !modelDiscoveryConfigured()) return modelDiscoveryUnavailableReason
    return null
}

export function normalizeBuiltinDefinition(id: string, value: unknown): { definition?: RuleDefinition, error?: string } {
    const input = object(value), defaults = defaultRuleDefinition(id)
    if (unavailableAnalysisRule(id) && input.action === 'drop') return { error: unavailableAnalysisRule(id)! }
    if (!value || typeof value !== 'object' || Array.isArray(value) || input.match !== 'all') return { error: 'Detection must use match: all.' }
    if (Object.keys(input).some(key => !['match', 'conditions', 'parameters', ...(defaults.stage ? ['stage', 'action'] : []), ...(defaults.protection ? ['protection'] : []), ...(defaults.failureConditions ? ['failureConditions'] : [])].includes(key))) return { error: 'Unsupported detection setting.' }
    const definition: RuleDefinition = { ...defaults, parameters: { ...defaults.parameters } }
    if (defaults.protection) {
        const result = normalizeEventProtection(input.protection)
        if (result.error) return { error: result.error }
        if (input.action !== 'keep') return { error: 'A protection rule must use Store. Disable it to stop retaining its matches.' }
        definition.protection = result.protection
    }
    if (id === applicationErrorRuleId && input.action !== 'keep') return { error: 'Application errors must use Store.' }
    if (defaults.stage) {
        const configuredPolicy = [applicationErrorRuleId, modelDiscoveryRuleId, modelHealthRuleId, readinessAuditRuleId, proxyRuleId, ingestionRuleId, telemetryRuleId, sshWindowRuleId, sshTransportRuleId, collectorRuleId, cdnRefreshRuleId, cdnDeliveryRuleId, postgresRuleId, accessRuleId, accountDeleteRuleId, mongoRuleId].includes(id)
        if (input.stage !== 'analyze' || !['drop', 'keep'].includes(String(input.action)) || !Array.isArray(input.conditions) || (!configuredPolicy && input.conditions.length)) return { error: 'Choose Keep or Count and drop. The required safety checks cannot be removed.' }
        definition.action = input.action as 'drop' | 'keep'
    }
    for (const key of ['conditions', ...(defaults.failureConditions ? ['failureConditions'] : [])] as Array<'conditions' | 'failureConditions'>) {
        if (!Array.isArray(input[key])) return { error: `${key} must be an array.` }
        const result = input[key].length ? normalizeConditions(input[key], defaults.stage ? 32 : 8) : { conditions: [] }
        if (result.error) return { error: result.error }
        definition[key] = result.conditions
    }
    const parameters = object(input.parameters)
    if (!input.parameters || typeof input.parameters !== 'object' || Array.isArray(input.parameters) || Object.keys(parameters).some(key => !(key in defaults.parameters!))) return { error: 'Unsupported engine parameter.' }
    if (id === postgresRuleId) {
        if (!validPostgresParameters(parameters)) return { error: 'Invalid PostgreSQL session timing parameters.' }
        definition.parameters = parameters
        return { definition }
    }
    if ([telemetryRuleId, sshWindowRuleId, sshTransportRuleId].includes(id)) {
        const error = validateRoutineGroupParameters(id, parameters)
        if (error) return { error }
        definition.parameters = parameters as Record<string, number>
        return { definition }
    }
    const limits: Record<string, [number, number]> = { windowMinutes: [1, id === accountDeleteRuleId ? 10 : defaults.stage ? 5 : 10080], requestThreshold: [1, 1000], burstWindowMinutes: [1, 10], burstRequestThreshold: [1, 1000], alertCooldownMinutes: [1, 60], minimumCount: [1, 1000], distanceKm: [1, 20040], historyLimit: [1, 1000], maxDurationMs: [1, 60000], minIntervalMs: [1, 3600000], maxIntervalMs: [1, 3600000] }
    for (const key of Object.keys(defaults.parameters!)) {
        if (!limits[key]) return { error: `Unsupported engine parameter: ${key}.` }
        const value = parameters[key], [min, max] = limits[key]
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return { error: `${key} must be a whole number from ${min} to ${max}.` }
        definition.parameters![key] = value
    }
    if (definition.parameters!.minIntervalMs > definition.parameters!.maxIntervalMs) return { error: 'Maximum interval must be at least the minimum interval.' }
    return { definition }
}
