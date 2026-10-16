import { strict as assert } from 'node:assert'
import { organizationWorkspaceSource } from './organization-workspace-source.mjs'
import test from 'node:test'

const source = organizationWorkspaceSource

test('organization history retries the exact persisted failed report', () => {
    const start = source.indexOf('const replayDelivery =')
    const end = source.indexOf('const createSavedDestination =', start)
    const retrySource = source.slice(start, end)

    assert.notEqual(start, -1)
    assert.match(retrySource, /organizationId: selectedOrganization\.id/)
    assert.match(retrySource, /deliveryId: delivery\.id/)
    assert.doesNotMatch(retrySource, /\b(?:alertId|caseId|dedupeKey|dryRun|replay):/)
})
