import mapData from '@parent/public/world.json'
import { project } from '@/utils/monitoring/liveTrafficMap'

export const worldMapPaths = mapData.features.map((feature, index) => {
    let d = ''

    function drawRing(ring: number[][]) {
        return ring.reduce((path, point, pointIndex) => {
            const [x, y] = project([point[1], point[0]])
            return `${path}${pointIndex === 0 ? 'M' : 'L'} ${x} ${y} `
        }, '') + 'Z '
    }

    if (feature.geometry.type === 'Polygon') {
        ;(feature.geometry.coordinates as number[][][]).forEach((ring) => { d += drawRing(ring) })
    } else if (feature.geometry.type === 'MultiPolygon') {
        ;(feature.geometry.coordinates as number[][][][]).forEach((polygon) => {
            polygon.forEach((ring) => { d += drawRing(ring) })
        })
    }

    return <path key={index} d={d} className='fill-ui-raised stroke-ui-border stroke-[0.6] transition-colors hover:fill-ui-border' />
})
