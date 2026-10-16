import { mockCdnIngestDependencies, registerCdnIngestContract } from './cdn-ingest-contract.ts'

mockCdnIngestDependencies()

const { analyzeCdnDelivery } = await import('../src/utils/events/analyzeCdnDeliveryLog.ts')
const { cdnDeliveryRuleId, cdnDeliveryDefinition } = await import('../src/utils/events/analyzeCdnDelivery.ts')
const { fixture } = await import('./support/cdnDeliveryFixture.ts')

registerCdnIngestContract({
    feature: 'CDN delivery',
    analyze: analyzeCdnDelivery,
    ruleId: cdnDeliveryRuleId,
    definition: cdnDeliveryDefinition,
    fixture,
})
