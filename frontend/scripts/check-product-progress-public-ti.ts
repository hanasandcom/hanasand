import assert from 'node:assert/strict'
import { publicTiProvenanceReadiness } from '../src/app/api/product-progress/publicTiReadiness'

const checkedAt = '2026-06-29T09:00:00.000Z'
const actionability = {
    schemaVersion: 'ti.query.actionability.v1',
    sourceProvenance: [{ sourceId: 'source_telegram', provenance: 'telegram_public', captureId: 'capture_1' }],
    handoffs: {
        watchlist: { endpoint: '/api/findings/watchlists', missing: [] },
        alertRebuild: { endpoint: '/api/findings/alerts/rebuild', missing: [] },
        caseCreate: { endpoint: '/api/cases', missing: [] },
    },
    sourceFamilyCoverageMatrix: {
        schemaVersion: 'ti.public_actor.source_family_coverage_matrix.v1',
        rows: [{ family: 'telegram', status: 'ready' }],
        summary: { publicTiReadyFamilies: ['telegram'], alertReadyFamilies: ['telegram'], latestCaptureAt: checkedAt },
    },
}
const payload = {
    query: 'apt49',
    rows: [{ id: 'row_1', sourceId: 'source_telegram', updatedAt: checkedAt }],
    publicTiAnswer: { status: 'ready', evidenceLedgerReferences: [{ sourceId: 'source_telegram', evidenceId: 'evidence_1' }] },
    quality: { publicWarningCodes: [] },
    actionability,
}

const ready = publicTiProvenanceReadiness({
    generatedAt: checkedAt,
    query: 'apt49',
    route: '/api/ti/search?q=apt49',
    fetch: { ok: true, status: 200, json: payload },
})
assert.equal(ready.status, 'ready')
assert.equal(ready.actionabilityReady, true)
assert.equal(ready.artifactCount, 1)
assert.equal(ready.sourceCount, 1)
assert.equal(ready.handoffRouteCount, 3)

const missingMatrix = publicTiProvenanceReadiness({
    generatedAt: checkedAt,
    query: 'apt49',
    route: '/api/ti/search?q=apt49',
    fetch: { ok: true, status: 200, json: { ...payload, actionability: { ...actionability, sourceFamilyCoverageMatrix: undefined } } },
})
assert.equal(missingMatrix.status, 'needs_action')
assert.ok(missingMatrix.blockers?.some(blocker => blocker.includes('source_family_coverage_matrix.v1')))
console.log('product-progress public-TI readiness behavior ok')
