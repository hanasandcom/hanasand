import { loadTrafficDomains, loadTrafficMetrics, loadTrafficSummary, loadTrafficRecent, trafficActors } from './legacyAnalytics.ts'
import { loadTrafficRecordTotal } from './legacyRecords.ts'

export async function warmTrafficStatistics() {
    await loadTrafficDomains()
    await loadTrafficRecordTotal(null)
    await loadTrafficMetrics(null)
    await loadTrafficSummary('path')
    await loadTrafficRecent()
    await trafficActors('ip')
    await trafficActors('user_agent')
    void warmKnownDomains().catch(error => console.warn('Traffic domain prewarm failed; it will retry', error))
}

let warmingDomains = false
async function warmKnownDomains() {
    if (warmingDomains) return
    warmingDomains = true
    try {
        for (const domain of (await loadTrafficDomains()).domains) {
            await loadTrafficMetrics(domain)
            await loadTrafficRecordTotal(domain)
        }
    } finally {
        warmingDomains = false
    }
}
