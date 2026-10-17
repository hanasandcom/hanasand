import type { recordAiUsageEvent } from '#utils/ai/usage.ts'

export type VerificationKind = 'browser' | 'build' | 'deploy' | 'design'
export type VerificationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type VerificationJobRow = {
    id: string
    owner_id: string
    workspace_kind: string | null
    workspace_id: string | null
    kind: VerificationKind
    status: VerificationStatus
    priority: number
    lane: string
    queue_position: number
    retry_count: number
    max_retries: number
    current_step: string
    target_url: string | null
    deploy_url: string | null
    request_id: string
    artifacts: unknown
    metadata: Record<string, unknown>
    error: string | null
    created_at: string
    updated_at: string
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
}

export type CreateJobBody = {
    kind?: VerificationKind
    targetUrl?: string
    deployUrl?: string
    workspaceKind?: string
    workspaceId?: string
    priority?: 'standard' | 'paid' | 'urgent' | number
    lane?: string
    timeoutMs?: number
    captureScreenshot?: boolean
    maxRetries?: number
    metadata?: Record<string, unknown>
}

export type VerificationUsageDetails = Pick<
    Parameters<typeof recordAiUsageEvent>[0],
    'kind' | 'units' | 'billableUnits' | 'estimatedCostNok' | 'outcome' | 'metadata'
>

export function normalizeJob(job?: VerificationJobRow) {
    if (!job) {
        return null
    }
    return {
        id: job.id,
        ownerId: job.owner_id,
        workspaceKind: job.workspace_kind,
        workspaceId: job.workspace_id,
        kind: job.kind,
        status: job.status,
        priority: job.priority,
        lane: job.lane,
        queuePosition: job.queue_position,
        retryCount: job.retry_count,
        maxRetries: job.max_retries,
        currentStep: job.current_step,
        targetUrl: job.target_url,
        deployUrl: job.deploy_url,
        requestId: job.request_id,
        artifacts: Array.isArray(job.artifacts) ? job.artifacts : [],
        metadata: job.metadata || {},
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        cancelledAt: job.cancelled_at,
    }
}

export function normalizePriority(priority: CreateJobBody['priority']) {
    if (typeof priority === 'number' && Number.isFinite(priority)) {
        return Math.max(0, Math.min(Math.round(priority), 100))
    }
    if (priority === 'urgent') {
        return 100
    }
    if (priority === 'paid') {
        return 50
    }
    return 0
}

export function cleanOptional(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null
}

export function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
        return fallback
    }
    return Math.max(minimum, Math.min(number, maximum))
}

export function cleanWorkspaceKind(value: string | null): 'share' | 'repo' | null {
    return value === 'share' || value === 'repo' ? value : null
}

export function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function validateHttpUrl(url: string) {
    if (!url) {
        return 'Missing targetUrl.'
    }
    try {
        const target = new URL(url)
        if (!['http:', 'https:'].includes(target.protocol)) return 'Only http and https verification targets are supported.'
        if (target.username || target.password) return 'Verification targets cannot include embedded credentials.'
        return null
    } catch {
        return 'Invalid targetUrl.'
    }
}
