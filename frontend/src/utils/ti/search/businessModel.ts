export interface TiBusinessModelObservation {
    value: string
    assertionKind: string
    evidenceKind?: 'observed' | 'actor_claim' | 'third_party_report' | 'analytical_inference'
    confidence: number
    sourceIds: string[]
    captureIds: string[]
    claimIds?: string[]
    claimEvidenceIds?: string[]
    entityIds?: string[]
    reviewState: string
    reviewReasons: string[]
    corroborationState?: string
    sourceCount?: number
    evidenceCount?: number
    firstSeenAt?: string
    lastSeenAt?: string
    firstPublishedAt?: string
    lastPublishedAt?: string
    firstCollectedAt?: string
    lastCollectedAt?: string
    evidenceStages?: string[]
    extractionMethods?: string[]
    extractorVersions?: string[]
    evidence?: Array<{
        sourceId: string
        captureId: string
        claimId?: string
        claimEvidenceId?: string
        entityId?: string
        contentHash?: string
        url?: string
        publishedAt?: string
        collectedAt?: string
        excerpt: string
    }>
}

export interface TiBusinessModelAssessment {
    schemaVersion: 'ti.actor.business_model.v1' | 'ti.actor.business_model.v2' | 'ti.actor.business_model.v3'
    evidenceState: 'observed_mechanisms' | 'reviewed_mechanisms' | 'pending_review' | 'not_observed'
    extortionModels?: TiBusinessModelObservation[]
    advertisedProducts?: TiBusinessModelObservation[]
    advertisedData?: TiBusinessModelObservation[]
    pricingClaims?: TiBusinessModelObservation[]
    negotiationClaims?: TiBusinessModelObservation[]
    paymentClaims?: TiBusinessModelObservation[]
    revenueClaims?: TiBusinessModelObservation[]
    revenueShareClaims?: TiBusinessModelObservation[]
    publicationStrategies: TiBusinessModelObservation[]
    publicityTactics: TiBusinessModelObservation[]
    publicityEvents?: TiBusinessModelObservation[]
    pressureTactics: TiBusinessModelObservation[]
    communicationChannels: TiBusinessModelObservation[]
    buyerSellerCommunications: TiBusinessModelObservation[]
    intermediaryCommunications: TiBusinessModelObservation[]
    monetizationPaths: TiBusinessModelObservation[]
    profitabilitySignals: TiBusinessModelObservation[]
    pendingFindings?: TiBusinessModelObservation[]
    profitabilityConclusion?: {
        status: 'profitability_reported' | 'revenue_reported' | 'unknown'
        summary: string
        claimIds: string[]
        sourceIds: string[]
        captureIds: string[]
    }
    missingEvidence: string[]
    evidenceBoundary: string
}
