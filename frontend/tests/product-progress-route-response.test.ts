import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { getProductProgressPayload } from '../src/app/api/product-progress/response.ts'

const checkedAt = '2026-10-16T10:00:00.000Z'
const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'North', slug: 'north', status: 'active', updatedAt: checkedAt }

function responseFor(path: string, omitOrganizationProof = false) {
    const bodies: Record<string, unknown> = {
        '/api/ti/scraper/control': { ok: true, generatedAt: checkedAt, baseConfigured: true, endpoints: { sourceInventory: { ok: true, status: 200 } } },
        '/api/findings/product': { schemaVersion: 'dwm.product.v1', tenantId: 'tenant-1', watchlist: [{ value: 'credential leak' }], alerts: [{ id: 'alert-1', lastSeenAt: checkedAt }], sourceCoverage: [{ family: 'telegram' }] },
        '/api/ti/search': {
            query: 'LockBit Ransomware', rows: [{ id: 'evidence-1', sourceId: 'source-1', lastSeenAt: checkedAt }],
            publicTiAnswer: { status: 'ready', evidenceLedgerReferences: [{ evidenceId: 'evidence-1', sourceId: 'source-1' }] },
            actionability: {
                schemaVersion: 'ti.query.actionability.v1', sourceProvenance: [{ sourceId: 'source-1' }],
                handoffs: { watchlist: { endpoint: '/api/findings/watchlists' }, alertRebuild: { endpoint: '/api/findings/alerts/rebuild' }, caseCreate: { endpoint: '/api/cases' } },
                sourceFamilyCoverageMatrix: { schemaVersion: 'ti.public_actor.source_family_coverage_matrix.v1', rows: [{ family: 'telegram' }], summary: { publicTiReadyFamilies: ['telegram'], latestCaptureAt: checkedAt } },
            },
        },
        '/api/findings/alerts': { alerts: [{ id: 'alert-1', lastSeenAt: checkedAt }] },
        '/api/findings/alerts/generation-readiness': { schemaVersion: 'dwm.alert_generation_readiness.v1', readyForCustomerDelivery: true, counts: { candidateCount: 1 }, generationEvidenceWindow: { captureIds: ['capture-1'], sourceFamilies: ['telegram'], lastObservedAt: checkedAt } },
        '/api/cases': { cases: [{ id: 'case-1', alertId: 'alert-1', status: 'open' }] },
        '/api/findings/webhooks/deliveries': { deliveries: [{ id: 'delivery-1', alertId: 'alert-1', watchlistId: 'watchlist-1', endpointHash: 'endpoint', attemptedAt: checkedAt, payloadHash: 'payload', status: 'delivered' }] },
        '/api/organizations': { organizations: [organization] },
        '/api/findings/watchlists': { watchlists: [{ id: 'watchlist-1', organizationId: 'org-1', tenantId: 'tenant-1', status: 'active', terms: [{ value: 'credential leak' }] }] },
        '/api/backend/admin/support/access-recovery': { approvals: [] },
        '/api/backend/admin/audit-events': { events: [{ id: 'event-1', createdAt: checkedAt }], detail: { exportProof: { schemaVersion: 'support.audit.export_proof.v1', eventCount: 1, generatedAt: checkedAt } } },
        '/api/status': { overall: 'up', generated_at: checkedAt, checks: [{ service: 'website', status: 'up', checked_at: checkedAt }, { service: 'api', status: 'up', checked_at: checkedAt }] },
        '/api/organizations/org-1/webhooks': { destinations: [{ id: 'webhook-1', organizationId: 'org-1', tenantId: 'tenant-1', name: 'North', kind: 'generic', status: 'active', updatedAt: checkedAt }], destinationAdminProof: { productProgress: { schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1', status: 'ready', destinationCount: 1, activeDestinationCount: 1, deliveryReadyCount: 1 } } },
        '/api/organizations/org-1/alert-readiness': { alertReadiness: { readinessProof: { schemaVersion: 'organization.worker3_ui_readiness_proof.v1', organizationId: 'org-1', actor: { role: 'analyst', canExportActiveTerms: true }, counts: { activeWatchlistTermCount: 1 }, readiness: { organizationCanGenerateAlerts: true, actorCanExportActiveTerms: true } } } },
        '/api/cases/case-1': { schemaVersion: 'product.analyst_case_detail_proof.v1', access: { canMutate: true }, case: { id: 'case-1', alertId: 'alert-1', status: 'open', updatedAt: checkedAt }, timeline: [{ id: 'timeline-1' }] },
    }
    const body = omitOrganizationProof && path === '/api/organizations/org-1/alert-readiness'
        ? { alertReadiness: {} }
        : bodies[path] || {}
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('product-progress response forwards query and scope, then assembles selected org, alert, delivery, and case proof', async() => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: URL, headers: HeadersInit }> = []
    globalThis.fetch = (async(input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input))
        calls.push({ url, headers: init.headers || {} })
        return responseFor(url.pathname)
    }) as typeof fetch
    const request = {
        nextUrl: new URL('http://frontend.test/api/product-progress?q=%20LockBit%20Ransomware%20&organizationId=org-1&tenantId=tenant-1&userEmail=analyst%40example.test&userId=user-1&actor=analyst'),
        headers: new Headers({ cookie: 'session=private', authorization: 'Bearer test-token', 'x-tenant-id': 'tenant-1', 'x-organization-id': 'org-1' }),
    }
    try {
        const payload = await getProductProgressPayload(request, { now: () => checkedAt, activeOrganizationId: async() => undefined })
        assert.equal(payload.publicTiProvenance.query, 'LockBit Ransomware')
        assert.equal(payload.routes.publicTiProvenance, '/api/ti/search?q=LockBit%20Ransomware&limit=10')
        assert.equal(payload.dashboardEvidence?.alertId, 'alert-1')
        assert.equal(payload.dashboardEvidence?.deliveryId, 'delivery-1')
        assert.equal(payload.analystWorkflow?.caseId, 'case-1')
        assert.equal(payload.analystWorkflow?.caseDetailReady, true)
        assert.equal(payload.orgAlertExport?.organizationId, 'org-1')
        assert.equal(payload.publicTiProvenance.status, 'ready')
        assert.equal(payload.publicTiProvenance.artifactCount, 1)
        assert.equal(payload.helpdeskAudit.status, 'ready')
        assert.equal(payload.helpdeskAudit.auditedActions, 1)
        assert.equal(calls.find(({ url }) => url.pathname === '/api/ti/search')?.url.searchParams.get('q'), 'LockBit Ransomware')
        assert.ok(calls.some(({ url }) => url.pathname === '/api/organizations/org-1/alert-readiness'))
        assert.ok(calls.some(({ url }) => url.pathname === '/api/cases/case-1'))
        for (const { url, headers } of calls) {
            assert.equal(url.searchParams.get('organizationId'), 'org-1', url.pathname)
            assert.equal(url.searchParams.get('tenantId'), 'tenant-1', url.pathname)
            assert.equal(url.searchParams.get('userEmail'), 'analyst@example.test', url.pathname)
            assert.equal(url.searchParams.get('userId'), 'user-1', url.pathname)
            assert.equal(url.searchParams.get('actor'), 'analyst', url.pathname)
            const forwarded = new Headers(headers)
            assert.equal(forwarded.get('cookie'), 'session=private')
            assert.equal(forwarded.get('authorization'), 'Bearer test-token')
        }
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('successful organization and watchlist reads stay degraded when readiness proof is absent', async() => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async(input: RequestInfo | URL) => {
        return responseFor(new URL(String(input)).pathname, true)
    }) as typeof fetch
    const request = {
        nextUrl: new URL('http://frontend.test/api/product-progress?organizationId=org-1&tenantId=tenant-1'),
        headers: new Headers(),
    }
    try {
        const payload = await getProductProgressPayload(request, { now: () => checkedAt })
        assert.equal(payload.orgAlertExport?.organizationId, 'org-1')
        assert.equal(payload.orgAlertExport?.activeTermCount, 1)
        assert.equal(payload.orgAlertExport?.status, 'needs_action')
        assert.equal(payload.orgAlertExport?.canGenerateAlerts, false)
        assert.equal(payload.orgAlertExport?.unavailableReason, 'missing_org_alert_export_readiness_api')
        assert.ok(payload.orgAlertExport?.blockers?.some(blocker => /eligibility details were not returned/i.test(blocker)))
        assert.equal(payload.entitlement?.allowed, false)
        assert.ok(payload.entitlement?.unavailableReason)
    } finally {
        globalThis.fetch = originalFetch
    }
})
