export interface TiClaimAssessment {
    id: string
    claimType?: string
    summary?: string
    confidence?: number
    reviewState: string
    corroborationState: string
    sourceCount: number
    evidenceCount: number
    evidenceStage?: string
    extractionMethod?: string
    extractorVersion?: string
    firstSeenAt?: string
    lastSeenAt?: string
    uncertaintyReasons: string[]
}

export interface TiIncidentAssessment {
    id: string
    title: string
    summary?: string
    confidence?: number
    assertionKind: 'inferred'
    reviewState: string
    firstSeenAt?: string
    sourceId?: string
    captureId?: string
    extractorVersion?: string
    reviewReasons: string[]
}

export interface TiEvidenceAssessment {
    ready: boolean
    confidence: number
    sourceCount: number
    captureCount: number
    confirmedClaimCount: number
    corroboratedClaimCount: number
    validationCount: number
    contradictedClaimCount: number
    rejectedClaimCount?: number
    staleClaimCount?: number
    metadataOnly: boolean
    reasons: string[]
    claimCounts?: { total: number; confirmed: number; needsReview: number; rejected?: number; stale?: number; contradicted: number; corroborated: number }
    missingFields: string[]
}
