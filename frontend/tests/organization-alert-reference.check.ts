import { strict as assert } from 'node:assert'
import test from 'node:test'
import { alertGenerationReference } from '../src/app/organizations/organizationWorkspaceClient'
import { organizationWorkspaceSource } from './organization-workspace-source.mjs'

test('organization workspace normalizes structured alert references without fake alert fallbacks', async () => {
    assert.equal(alertGenerationReference('watch-direct'), 'watch-direct')
    assert.equal(alertGenerationReference({ dedupe: { key: 'org:acme:watchlist:item' }, watchlistItemId: 'fallback' }), 'org:acme:watchlist:item')
    assert.equal(alertGenerationReference({ watchlistItemId: 'watch-item' }), 'watch-item')
    assert.equal(alertGenerationReference({}), undefined)

    const page = organizationWorkspaceSource
    assert.doesNotMatch(page, /liveDwmAlertId/)
    assert.doesNotMatch(page, /dwm_alert_c6ef012afc7016b5/)
    assert.doesNotMatch(page, /DestinationControls/)
})
