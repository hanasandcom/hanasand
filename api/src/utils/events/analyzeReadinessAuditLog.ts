import type { CollectorLog } from './analyzeCollector.ts'
import { deflateRawSync } from 'node:zlib'
import type run from '#db'
import { normalizeLogEvent } from './logEvent.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { readinessAuditRuleId, completeReadinessChains, readinessTimingAllowed } from './analyzeReadinessAudit.ts'
import { loadPlatformDropRule } from './platformDropRule.ts'

// Called inside the ingestion transaction. Partial chains are always retained.
export async function analyzeReadinessAuditBatch<T extends CollectorLog>(entries: T[], query: typeof run): Promise<T[]> {
    const chains = completeReadinessChains(entries)
    if (!chains.length) return entries
    const rule = await loadPlatformDropRule(readinessAuditRuleId, query)
    if (!rule) return entries
    const { loadConfiguredRules } = await import('../../handlers/events/ruleStorage.ts')
    const { eventWouldBeProtectedFromDrop } = await import('../../handlers/events/findingEngine.ts')
    const rules = await loadConfiguredRules(rule.organization_id, query), dropped = new Set<CollectorLog>()
    for (const chain of chains) {
        if (!readinessTimingAllowed(chain.fact, rule.definition?.parameters)
            || !await matchesAnalysisPolicy(chain.logs.map(log => normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })), rule.definition)) continue
        if (chain.logs.some(log => eventWouldBeProtectedFromDrop(
            rule.organization_id,
            log.sourceEventId!,
            normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! }),
            rules,
        ))) continue
        const rootId = chain.payload.members[0]!.sourceEventId
        const saved = await query(`INSERT INTO log_readiness_audit_receipts(exec_id,root_source_event_id,chain_digest,original,organization_id)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING exec_id`,
        [chain.fact.execId, rootId, chain.digest, deflateRawSync(JSON.stringify(chain.logs)), rule.organization_id])
        if (!saved.rows.length) {
            const existing = await query('SELECT chain_digest FROM log_readiness_audit_receipts WHERE exec_id=$1 AND root_source_event_id=$2', [chain.fact.execId, rootId])
            if (existing.rows[0]?.chain_digest !== chain.digest) continue
        }
        // One dedicated receipt is one complete four-event cycle, including retries.
        for (const log of chain.logs) dropped.add(log)
    }
    return entries.filter(log => !dropped.has(log))
}
