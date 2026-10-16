
export type WatchlistStatus = 'active' | 'paused' | 'archived' | string

export type WatchlistKind = 'company' | 'domain' | 'vendor' | 'actor' | 'keyword'

export type WatchlistItem = {
    id: string
    organizationId?: string
    tenantId?: string
    kind: WatchlistKind
    value: string
    notes?: string
    status: WatchlistStatus
    createdBy?: string
    updatedBy?: string
    createdAt?: string
    updatedAt?: string
    archivedAt?: string | null
    alertGenerationRef?: string
    webhookDestinationId?: string
    webhookUrlConfigured?: boolean
    webhookEndpointHash?: string
    webhookEndpointHint?: string
}

export type AlertTerm = {
    organizationId?: string
    tenantId?: string
    watchlistId?: string
    watchlistName?: string
    watchlistItemId?: string
    kind?: WatchlistKind
    family?: string
    term?: string
    value?: string
    status?: WatchlistStatus
    alertGenerationRef?: string
    matchReason?: string
    provenanceHash?: string
}

export type WatchlistSuggestion = {
    id: string
    label: string
    kind: WatchlistKind
    value: string
    notes: string
    disabled: boolean
}
