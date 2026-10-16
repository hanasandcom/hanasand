import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'

export type OperatorScope = {
    tenantId: string
    organizationId?: string
}

export type DwmWatchlistSummary = {
    id: string
    tenantId: string
    organizationId?: string
    name: string
    terms: Array<{ value: string, kind?: string }>
    webhookUrl?: string
    webhookDestinationId?: string
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationState = {
    organizations: DwmOrganizationSummary[]
    selectedOrganization?: DwmOrganizationSummary
    members: DwmOrganizationMember[]
    pendingInvites: DwmOrganizationInvite[]
    webhooks: DwmOrganizationWebhookDestination[]
}

export type DwmOrganizationSummary = {
    id: string
    tenantId: string
    name: string
    slug: string
    status: 'active' | 'suspended'
    alertVisibilityPolicy?: 'members' | 'admins' | 'owners'
    createdAt: string
    updatedAt: string
    createdBy?: string
}

export type DwmOrganizationMember = {
    id: string
    organizationId: string
    email: string
    userId?: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'active' | 'invited' | 'removed' | string
    invitedAt?: string
    acceptedAt?: string
    createdAt: string
    updatedAt: string
}

export type DwmOrganizationInvite = {
    id: string
    organizationId: string
    email: string
    role: 'owner' | 'admin' | 'analyst' | 'viewer' | string
    status: 'pending' | 'accepted' | 'revoked' | 'expired' | string
    invitedBy?: string
    invitedAt: string
    expiresAt: string
    updatedAt: string
}

export type DwmOrganizationWebhookDestination = {
    id: string
    organizationId: string
    tenantId: string
    name: string
    kind: 'discord' | 'generic'
    status: 'active' | 'paused'
    createdAt: string
    updatedAt: string
    createdBy?: string
    lastTestedAt?: string
    lastTestStatus?: 'delivered' | 'failed' | 'dry_run'
}

export type DwmOperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestCaptures?: Array<{
        matchedWatchTerms?: string[]
    }>
    latestRun?: {
        status: string
        updatedAt: string
        captureCount: number
    }
}

export type DwmDeliveryItem = {
    id: string
    alertId: string
    watchlistId: string
    organizationId?: string
    webhookDestinationId?: string
    endpointHash: string
    attemptedAt: string
    payloadHash: string
    status: string
    deliveryKind?: 'discord' | 'generic'
    httpStatus?: number
    error?: string
}

export type DwmAlertAccessState = {
    status: 'loaded' | 'identity_missing' | 'visibility_denied' | 'unavailable'
    code?: string
    message?: string
    reason?: string
    attemptedIdentity?: {
        userEmail?: string
        userId?: string
        actor?: string
        source?: string
    }
}

export type DashboardViewerIdentity = {
    userEmail?: string
    userId?: string
    actor?: string
    source: 'session' | 'org_member_match' | 'single_active_org_member' | 'anonymous'
}

