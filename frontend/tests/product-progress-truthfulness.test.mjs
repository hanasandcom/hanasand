import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { publicTiProvenanceReadiness } from '../src/app/api/product-progress/publicTiReadiness.ts'

test('public TI responses produce readiness from their evidence', () => {
    const generatedAt = '2026-10-16T10:00:00.000Z'
    const publicTi = publicTiProvenanceReadiness({
        generatedAt, query: 'LockBit', route: '/api/ti/search?q=LockBit',
        fetch: { ok: true, status: 200, json: {
            query: 'LockBit', rows: [{ id: 'evidence-1', sourceId: 'source-1', lastSeenAt: generatedAt }],
            publicTiAnswer: { status: 'ready', evidenceLedgerReferences: [{ evidenceId: 'evidence-1', sourceId: 'source-1' }] },
            actionability: {
                schemaVersion: 'ti.query.actionability.v1', sourceProvenance: [{ sourceId: 'source-1' }],
                handoffs: { watchlist: { endpoint: '/api/findings/watchlists' }, alertRebuild: { endpoint: '/api/findings/alerts/rebuild' }, caseCreate: { endpoint: '/api/cases' } },
                sourceFamilyCoverageMatrix: { schemaVersion: 'ti.public_actor.source_family_coverage_matrix.v1', rows: [{ family: 'telegram' }], summary: { publicTiReadyFamilies: ['telegram'], latestCaptureAt: generatedAt } },
            },
        } },
    })
    assert.equal(publicTi.status, 'ready')
    assert.equal(publicTi.query, 'LockBit')
    assert.equal(publicTi.sourceCount, 1)
    assert.equal(publicTi.handoffRouteCount, 3)
})
