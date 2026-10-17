import { normalizeOrganizationRole, type OrganizationRole } from '../organizationRoles.ts'
import type { OrganizationInput, OrganizationMemberRoleInput, OrganizationOwnershipTransferInput, OrganizationSettingsInput, InviteActionInput, InviteInput, OrganizationInviteAction } from './types.ts'
import { cleanText, emailPattern, slugFor } from './normalization/text.ts'
import { normalizeAlertVisibilityPolicy, normalizeAuditSafeMetadata, normalizeDefaultWebhookPolicy, normalizeOrganizationLifecycleStatus, normalizeRetentionDays, normalizeSettingsName, normalizeSettingsSlug } from './normalization/organizationValues.ts'
import { normalizeInviteExpiry, normalizeInviteRole, normalizeRequiredReason, normalizeRequestId } from './normalization/requestValues.ts'

const inviteActions = new Set<OrganizationInviteAction>(['revoke', 'resend'])
export const memberRoleTargetRoles: OrganizationRole[] = ['admin', 'editor', 'reader']
const memberRoleTargets = new Set<OrganizationRole>(memberRoleTargetRoles)

export function normalizeOrganizationInput(body: OrganizationInput | undefined) {
    const name = normalizeSettingsName(body?.name)

    return {
        name,
        slug: slugFor(name),
    }
}

export function normalizeInviteInput(body: InviteInput | undefined) {
    const fromArray = Array.isArray(body?.emails) ? body.emails : []
    const fromSingle = typeof body?.email === 'string' ? [body.email] : []
    const submittedEmails = [...fromArray, ...fromSingle]
        .map(email => cleanText(email).toLowerCase())
        .filter(Boolean)
    const emails = Array.from(new Set(submittedEmails))

    if (!emails.length) {
        throw new Error('Add at least one invite email.')
    }

    if (emails.length > 25) {
        throw new Error('Invite at most 25 users at a time.')
    }

    const invalid = emails.find(email => !emailPattern.test(email))
    if (invalid) {
        throw new Error(`Invalid invite email: ${invalid}`)
    }

    const role = normalizeInviteRole(body?.role)
    const expiresAt = normalizeInviteExpiry(body?.expiresAt ?? body?.expires_at)
    const requestId = normalizeRequestId(body?.requestId ?? body?.request_id)
    return {
        emails,
        role,
        expiresAt,
        requestId,
        submittedRecipientCount: submittedEmails.length,
        normalizedRecipientCount: emails.length,
        duplicateRecipientCount: submittedEmails.length - emails.length,
    }
}

export function normalizeInviteActionInput(body: InviteActionInput | undefined) {
    const action = cleanText(body?.action).toLowerCase()
    if (!inviteActions.has(action as OrganizationInviteAction)) {
        throw new Error('Invite action must be revoke or resend.')
    }

    const reason = normalizeRequiredReason(body?.reason, 'Invite action')

    const requestId = normalizeRequestId(body?.requestId ?? body?.request_id)
    const expiresAt = action === 'resend'
        ? normalizeInviteExpiry(body?.expiresAt ?? body?.expires_at)
        : undefined

    return { action: action as OrganizationInviteAction, reason, requestId, expiresAt }
}

export function normalizeOrganizationSettingsInput(body: OrganizationSettingsInput | undefined) {
    const name = body?.name === undefined ? undefined : normalizeSettingsName(body.name)
    const slug = body?.slug === undefined ? undefined : normalizeSettingsSlug(body.slug)
    const defaultWebhookPolicy = normalizeDefaultWebhookPolicy(body?.defaultWebhookPolicy ?? body?.default_webhook_policy)
    const alertVisibilityPolicy = normalizeAlertVisibilityPolicy(body?.alertVisibilityPolicy ?? body?.alert_visibility_policy)
    const lifecycleStatus = normalizeOrganizationLifecycleStatus(body?.lifecycleStatus ?? body?.lifecycle_status)
    const retentionDays = normalizeRetentionDays(body?.retentionDays ?? body?.retention_days)
    const auditSafeMetadata = normalizeAuditSafeMetadata(body?.auditSafeMetadata ?? body?.audit_safe_metadata)

    if (
        name === undefined
        && slug === undefined
        && defaultWebhookPolicy === undefined
        && alertVisibilityPolicy === undefined
        && lifecycleStatus === undefined
        && retentionDays === undefined
        && auditSafeMetadata === undefined
    ) {
        throw new Error('Add at least one organization setting to update.')
    }

    return {
        name,
        slug,
        defaultWebhookPolicy,
        alertVisibilityPolicy,
        lifecycleStatus,
        retentionDays,
        auditSafeMetadata,
    }
}

export function normalizeOwnershipTransferInput(body: OrganizationOwnershipTransferInput | undefined) {
    const targetUserId = cleanText(body?.targetUserId ?? body?.target_user_id)
    if (!targetUserId) {
        throw new Error('Target user is required.')
    }

    const reason = normalizeRequiredReason(body?.reason, 'Ownership transfer')

    return { targetUserId, reason }
}

export function normalizeMemberRoleInput(body: OrganizationMemberRoleInput | undefined) {
    const role = normalizeOrganizationRole(cleanText(body?.role).toLowerCase() as OrganizationRole)
    if (!memberRoleTargets.has(role as OrganizationRole)) {
        throw new Error('Member role must be admin, editor, or reader.')
    }

    const reason = normalizeRequiredReason(body?.reason, 'Member role change')

    const requestId = normalizeRequestId(body?.requestId ?? body?.request_id)
    return { role: role as OrganizationRole, reason, requestId }
}
