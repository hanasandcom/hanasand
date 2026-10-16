import type { WorkbenchCase } from './types'

export type WorkbenchDwmDelivery = {
    id: string
    tenantId?: string
    alertId: string
    watchlistId?: string
    webhookDestinationId?: string
    endpointHash: string
    dedupeKey?: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
    deliveryKind?: string
}

export type WorkbenchDwmCaseListItem = {
    id?: string
    caseId?: string
    title?: string
    summary?: string
    status?: string
    priority?: string
    severity?: WorkbenchCase['severity'] | string
    assignedOwner?: string
    organizationId?: string
    tenantId?: string
    alertId?: string
    dedupeKey?: string
    recommendedRoute?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    webhookDeliveryIds?: string[]
    webhookStatuses?: string[]
    createdAt?: string
    updatedAt?: string
    closedAt?: string
    latestEvent?: { id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }
    latestCaseAction?: { id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }
    timeline?: Array<{ id?: string, at?: string, title?: string, eventType?: string, summary?: string, body?: string }>
    nextAllowedActions?: Array<{ id?: string, label?: string, enabled?: boolean, disabledReason?: string }>
}
