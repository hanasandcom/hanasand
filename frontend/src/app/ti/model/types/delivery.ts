export type SelectedDeliveryReadinessPlan = {
    schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    summary: {
        alerts: number
        captures: number
        destinations: number
        caseRoutes: number
        blockers: number
    }
    alerts: Array<{
        id: string
        title: string
        status: string
        ready: boolean
        casePath?: string
        captureIds: string[]
        destinationIds: string[]
        blockers: string[]
        recommendedRoute?: string
    }>
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
        request?: string
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        destinationIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    blockers: string[]
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}
