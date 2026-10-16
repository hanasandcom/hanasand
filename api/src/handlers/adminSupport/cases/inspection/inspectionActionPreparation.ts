import { randomUUID } from 'crypto'
import {
    cleanContext,
    normalizeSupportPreparationDuration,
    normalizeSupportPreparationExpiry,
    normalizeSupportPreparationScope,
    supportError,
    supportText as text,
} from '#utils/support/adminSupportInput.ts'
import { requireAuditReason } from '#utils/systemEvent.ts'
import type { SupportInspectionQuery } from './inspectionRequest.ts'

export type SupportActionPreparationInput = {
    action: 'invite_assist' | 'access_recovery' | 'impersonation'
    reason: string
    context: string
    scope: string[]
    supportSessionId: string
    idempotencyKey: string
    durationMinutes: number | null
    expiresAt: string | null
}

type PreparationResult = { value: SupportActionPreparationInput | null, error: Record<string, unknown> | null }

export function supportActionPreparationInput(query: SupportInspectionQuery, action: string): PreparationResult {
    if (!query.prepareAction) return { value: null, error: null }
    if (!action) {
        return {
            value: null,
            error: supportError('unsupported_support_action', 'Unsupported support action prepare request.', {
                supportedActions: ['invite_assist', 'access_recovery', 'impersonation'],
            }),
        }
    }

    let reason: string
    try {
        reason = requireAuditReason(query.reason, 'Support action preparation reason')
    } catch (error) {
        return {
            value: null,
            error: supportError('missing_support_reason', error instanceof Error ? error.message : 'Support action preparation reason is required.'),
        }
    }

    const scopeResult = normalizeSupportPreparationScope(query.scope, action)
    if (scopeResult.error) return { value: null, error: scopeResult.error }
    const durationResult = normalizeSupportPreparationDuration(query.durationMinutes ?? query.duration_minutes, action)
    if (durationResult.error) return { value: null, error: durationResult.error }
    const expiryResult = normalizeSupportPreparationExpiry(query.expiresAt ?? query.expires_at)
    if (expiryResult.error) return { value: null, error: expiryResult.error }
    const idempotencyKey = supportActionIdempotencyKey(query.idempotencyKey || query.idempotency_key, action)

    return {
        value: {
            action: action as SupportActionPreparationInput['action'],
            reason,
            context: cleanContext(query.context),
            scope: scopeResult.value,
            supportSessionId: text(query.session || query.supportSession || query.supportSessionId),
            idempotencyKey,
            durationMinutes: durationResult.value,
            expiresAt: expiryResult.value,
        },
        error: null,
    }
}

export function supportActionIdempotencyKey(value: unknown, action: string) {
    const cleaned = text(value).replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 120)
    return cleaned || `support-${action}-${randomUUID()}`
}
