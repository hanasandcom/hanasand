export const BATCH_SIZE = 100
export const MAX_ATTEMPTS = 5

export type RetentionRun = {
    id: string
    organization_id: string
    privacy_request_id: string | null
    trigger_type: 'scheduled' | 'manual' | 'privacy_deletion'
    retention_days: number
    cutoff_at: Date | string
    attempt_count: number
}

export type RetentionItem = {
    sourceService: 'hanasand-api' | 'ti-scraper'
    recordType: string
    recordId: string
    action: 'delete' | 'redact' | 'retain'
    status: 'deleted' | 'redacted' | 'protected' | 'failed' | 'retried'
    reason: string
    error?: string
}

export function organizationRetentionCutoff(retentionDays: number, now = new Date()) {
    return new Date(now.getTime() - retentionDays * 86_400_000).toISOString()
}

export function organizationRetentionRunOutcome(input: {
    failed: boolean
    hasMore: boolean
    attemptCount: number
    failureError: string
}) {
    const deadLetter = input.failed && input.attemptCount >= MAX_ATTEMPTS
    const status: 'dead_letter' | 'failed' | 'queued' | 'completed' = input.failed
        ? deadLetter ? 'dead_letter' : 'failed'
        : input.hasMore ? 'queued' : 'completed'
    const error = !input.failed
        ? null
        : deadLetter
            ? `Retention failed after ${MAX_ATTEMPTS} attempts: ${input.failureError}`
            : `${input.failureError} The run will retry.`
    return {
        deadLetter,
        status,
        error,
        hasMore: deadLetter ? false : input.hasMore,
    }
}

export function items(value: unknown): RetentionItem[] {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RetentionItem[] : []
}

export function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : []
}

export function iso(value: Date | string) {
    return new Date(value).toISOString()
}
