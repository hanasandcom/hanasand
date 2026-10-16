import assert from 'node:assert/strict'
import { webhookHealthReadiness, webhookProductProgressProof } from '../src/app/api/product-progress/webhookReadiness'

const checkedAt = '2026-06-29T14:00:00.000Z'
const organization = { id: 'org_acme', tenantId: 'tenant_acme', name: 'Acme', slug: 'acme', status: 'active' as const, createdAt: checkedAt, updatedAt: checkedAt }
const destinations = [{ id: 'dest_1', organizationId: organization.id, tenantId: organization.tenantId, name: 'Alerts', kind: 'generic' as const, status: 'active' as const, createdAt: checkedAt, updatedAt: checkedAt, lastTestedAt: checkedAt }]
const deliveries = [{ id: 'delivery_1', alertId: 'alert_1', watchlistId: 'watchlist_1', endpointHash: 'endpoint_hash', payloadHash: 'payload_hash', status: 'delivered', attemptedAt: checkedAt }]
const productProgress = {
    schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
    status: 'ready' as const,
    destinationCount: 1,
    activeDestinationCount: 1,
    deliveryReadyCount: 1,
    blockerCodes: [],
}
assert.deepEqual(webhookProductProgressProof({
    ok: true,
    status: 200,
    json: { destinationAdminProof: { productProgress } },
}), productProgress)
assert.equal(webhookProductProgressProof({
    ok: true,
    status: 200,
    json: { destinationAdminProof: { productProgress: { ...productProgress, schemaVersion: 'unexpected.v1' } } },
}), undefined)

const ready = webhookHealthReadiness({
    generatedAt: checkedAt,
    route: `/api/organizations/${organization.id}/webhooks`,
    organization,
    fetchOk: true,
    fetchStatus: 200,
    destinations,
    deliveries,
    productProgress: {
        schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
        status: 'ready',
        destinationCount: 1,
        activeDestinationCount: 1,
        deliveryReadyCount: 1,
        blockerCodes: [],
        href: '/automation?setup=dwm',
    },
})
assert.equal(ready.status, 'ready')
assert.equal(ready.activeDestinationCount, 1)
assert.equal(ready.deliveryReadyCount, 1)

const noDurableReceipt = webhookHealthReadiness({
    generatedAt: checkedAt,
    route: `/api/organizations/${organization.id}/webhooks`,
    organization,
    fetchOk: true,
    fetchStatus: 200,
    destinations,
    deliveries: [{ id: 'delivery_pending', alertId: 'alert_1', watchlistId: 'watchlist_1', endpointHash: 'endpoint_hash', payloadHash: 'payload_hash', status: 'sent', attemptedAt: checkedAt }],
})
assert.equal(noDurableReceipt.status, 'needs_action')
assert.equal(noDurableReceipt.deliveryReadyCount, 0)
console.log('product-progress webhook readiness behavior ok')
