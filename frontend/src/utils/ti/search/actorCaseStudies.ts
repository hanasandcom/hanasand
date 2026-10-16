export interface TiActorCaseStudyCatalog {
    schemaVersion: 'ti.actor.case_studies.v1' | 'ti.actor.case_studies.v2'
    supportedActorCount: number
    caseStudyCount: number
    pendingActorCount?: number
    pendingFindingCount?: number
    qualification: string
    actorClassCounts: {
        ransomwareOrExtortion: number
        aptOrIntrusionSet: number
        otherThreatActor: number
    }
    categoryCounts: Record<string, number>
    cases: Array<{
        actorId?: string
        actor: string
        actorClass: 'ransomware_or_extortion' | 'apt_or_intrusion_set' | 'threat_actor'
        categories: string[]
        findingCount: number
        evidenceCount: number
        captureCount: number
        sourceCount: number
        firstSeenAt?: string
        lastSeenAt?: string
        firstPublishedAt?: string
        lastPublishedAt?: string
        firstCollectedAt?: string
        lastCollectedAt?: string
        reviewStates: string[]
        findings?: TiActorBusinessFinding[]
    }>
    reviewedFindings?: TiActorBusinessFinding[]
    pendingFindings?: TiActorBusinessFinding[]
    missingContexts: string[]
}

export interface TiActorBusinessFinding {
    actorId: string
    actor: string
    actorClass: 'ransomware_or_extortion' | 'apt_or_intrusion_set' | 'threat_actor'
    category: string
    type: string
    value: string
    assertionKind: string
    confidence: number
    claimId: string
    claimEvidenceId: string
    entityId: string
    captureId: string
    sourceId: string
    relationship: 'supports'
    evidenceStage: string
    reviewState: string
    reviewedAt?: string
    reviewedBy?: string
    reviewReasons: string[]
    extractionMethod?: string
    extractorVersion?: string
    contentHash: string
    publishedAt?: string
    collectedAt?: string
    url?: string
    excerpt: string
}
