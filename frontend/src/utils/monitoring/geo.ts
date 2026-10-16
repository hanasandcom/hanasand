import { geoAmericas } from './geoAmericas'
import { geoEuropeAfrica } from './geoEuropeAfrica'
import { geoAsiaPacific } from './geoAsiaPacific'
import { geoPolar } from './geoPolar'

const allCentroids = {
    ...geoAmericas,
    ...geoEuropeAfrica,
    ...geoAsiaPacific,
    ...geoPolar,
}

export const countryCentroids: Record<string, [number, number]> = Object.fromEntries(
    Object.entries(allCentroids).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
)
