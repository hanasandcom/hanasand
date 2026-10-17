import type { JsonRule } from './jsonMonitoring.ts'

export type AutomationScheduleKind = 'once' | 'interval'
export type AutomationStatus = 'active' | 'paused' | 'archived'
export type AutomationActionType = 'agent_prompt' | 'echo' | 'mail_health_check' | 'system_alert' | 'organization_report'

export type AutomationRow = {
    json_rule?: JsonRule | null
    case_numbers?: string[]
    id: string
    owner_id: string
    name: string
    prompt: string
    target_url: string | null
    monitoring_type: 'fetch' | 'post' | 'tcp' | 'ssh' | 'json' | 'push'
    follow_redirects: boolean
    user_agent: string | null
    expected_down: boolean
    upside_down: boolean
    timeout_seconds: number
    retry_count: number
    notify_warnings: boolean
    certificate_status: 'valid' | 'expiring' | 'invalid' | 'not_applicable' | null
    certificate_subject: string | null
    certificate_issuer: string | null
    certificate_expires_at: string | null
    schedule_kind: AutomationScheduleKind
    interval_minutes: number | null
    run_at: string | null
    status: AutomationStatus
    action_type: AutomationActionType
    timezone: string
    model_name: string | null
    notification_destinations: string[]
    notify_on: 'never' | 'failure' | 'always'
    organization_id: string | null
    next_run_at: string | null
    last_run_at: string | null
    last_completed_at: string | null
    last_status: string | null
    last_result: string | null
    last_error: string | null
    consecutive_failures: number
    paused_reason: string | null
    run_count: number
    created_at: string
    updated_at: string
}

export type AutomationRunRow = {
    issue_id?: string | null
    id: string
    automation_id: string
    owner_id: string
    status: 'running' | 'completed' | 'failed'
    warning: boolean
    result: string | null
    error: string | null
    provider: string | null
    model: string | null
    artifacts: unknown
    started_at: string
    completed_at: string | null
    duration_ms: number | null
}

export type AutomationRunArtifact = {
    type: 'log' | 'screenshot' | 'link'
    label: string
    href: string | null
    text: string | null
    createdAt: string
}

export type AutomationInput = {
    jsonRule?: unknown
    json_rule?: unknown
    name?: unknown
    prompt?: unknown
    targetUrl?: unknown
    target_url?: unknown
    monitoringType?: unknown
    monitoring_type?: unknown
    followRedirects?: unknown
    follow_redirects?: unknown
    userAgent?: unknown
    user_agent?: unknown
    expectedDown?: unknown
    expected_down?: unknown
    upsideDown?: unknown
    upside_down?: unknown
    timeoutSeconds?: unknown
    timeout_seconds?: unknown
    retryCount?: unknown
    retry_count?: unknown
    scheduleKind?: unknown
    schedule_kind?: unknown
    intervalMinutes?: unknown
    interval_minutes?: unknown
    runAt?: unknown
    run_at?: unknown
    status?: unknown
    actionType?: unknown
    action_type?: unknown
    timezone?: unknown
    modelName?: unknown
    notificationDestinations?: unknown
    notification_destinations?: unknown
    model_name?: unknown
    notifyOn?: unknown
    notify_on?: unknown
    notifyWarnings?: unknown
    notify_warnings?: unknown
    organizationId?: unknown
    organization_id?: unknown
}

export type NormalizedAutomationInput = {
    jsonRule: JsonRule | null
    name: string
    prompt: string
    targetUrl: string | null
    monitoringType: 'fetch' | 'post' | 'tcp' | 'ssh' | 'json' | 'push'
    followRedirects: boolean
    userAgent: string | null
    expectedDown: boolean
    upsideDown: boolean
    timeoutSeconds: number
    retryCount: number
    notifyWarnings: boolean
    scheduleKind: AutomationScheduleKind
    intervalMinutes: number | null
    runAt: Date | null
    status: AutomationStatus
    actionType: AutomationActionType
    timezone: string
    modelName: string | null
    notificationDestinations: string[]
    notifyOn: 'never' | 'failure' | 'always'
    organizationId: string | null
    nextRunAt: Date | null
}
