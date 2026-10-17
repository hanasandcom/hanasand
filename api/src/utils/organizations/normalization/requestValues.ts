import { normalizeOrganizationRole, type OrganizationRole } from '../../organizationRoles.ts'
import { cleanText } from './text.ts'

const inviteRoles = new Set<OrganizationRole>(['admin', 'editor', 'reader'])

export function normalizeInviteRole(value: unknown): OrganizationRole {
    const role = normalizeOrganizationRole((cleanText(value).toLowerCase() || 'reader') as OrganizationRole)
    if (!inviteRoles.has(role as OrganizationRole)) {
        throw new Error('Invite role must be admin, editor, or reader.')
    }

    return role as OrganizationRole
}

export function normalizeInviteExpiry(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }

    const expiresAt = new Date(value)
    if (!Number.isFinite(expiresAt.getTime())) {
        throw new Error('Invite expiry must be a valid date.')
    }

    if (expiresAt.getTime() <= Date.now()) {
        throw new Error('Invite expiry must be in the future.')
    }

    return expiresAt.toISOString()
}

export function normalizeRequiredReason(value: unknown, context: string) {
    const reason = cleanText(value)
    if (reason.length < 3) {
        throw new Error(`${context} reason is required.`)
    }

    if (reason.length > 1000) {
        throw new Error(`${context} reason must be 1000 characters or fewer.`)
    }

    return reason
}

export function normalizeRequestId(value: unknown) {
    const requestId = cleanText(value)
    if (!requestId) return undefined
    return requestId.slice(0, 120)
}

export function normalizeWatchlistRequestId(value: unknown) {
    return normalizeRequestId(value)
}

export function normalizeWatchlistReason(value: unknown) {
    const reason = cleanText(value)
    return reason ? reason.slice(0, 1000) : undefined
}

export function normalizeWatchlistMutationMetadata(body: {
    reason?: unknown
    requestId?: unknown
    request_id?: unknown
} | undefined) {
    return {
        reason: normalizeWatchlistReason(body?.reason),
        requestId: normalizeRequestId(body?.requestId ?? body?.request_id),
    }
}
