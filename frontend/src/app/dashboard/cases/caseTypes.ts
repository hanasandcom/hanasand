export type CaseResolution = {
    id?: string
    type: 'human' | 'ai' | 'automation' | 'unknown'
    actor?: string
    at?: string
    note?: string
    confirmedBy?: string
    confirmedAt?: string
}

export type CaseRow = {
    id: string
    caseId?: string
    title: string
    summary?: string
    status: string
    actor?: string
    victimName?: string
    company?: string
    reviewState?: string
    source?: string
    severity?: string
    priority?: string
    assignedOwner?: string
    resolution?: CaseResolution
    organizationId?: string
    updatedAt?: string
    createdAt?: string
}
