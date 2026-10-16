import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { buildOrgOperatingContext } from '../src/app/dashboard/orgOperatingContext.ts'
import { checkedAt, delivered, externalReadiness, operationSnapshot, organization, organizationState, watchlists } from './helpers/productReadinessFixtures.ts'

test('organization context maps live org data and marks the full customer chain ready', () => {
    const context = buildOrgOperatingContext({
        backendConfigured: true, scope: { tenantId: organization.tenantId, organizationId: organization.id },
        organizationState: organizationState(), watchlists, operations: operationSnapshot(), deliveries: [delivered],
        liveAlertCount: 1, liveAlertIds: ['alert-1'], externalReadiness,
    })
    const readiness = context.readiness
    assert.equal(readiness.fullChainReady, true)
    assert.deepEqual(readiness.fullChainBlockedBy, [])
    assert.equal(context.organization?.id, organization.id)
    assert.equal(context.scope.organizationId, organization.id)
    assert.equal(readiness.activeMemberCount, 1)
    assert.equal(readiness.pendingInviteCount, 1)
    assert.equal(readiness.activeWatchlistCount, 1)
    assert.equal(readiness.termCount, 1)
    assert.equal(readiness.activeWebhookCount, 1)
    assert.deepEqual(readiness.sourceCoverage, { sourceCount: 3, activeSourceCount: 3, captureCount: 4, watchlistMatchCount: 2, latestRunStatus: 'completed', latestRunAt: checkedAt })
    assert.equal(readiness.latestDelivery?.id, delivered.id)
    assert.equal(readiness.productReadiness.find(row => row.id === 'webhook_delivery')?.status, 'ready')
    assert.match(readiness.productReadiness.find(row => row.id === 'webhook_delivery')?.detail || '', /delivery-1/)
    assert.ok(context.createWatchlistAction?.body && (context.createWatchlistAction.body as Record<string, unknown>).organizationId === organization.id)
})

test('organization context reports degraded state when live org dependencies are absent', () => {
    const context = buildOrgOperatingContext({
        backendConfigured: false, scope: { tenantId: 'tenant-1' },
        organizationState: organizationState({ organizations: [], selectedOrganization: undefined, members: [], pendingInvites: [], webhooks: [] }),
        watchlists: [], operations: null, deliveries: [], liveAlertCount: 0,
    })
    assert.equal(context.readiness.fullChainReady, false)
    assert.ok(context.readiness.fullChainBlockedBy.length > 0)
    assert.ok(context.readiness.blockedReasons.some(reason => reason.includes('Organization context is syncing')))
    assert.equal(context.createWatchlistAction, undefined)
    assert.ok(context.links.some(link => link.href === '/api/organizations'))
})
