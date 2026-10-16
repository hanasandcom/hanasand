import type { ProductNorthStarScoreboard } from './northStarTypes'
import { isProductNorthStarRow, isProductNorthStarDirection, isProductNorthStarProgressSource, isProductNorthStarDeployGate } from './northStarValidationShapes'
import { deployGateMatchesRows } from './northStarDeployGateValidation'
import { isProductReadinessAggregateSource } from './productReadinessAggregate'
export { isProductNorthStarRow, isProductNorthStarDirection, isProductNorthStarProgressSource } from './northStarValidationShapes'

export function parseProductNorthStarScoreboard(input: unknown): ProductNorthStarScoreboard | null {
    if (!input || typeof input !== 'object') return null
    const candidate = input as Partial<ProductNorthStarScoreboard>
    if (candidate.schemaVersion !== 'product.north_star.readiness.v1') return null
    if (!Array.isArray(candidate.rows) || !Array.isArray(candidate.direction)) return null
    if (typeof candidate.fullChainReady !== 'boolean') return null
    if (typeof candidate.generatedAt !== 'string' || typeof candidate.query !== 'string') return null
    if (typeof candidate.readyRows !== 'number' || typeof candidate.totalRows !== 'number') return null
    if (!candidate.rows.every(isProductNorthStarRow)) return null
    if (!candidate.direction.every(isProductNorthStarDirection)) return null
    if (!isProductNorthStarProgressSource(candidate.progressSource)) return null
    if (!isProductReadinessAggregateSource(candidate.productReadinessAggregate)) return null
    if (!isProductNorthStarDeployGate(candidate.deployGate)) return null
    if (candidate.totalRows !== candidate.rows.length) return null
    if (candidate.readyRows !== candidate.rows.filter(row => row.state === 'ready').length) return null
    if (candidate.fullChainReady !== candidate.rows.every(row => row.state === 'ready')) return null
    if (candidate.deployGate.totalRows !== candidate.totalRows) return null
    if (candidate.deployGate.readyRows !== candidate.readyRows) return null
    if (candidate.deployGate.fullChainReady !== candidate.fullChainReady) return null
    if (candidate.deployGate.firstBlocker !== (candidate.firstBlocker || '')) return null
    if (!deployGateMatchesRows(candidate.deployGate, candidate.rows)) return null
    return candidate as ProductNorthStarScoreboard
}

