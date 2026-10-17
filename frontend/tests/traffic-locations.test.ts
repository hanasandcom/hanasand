import assert from 'node:assert/strict'
import { countryIsoForTrafficRecord, hydrateCountries, panViewBox, zoomViewBoxAtPointer } from '../src/utils/monitoring/liveTrafficMap'
import type { TrafficRecord } from '../src/utils/monitoring/types'
const record = { id: 1, domain: 'example.no', path: '/', timestamp: new Date().toISOString() } as TrafficRecord
assert.equal(countryIsoForTrafficRecord(record), '', 'A destination domain does not identify the visitor location')
assert.deepEqual(hydrateCountries([record]), {}, 'Missing geography must not generate map activity')
const known = { ...record, country_iso: 'US' }
assert.equal(countryIsoForTrafficRecord(known), 'US')
assert.equal(hydrateCountries([known]).US.count, 1)
assert.deepEqual(hydrateCountries([known]), hydrateCountries([known]), 'Snapshots replace counts instead of replaying traffic')

const viewBox = { x: 100, y: 50, width: 500, height: 250 }
assert.deepEqual(
    panViewBox({ x: 200, y: 100, viewBox }, { x: 220, y: 110 }, { width: 1000, height: 500 }),
    { x: 90, y: 45, width: 500, height: 250 },
    'Traffic-map dragging scales both axes from the rendered viewport dimensions',
)
assert.deepEqual(
    panViewBox({ x: 200, y: 100, viewBox }, { x: 230, y: 115 }, { width: 600, height: 300 }),
    { x: 75, y: 37.5, width: 500, height: 250 },
    'Actor-map dragging keeps its fixed map dimensions on both axes',
)
assert.deepEqual(
    panViewBox({ x: 200, y: 100, viewBox }, { x: 1000, y: 700 }, { width: 1000, height: 500 }),
    { x: 0, y: 0, width: 500, height: 250 },
    'Dragging beyond the minimum map bounds clamps both axes',
)
assert.deepEqual(
    zoomViewBoxAtPointer(viewBox, viewBox, { x: 810, y: 370 }, { left: 10, top: 20, width: 1000, height: 500 }, 1),
    { x: 52, y: 29, width: 560, height: 280 },
    'Traffic-map wheel zoom stays centered on a non-center pointer on both axes',
)
assert.deepEqual(
    zoomViewBoxAtPointer(viewBox, viewBox, { x: 460, y: 95 }, { left: 10, top: 20, width: 600, height: 300 }, -1),
    { x: 145, y: 57.5, width: 440, height: 220 },
    'Actor-map wheel zoom stays centered on a non-center pointer on both axes',
)
console.log('PASS: only recorded locations appear, unknown locations stay unknown, snapshots are repeatable.')
