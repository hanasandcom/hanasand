import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { helpdeskAuditReadiness } from '../src/app/api/product-progress/helpdeskReadiness.ts'
import { publicTiProvenanceReadiness } from '../src/app/api/product-progress/publicTiReadiness.ts'

test('live helpdesk and public TI responses produce readiness from their evidence', () => {
    const generatedAt = '2026-10-16T10:00:00.000Z'
    const helpdesk = helpdeskAuditReadiness({
        generatedAt, recoveryRoute: '/api/backend/admin/support/access-recovery', auditRoute: '/api/backend/admin/audit-events?limit=50',
        recovery: { ok: true, status: 200, json: { approvals: [{ id: 'request-1', status: 'pending' }] } },
        audit: { ok: true, status: 200, json: { events: [{ id: 'event-1', createdAt: generatedAt }], detail: { exportProof: { schemaVersion: 'support.audit.export_proof.v1', eventCount: 1, generatedAt } } } },
    })
    assert.equal(helpdesk.status, 'ready')
    assert.equal(helpdesk.auditedActions, 1)
    assert.equal(helpdesk.openRecoveryRequests, 1)

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
