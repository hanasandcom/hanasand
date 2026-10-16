import assert from 'node:assert/strict'
import { deployProbeReadiness } from '../src/app/api/product-progress/deployReadiness'

const checkedAt = '2026-06-29T13:00:00.000Z'
const ready = deployProbeReadiness({
    generatedAt: checkedAt,
    route: '/api/status',
    sourceProxyOk: true,
    fetch: {
        ok: true,
        status: 200,
        json: {
            productProgressDeployProof: {
                schemaVersion: 'product.deploy_proof_ledger.v1',
                latestProbeAt: checkedAt,
                deployedCommit: 'commit_ready_123',
                frontendHealthy: true,
                apiHealthy: true,
                scraperHealthy: true,
                dashboardAlertId: 'alert_ready_1',
                deliveryId: 'delivery_ready_1',
            },
        },
    },
})
assert.equal(ready.status, 'ready')
assert.equal(ready.deployedCommit, 'commit_ready_123')
assert.equal(ready.dashboardAlertId, 'alert_ready_1')
assert.equal(ready.deliveryId, 'delivery_ready_1')

const degraded = deployProbeReadiness({
    generatedAt: checkedAt,
    route: '/api/status',
    sourceProxyOk: false,
    fetch: {
        ok: true,
        status: 200,
        json: { checks: [
            { service: 'Website', check_name: 'Website', status: 'up', checked_at: checkedAt },
            { service: 'Core platform', check_name: 'API', status: 'down', checked_at: checkedAt },
        ] },
    },
})
assert.equal(degraded.status, 'needs_action')
assert.equal(degraded.apiHealthy, false)
assert.equal(degraded.scraperHealthy, false)
console.log('product-progress deploy readiness behavior ok')
