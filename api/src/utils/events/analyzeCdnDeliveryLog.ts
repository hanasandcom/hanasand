import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { cdnDeliveryRuleId, verifyCdnDeliveryEnvelope } from './analyzeCdnDelivery.ts'
import type { CdnRefreshLog } from './analyzeCdnRefresh.ts'
import { matchesAnalysisPolicy } from './analysisPolicy.ts'
import { customRetentionAction, loadLogRetentionRules } from './customRetention.ts'
import { normalizeLogEvent } from './logEvent.ts'
import { loadPlatformDropRule } from './platformDropRule.ts'

export async function analyzeCdnDelivery(log: CdnRefreshLog, query?: typeof run): Promise<boolean> {
    if (!verifyCdnDeliveryEnvelope(log)) return false
    if (!query) return withTransaction(tx => analyzeCdnDelivery(log, tx))
    const rule = await loadPlatformDropRule(cdnDeliveryRuleId, query)
    if (!rule) return false
    const normalized = normalizeLogEvent({ ...log, id: log.sourceEventId!, created_at: log.timestamp! })
    if (!await matchesAnalysisPolicy([normalized], rule.definition)) return false
    if (customRetentionAction(normalized, await loadLogRetentionRules(rule.organization_id, query)) === 'keep') return false
    const { loadConfiguredRules } = await import('../../handlers/events/ruleStorage.ts')
    const { eventWouldBeProtectedFromDrop } = await import('../../handlers/events/findingEngine.ts')
    const configured = await loadConfiguredRules(rule.organization_id, query)
    // Check before the receipt on every retry: a newly installed detector must
    // be able to protect an event that an earlier configuration considered noise.
    // Retention was checked before loading detectors so a keep rule short-circuits.
    if (eventWouldBeProtectedFromDrop(rule.organization_id, log.sourceEventId!, normalized, configured, [])) return false
    const key = createHash('sha256').update(`${cdnDeliveryRuleId}:${log.sourceEventId}`).digest('hex')
    await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, cdnDeliveryRuleId, rule.version])
    return true
}
