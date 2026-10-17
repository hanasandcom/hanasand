import { randomUUID } from 'node:crypto'
import run from '#db'
import { matchesRule } from '#utils/events/conditions.ts'
import { ruleCategory } from '#utils/events/ruleList.ts'
import { retainedOriginals } from '#utils/events/retainedOriginals.ts'
import { normalizeLogEvent } from '#utils/events/logEvent.ts'
import { customRetentionAction, type RetentionRule } from '#utils/events/customRetention.ts'
import { matchSecurityRules } from '#utils/events/securityRules.ts'
import { collectAuthFindings } from './authenticationFindings.ts'
import { normalizeEvent } from './eventNormalization.ts'
import { object, stringValue } from './shared.ts'
import type { Event, FindingInput, NormalizedEvent, Rule } from './types.ts'

function enabledRules(event: NormalizedEvent, rules: Rule[]) {
    return new Set(rules.filter(rule => rule.enabled !== false && (rule.source !== 'hanasand'
        || matchesRule(event.normalized, rule.definition?.conditions || []))).map(rule => rule.id))
}

function prepareConfiguredFinding(rules: Rule[], organizationId: string, ruleId: string, severity: string, summary: string, eventIds: string[], evidence: Event) {
    const rule = rules.find(candidate => candidate.id === ruleId)
    return {
        rule,
        finding: [organizationId, ruleId, rule?.severity || severity, summary, eventIds, {
            ...evidence,
            ruleVersion: rule?.version || '1',
            ruleName: rule?.name,
            ruleExplanation: rule?.explanation,
            detectionDefinition: rule?.definition,
        }] as FindingInput,
    }
}

export function collectEventFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: Rule[], includeRetained = true) {
    return collectEventFindingsWithEnabledRules(organizationId, eventId, event, rules, includeRetained, enabledRules(event, rules))
}

export function eventWouldBeProtectedFromDrop(
    organizationId: string,
    eventId: string,
    event: Event,
    rules: Rule[],
    retentionRules: RetentionRule[] = rules,
) {
    if (customRetentionAction(event, retentionRules) === 'keep') return true
    return collectEventFindings(
        organizationId,
        eventId,
        normalizeEvent(event, { vendor: 'Hanasand', product: 'Logs' }),
        rules,
    ).findings.length > 0
}

function collectEventFindingsWithEnabledRules(organizationId: string, eventId: string, event: NormalizedEvent, rules: Rule[], includeRetained: boolean, enabled: Set<string>) {
    const detectionFindings: FindingInput[] = []
    const matchFindings: FindingInput[] = []
    const insertFinding = (org: string, id: string, severity: string, summary: string, eventIds: string[], evidence: Event) => {
        const prepared = prepareConfiguredFinding(rules, org, id, severity, summary, eventIds, evidence)
        const destination = prepared.rule && ruleCategory(prepared.rule) === 'match' ? matchFindings : detectionFindings
        destination.push(prepared.finding)
    }
    for (const rule of matchSecurityRules(event.normalized).filter(rule => enabled.has(rule.id))) {
        insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { process: event.normalized.process, host: event.normalized.host, user: event.normalized.user, eventId })
    }
    for (const rule of rules.filter(rule => rule.source === 'owned' && rule.enabled !== false && rule.definition?.stage === 'detect')) {
        if (rule.definition && matchesRule(event.normalized, rule.definition.conditions)) {
            insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { ruleId: rule.id, matchedConditions: rule.definition.conditions, eventId })
        }
    }
    for (const rule of rules.filter(rule => (rule.source === 'owned' || rule.source === 'open_source') && rule.enabled !== false
        && rule.definition?.stage !== 'analyze' && rule.definition?.stage !== 'detect')) {
        if (rule.definition && matchesRule(event.normalized, rule.definition.conditions))
            insertFinding(organizationId, rule.id, rule.severity, rule.name, [eventId], { ruleId: rule.id, matchedConditions: rule.definition.conditions, eventId })
    }
    if (enabled.has('network.signature_alert.v1') && event.eventType === 'network' && (event.action === 'alert' || stringValue(event.normalized.signature_id) || stringValue(event.normalized.signature))) {
        insertFinding(organizationId, 'network.signature_alert.v1', 'high', `Network signature matched: ${stringValue(event.normalized.signature) || stringValue(event.normalized.signature_id) || 'unlabelled signature'}`, [eventId], { signatureId: stringValue(event.normalized.signature_id), signature: stringValue(event.normalized.signature), protocol: stringValue(object(event.normalized.protocol).name || event.normalized.proto || object(event.normalized.flow).proto), sourceIp: event.sourceIp, destinationIp: stringValue(event.normalized.dest_ip || event.normalized.destip), eventId })
    }
    const vulnerability = object(event.normalized.vulnerability)
    const asset = object(event.normalized.asset)
    const cve = stringValue(event.normalized.cve || event.normalized.cve_id || vulnerability.cve || vulnerability.cve_id)
    const assetId = stringValue(asset.id || asset.asset_id || asset.hostname || event.normalized.asset_id || event.normalized.hostname)
    const assetVersion = stringValue(asset.version || asset.software_version || event.normalized.asset_version || event.normalized.version)
    if (enabled.has('vulnerability.cve_asset_context.v1') && event.eventType === 'vulnerability' && cve && /^CVE-\d{4}-\d{4,}$/i.test(cve) && assetId && assetVersion) {
        insertFinding(organizationId, 'vulnerability.cve_asset_context.v1', 'high', `${cve} reported on ${assetId}`, [eventId], { cve, assetId, assetVersion, eventId })
    }
    // Both initial processing and manual replay must inspect original fields,
    // not only the generic canonical summary. Expansion is one level only.
    if (includeRetained) for (const original of retainedOriginals({ id: eventId, service: String(event.normalized.service || ''),
        host: String(event.normalized.host || ''), level: String(event.normalized.level || ''), message: String(event.normalized.message || ''),
        created_at: event.timestamp, metadata: object(event.normalized.metadata), source_event_id: String(event.normalized.source_event_id || '') })) {
        const originalEvent = normalizeEvent(normalizeLogEvent(original), { vendor: 'Hanasand', product: 'Logs' })
        for (const finding of collectEventFindings(organizationId, eventId, originalEvent, rules, false).findings) {
            const group = rules.find(rule => rule.id === finding[1] && ruleCategory(rule) === 'match') ? matchFindings : detectionFindings
            const existing = group.find(item => item[1] === finding[1])
            if (existing) existing[5].retainedOriginals = [...(existing[5].retainedOriginals as unknown[] || []), originalEvent.normalized]
            else { finding[5].retainedOriginals = [originalEvent.normalized]; group.push(finding) }
        }
    }
    return { enabled, detectionFindings, matchFindings, findings: [...detectionFindings, ...matchFindings] }
}

export async function createFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: Rule[]) {
    const enabled = enabledRules(event, rules)
    const authFindings = await collectAuthFindings(organizationId, eventId, event, rules, enabled,
        (org, id, severity, summary, eventIds, evidence) => prepareConfiguredFinding(rules, org, id, severity, summary, eventIds, evidence).finding)
    const { detectionFindings, matchFindings } = collectEventFindingsWithEnabledRules(organizationId, eventId, event, rules, true, enabled)
    await persistEventFindings([...authFindings, ...detectionFindings])
    await persistEventFindings(matchFindings)
}

// Preserve the same finding identity and restricted-log flag while committing
// bounded groups together, rather than fsyncing once for every matched rule.


export async function persistEventFindings(findings: FindingInput[], query = run) {
    for (let offset = 0; offset < findings.length; offset += 1000) {
        const rows = findings.slice(offset, offset + 1000).map(([organizationId, ruleId, severity, summary, eventIds, evidence]) => ({
            id: randomUUID(), organization_id: organizationId,
            finding_key: `${organizationId}:${ruleId}:${eventIds.slice().sort().join(',')}`,
            rule_id: ruleId, severity, summary, event_ids: eventIds, evidence,
        }))
        await query(`INSERT INTO findings (id, organization_id, finding_key, rule_id, severity, status, summary, evidence, event_ids, first_observed, last_observed)
            SELECT item.id, item.organization_id, item.finding_key, item.rule_id, item.severity, 'new', item.summary,
                item.evidence || jsonb_build_object('restrictedLog', EXISTS (
                    SELECT 1 FROM events e WHERE e.organization_id = item.organization_id
                        AND e.id = ANY(item.event_ids) AND e.ingestion_id = 'logs')),
                item.event_ids, NOW(), NOW()
            FROM jsonb_to_recordset($1::jsonb) AS item(id text, organization_id text, finding_key text,
                rule_id text, severity text, summary text, evidence jsonb, event_ids text[])
            ORDER BY item.finding_key ON CONFLICT (finding_key) DO NOTHING`, [JSON.stringify(rows)])
    }
}
