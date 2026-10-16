import { project } from '@/utils/monitoring/liveTrafficMap'

type MapGeometry = { type: string; coordinates: unknown }

export function mapGeometryPath(geometry: MapGeometry) {
    if (geometry.type === 'Polygon') {
        return (geometry.coordinates as number[][][]).map(drawRing).join('')
    }
    if (geometry.type === 'MultiPolygon') {
        return (geometry.coordinates as number[][][][]).flatMap(polygon => polygon.map(drawRing)).join('')
    }
    return ''
}

function drawRing(ring: number[][]) {
    const path = ring.reduce((value, point, index) => {
        const [x, y] = project([point[1], point[0]])
        return `${value}${index === 0 ? 'M' : 'L'} ${x} ${y} `
    }, '')
    return `${path}Z `
}
