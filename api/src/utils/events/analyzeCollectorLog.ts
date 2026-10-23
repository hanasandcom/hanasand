import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { collectorRuleId, eligibleCollectorExecution, verifyCollectorExecutionEvidence, type CollectorLog } from './analyzeCollector.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { loadPlatformDropRule } from './platformDropRule.ts'

export async function analyzeCollectorExecution(log: CollectorLog, query?: typeof run): Promise<boolean> {
    if (!verifyCollectorExecutionEvidence(log)) return false
    if (!query) return withTransaction(tx => analyzeCollectorExecution(log, tx))
    const rule = await loadPlatformDropRule(collectorRuleId, query)
    if (!rule || !eligibleCollectorExecution(log, rule.definition?.parameters)) return false
    const original = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (!await matchesAnalysisPolicy([original], rule.definition)) return false
    const { loadConfiguredRules } = await import('../../handlers/events/ruleStorage.ts')
    const { eventWouldBeProtectedFromDrop } = await import('../../handlers/events/findingEngine.ts')
    const rules = await loadConfiguredRules(rule.organization_id, query)
    if (eventWouldBeProtectedFromDrop(rule.organization_id, log.sourceEventId!, original, rules)) return false
    // The compact receipt both counts the drop and deduplicates collector retries.
    // Any database failure rolls back ingestion, preserving the queued original.
    const key = createHash('sha256').update(`${collectorRuleId}:${log.sourceEventId}`).digest('hex')
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, collectorRuleId, rule.version])
    return true
}
