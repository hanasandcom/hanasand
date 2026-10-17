import { prepareCommercialReadiness } from './readinessContext.ts'
import { buildPlatformReadinessItems } from './platformReadinessItems.ts'
import { buildProductReadinessItems } from './productReadinessItems.ts'
import type { CommercialReadinessInput } from './types.ts'

export function buildCommercialReadiness(input: CommercialReadinessInput) {
    const context = prepareCommercialReadiness(input)
    const items = [...buildPlatformReadinessItems(context), ...buildProductReadinessItems(context)]
    const achievedCount = items.filter((item) => item.status === 'operational').length
    const partialCount = items.filter((item) => item.status === 'evidence_gap').length
    const internalActionCount = items.filter((item) => item.status === 'internal_action').length
    const measurableCount = items.filter((item) => item.measurable).length
    const overallState = internalActionCount > 0
        ? 'internal_action_required'
        : partialCount > 0
            ? 'evidence_gaps'
            : achievedCount >= 6 && measurableCount >= 6
                ? 'commercially_ready'
                : 'evidence_gaps'
    return {
        overallState,
        conclusion: overallState === 'commercially_ready'
            ? 'Operational controls have current evidence across verification, deployment, economics, design, safety, and pricing.'
            : 'Internal gates list the exact owner, control, and last attempt for any capability without current evidence.',
        achievedCount, partialCount, internalActionCount, measurableCount,
        totalCount: items.length,
        items,
    }
}
