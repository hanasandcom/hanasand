import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module to registered frontend tests.
import { test } from 'bun:test'
import type { DashboardSourceProofProxyPayload } from '../src/utils/productProgress/payloadTypes'
import { buildSourceProofReadinessFromProxy } from '../src/app/dashboard/operatorConsoleModel'

const checkedAt = '2026-08-09T00:00:00.000Z'
const route = '/api/ti/scraper/control'
const inventoryOnlyProxy: DashboardSourceProofProxyPayload = {
    ok: true,
    baseConfigured: true,
    endpoints: { sourceInventory: { ok: true, status: 200 } },
    generatedAt: checkedAt,
    sourceInventory: {
        schemaVersion: 'dwm.source_inventory.v1',
        generatedAt: checkedAt,
        counts: { registeredTotal: 1000, registeredActiveOrCanary: 1000 },
    },
}

function readinessFor(sourceInventory = inventoryOnlyProxy.sourceInventory) {
    return buildSourceProofReadinessFromProxy({ ...inventoryOnlyProxy, sourceInventory }, { route, checkedAt })
}

test('registered source counts alone do not prove collection readiness', () => {
    const readiness = readinessFor()

    assert.equal(readiness.status, 'needs_action')
    assert.equal(readiness.activeSourceCount, 1000)
    assert.equal(readiness.workerStatus, 'missing')
    assert.ok(readiness.blockers?.includes(`Source-pack state is loading through ${route}.`))
})

test('an unrecognized inventory schema stays blocked even when the endpoint responds', () => {
    const readiness = readinessFor({
        ...inventoryOnlyProxy.sourceInventory,
        schemaVersion: 'dwm.source_inventory.v0',
    })

    assert.equal(readiness.status, 'blocked')
    assert.equal(readiness.inventoryReachable, false)
    assert.equal(readiness.activeSourceCount, 1000)
    assert.ok(readiness.blockers?.includes(`Source inventory state is loading through ${route}.`))
})
