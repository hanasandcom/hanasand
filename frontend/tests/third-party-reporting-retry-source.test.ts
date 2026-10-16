import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = read('dashboard/cases/[id]/case-detail/useCaseDetailActions.ts')
const deliveryPanel = read('dashboard/cases/[id]/case-detail/CaseDeliveryPanels.tsx')

test('case detail retries the exact persisted failed report', () => {
    const retryPayload = actions.match(/body: JSON\.stringify\(retryDeliveryId \? \{([\s\S]*?)\} : \{/)
    assert.match(deliveryPanel, /latestDelivery\?\.status === 'failed' && latestDelivery\.retryable === true/)
    assert.match(deliveryPanel, /Retry exact report/)
    assert.match(actions, /latestDelivery\?\.status === 'failed' && latestDelivery\.retryable === true/)
    assert.ok(retryPayload)
    assert.match(retryPayload[1], /organizationId: resolvedOrganizationId\(caseRecord, organizationId\)/)
    assert.match(retryPayload[1], /deliveryId: retryDeliveryId/)
    assert.doesNotMatch(retryPayload[1], /\b(?:alertId|caseId|dedupeKey|dryRun|replay):/)
})

function read(path: string) {
    return readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')
}
