import { mockCdnIngestDependencies, registerCdnIngestContract } from './cdn-ingest-contract.ts'

mockCdnIngestDependencies()

const { analyzeCdnRefresh } = await import('../src/utils/events/analyzeCdnRefreshLog.ts')
const { cdnRefreshRuleId, cdnRefreshDefinition } = await import('../src/utils/events/analyzeCdnRefresh.ts')
const { fixture } = await import('./support/cdnRefreshFixture.ts')

registerCdnIngestContract({
    feature: 'CDN refresh',
    analyze: analyzeCdnRefresh,
    ruleId: cdnRefreshRuleId,
    definition: cdnRefreshDefinition,
    fixture,
})
