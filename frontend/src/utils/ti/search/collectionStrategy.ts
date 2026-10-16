export interface TiCollectionStrategy {
    thesis: string
    productFocus: string[]
    sourcePosture: Array<{
        source: string
        role: 'primary_seed' | 'corroboration' | 'context_only' | 'rejected_paid_rows' | 'owned_collection_target'
        summary: string
        buyerValue: string
        limitations?: string
    }>
    ownedCollection: {
        priority: 'primary'
        summary: string
        requirements: string[]
        prohibited: string[]
    }
    distribution: {
        primarySurface: 'hanasand.com'
        secondarySurface: 'none'
        summary: string
    }
}
