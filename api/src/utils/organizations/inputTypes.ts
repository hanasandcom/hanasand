import type { OrganizationRole } from '../organizationRoles.ts'

export type OrganizationAlertCaseRole = OrganizationRole | 'analyst' | 'support' | 'nonmember'
export type OrganizationAlertCaseAction =
    | 'create_watchlist'
    | 'edit_watchlist_terms'
    | 'archive_watchlist'
    | 'restore_watchlist'
    | 'acknowledge_alert'
    | 'assign_case'
    | 'link_case'
    | 'manage_invites'
export type WatchlistKind = 'company' | 'domain' | 'vendor' | 'actor' | 'keyword'
export type OrganizationWatchlistStatus = 'active' | 'paused' | 'archived'
export type OrganizationWatchlistAction = 'pause' | 'resume' | 'archive' | 'restore'
export type OrganizationDefaultWebhookPolicy = 'active_destinations' | 'manual_selection' | 'disabled'
export type OrganizationLifecycleStatus = 'active' | 'archived' | 'deleted'
export type OrganizationSharedWatchlistAuditEventAction =
    | 'organization_invites_created'
    | 'organization_invite_accepted'
    | 'organization_invite_revoked'
    | 'organization_invite_resent'
    | 'organization_watchlist_upserted'
    | 'organization_watchlist_updated'
    | 'organization_watchlist_paused'
    | 'organization_watchlist_resumed'
    | 'organization_watchlist_archived'
    | 'organization_watchlist_restored'
    | 'organization_watchlist_cleanup_archived'
    | 'organization_watchlist_alert_terms_exported'
    | 'organization_watchlist_alert_terms_export_denied'
    | 'organization_lifecycle_mutation_blocked'
export type OrganizationSharedWatchlistAuditRouteGroup =
    | 'invite_lifecycle'
    | 'watchlist_write'
    | 'watchlist_lifecycle'
    | 'alert_terms_export'
    | 'lifecycle_blocker'
export type OrganizationSharedWatchlistAuditConsumer =
    | 'alert_queue'
    | 'case_workflow'
    | 'webhook_delivery'
    | 'dashboard_readiness'
export type OrganizationSharedWatchlistMonitoringWorkflowStep =
    | 'watchlist_export'
    | 'alert_upsert'
    | 'alert_queue_visibility'
    | 'case_link'
    | 'webhook_delivery'
export type OrganizationSharedWatchlistAnalystPortalAction =
    | 'review_alert'
    | 'acknowledge_alert'
    | 'assign_case'
    | 'link_case'
    | 'replay_alert'
    | 'deliver_webhook'
export type OrganizationSharedWatchlistProvenanceSourceFamily =
    | 'organization_watchlist'
    | 'darkweb_metadata'
    | 'telegram_public'
    | 'rss_news'
    | 'public_ti'

export type OrganizationInput = {
    name?: unknown
}

export type OrganizationSettingsInput = {
    name?: unknown
    slug?: unknown
    defaultWebhookPolicy?: unknown
    default_webhook_policy?: unknown
    alertVisibilityPolicy?: unknown
    alert_visibility_policy?: unknown
    lifecycleStatus?: unknown
    lifecycle_status?: unknown
    retentionDays?: unknown
    retention_days?: unknown
    auditSafeMetadata?: unknown
    audit_safe_metadata?: unknown
}

export type OrganizationOwnershipTransferInput = {
    targetUserId?: unknown
    target_user_id?: unknown
    reason?: unknown
}

export type OrganizationMemberRoleInput = {
    role?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type InviteInput = {
    email?: unknown
    emails?: unknown
    role?: unknown
    expiresAt?: unknown
    expires_at?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type InviteActionInput = {
    action?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

export type OrganizationInviteAction = 'revoke' | 'resend'

export type WatchlistInput = {
    kind?: unknown
    value?: unknown
    notes?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type WatchlistActionInput = {
    action?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type WatchlistCleanupInput = {
    itemIds?: unknown
    item_ids?: unknown
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
}
