import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import { createProductReadinessContext, type ProductReadinessInput } from './productReadinessContext'
import { buildCoreProductReadinessRows } from './productReadinessCoreRows'
import { buildDeliveryProductReadinessRows } from './productReadinessDeliveryRows'
import { buildSourceProductReadinessRows } from './productReadinessSourceRows'
import { withProductReadinessActions } from './productReadinessActions'
import { withProductReadinessWorkflowMetadata } from './productReadinessItemMetadata'

export function buildProductReadiness(input: ProductReadinessInput): WorkbenchProductReadinessItem[] {
    const context = createProductReadinessContext(input)
    const items = [
        ...buildCoreProductReadinessRows(context),
        ...buildDeliveryProductReadinessRows(context),
        ...buildSourceProductReadinessRows(context),
    ]
    return items.map(item => withProductReadinessWorkflowMetadata(withProductReadinessActions(item, input)))
}


export type { ProductReadinessInput } from './productReadinessContext'
