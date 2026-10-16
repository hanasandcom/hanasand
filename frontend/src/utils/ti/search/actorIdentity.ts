export interface TiActorIdentityMatch {
    catalogMatched: boolean
    ambiguous: boolean
    activityEvidenceAvailable: boolean
    candidates: TiActorIdentityCandidate[]
}

export interface TiActorIdentityCandidate {
    catalogId: string
    externalId: string
    canonicalName: string
    description?: string
    associatedNames: string[]
    matchKinds: Array<'canonical' | 'associated'>
    status: 'current' | 'deprecated' | 'revoked' | 'retired'
    aptNumberDesignationPresent: boolean
    sourceUrl: string
    referenceSources?: Array<{ name: string; url?: string }>
    createdAt: string
    modifiedAt: string
    catalogVersion: string
    catalogModifiedAt: string
    captureId?: string
}
