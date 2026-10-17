export type StartBody = {
    object_id?: string
    targetId?: string
    target_user_id?: string
    reason?: string
    duration_minutes?: number | string
    durationMinutes?: number | string
    scope?: unknown
    organization_id?: string
    organizationId?: string
    orgId?: string
    supportSessionId?: string
    support_session_id?: string
}
export type StopBody = {
    reason?: string
    context?: unknown
}
export type EventQuery = {
    q?: string
    actor?: string
    target?: string
    action?: string
    outcome?: string
    method?: string
    path?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    reason?: string
    from?: string
    to?: string
    limit?: string
}
