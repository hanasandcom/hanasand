
export type OrganizationRole = 'owner' | 'admin' | 'editor' | 'reader' | 'member' | 'viewer' | 'support'

export type OrganizationStatus = 'active' | 'archived' | 'deleted' | string

export type OrganizationSummary = {
    id: string
    tenantId?: string
    name: string
    slug?: string
    role?: OrganizationRole
    status?: OrganizationStatus
    memberCount?: number
    activeMemberCount?: number
    ownerCount?: number
    adminCount?: number
    pendingInviteCount?: number
    sharedWatchlistCount?: number
    updatedAt?: string
}

export type OrganizationSettings = {
    name?: string
    slug?: string
    defaultWebhookPolicy?: string
    alertVisibilityPolicy?: string
    lifecycleStatus?: string
    retentionDays?: number
    auditSafeMetadata?: Record<string, unknown>
}

export type OrganizationMember = {
    userId: string
    email?: string
    name?: string
    avatar?: string | null
    role: OrganizationRole
    status: string
    joinedAt?: string
    invitedBy?: string | null
}

export type OrganizationApiKey = { id: string, name?: string, enabled?: boolean, keyPrefix?: string, key_prefix?: string, expiresAt?: string, expires_at?: string }

export type OrganizationInvite = {
    id: string
    email: string
    role: OrganizationRole
    status: string
    expiresAt?: string
    createdAt?: string
    acceptancePath?: string
    acceptanceUrl?: string
    token?: string
}

export type OrganizationPrivacyState = {
    schemaVersion?: string
    organization?: { id?: string, status?: string, retention_days?: number, retentionDays?: number }
    runs?: Array<Record<string, unknown>>
    requests?: Array<Record<string, unknown>>
    items?: Array<Record<string, unknown>>
    protection?: Record<string, unknown>
    permissions?: { canExport?: boolean, canRunRetention?: boolean, canRequestDeletion?: boolean }
}

export type OrganizationLoadError = {
    endpoint: string
    message: string
    serviceUnavailable: boolean
}
