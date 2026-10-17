import type { OrganizationRole } from '../organizationRoles.ts'
import type { OrganizationAlertVisibilityPolicy } from '../organizationVisibility.ts'
import type { OrganizationDefaultWebhookPolicy, OrganizationLifecycleStatus, WatchlistKind, OrganizationWatchlistStatus } from './inputTypes.ts'

export type OrganizationRow = {
    id: string
    name: string
    slug: string
    created_by: string | null
    created_at: string
    updated_at: string
    member_count?: number
    owner_count?: number
    admin_count?: number
    pending_invite_count?: number
    shared_watchlist_count?: number
    status?: OrganizationLifecycleStatus
    default_webhook_policy?: OrganizationDefaultWebhookPolicy
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
    retention_days?: number
    audit_safe_metadata?: Record<string, unknown> | null
    role?: OrganizationRole
}

export type OrganizationInviteRow = {
    id: string
    organization_id: string
    email: string
    role: OrganizationRole
    invited_by: string
    accepted_by?: string | null
    status: 'pending' | 'accepted' | 'revoked'
    created_at: string
    expires_at: string
    accepted_at?: string | null
}

export type OrganizationMemberRow = {
    organization_id: string
    user_id: string
    name: string
    avatar: string
    role: OrganizationRole
    status: 'active' | 'removed'
    invited_by?: string | null
    joined_at: string
    created_at: string
}

export type OrganizationWatchlistRow = {
    id: string
    organization_id: string
    kind: WatchlistKind
    value: string
    notes: string
    status?: OrganizationWatchlistStatus
    created_by: string
    updated_by?: string | null
    lifecycle_reason?: string | null
    lifecycle_request_id?: string | null
    created_at: string
    updated_at: string
    archived_at?: string | null
}
