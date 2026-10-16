import assert from 'node:assert/strict'
import test from 'node:test'
import { mapGeometryPath } from '../src/app/ti/components/mapGeometry'
import { project } from '../src/utils/monitoring/liveTrafficMap'

test('map geometry retains polygon and multipolygon projected coordinate paths', () => {
    const ring = [[10, 20], [30, 40]]
    const projected = ring.map(([longitude, latitude]) => project([latitude, longitude]))
    const expectedRing = `M ${projected[0][0]} ${projected[0][1]} L ${projected[1][0]} ${projected[1][1]} Z `

    assert.equal(mapGeometryPath({ type: 'Polygon', coordinates: [ring] }), expectedRing)
    assert.equal(mapGeometryPath({ type: 'MultiPolygon', coordinates: [[ring], [ring]] }), `${expectedRing}${expectedRing}`)
    assert.equal(mapGeometryPath({ type: 'Point', coordinates: [10, 20] }), '')
})
