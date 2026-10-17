import type { OrganizationInvite, OrganizationSettings, OrganizationMember, OrganizationRole } from '../types/organization'
import { cleanString, numberValue, sentenceCase } from './labels'
import { slugifyOrganizationName } from './organization'
import { roleOptions } from '../constants/options'

export function inviteLink(invite: OrganizationInvite) {
    return invite.acceptanceUrl || invite.acceptancePath || invite.token || ''
}

export function normalizeSettings(settings: OrganizationSettings = {}) {
    return {
        name: (settings.name || '').trim(),
        slug: (settings.slug || '').trim(),
        defaultWebhookPolicy: settings.defaultWebhookPolicy || 'active_destinations',
        alertVisibilityPolicy: settings.alertVisibilityPolicy || 'members',
        lifecycleStatus: settings.lifecycleStatus || 'active',
        retentionDays: Number(settings.retentionDays || 365),
    }
}

export function privacyActionRequestId(action: string) {
    return `org-ui-${action}-${globalThis.crypto.randomUUID()}`
}

export function privacyText(row: Record<string, unknown>, ...keys: string[]) {
    return keys.map(key => cleanString(row[key])).find(Boolean)
}

export function privacyNumber(row: Record<string, unknown>, key: string) {
    return numberValue(row[key]) ?? 0
}

export function settingsValidationMessage(settings: OrganizationSettings = {}) {
    const name = (settings.name || '').trim()
    const slug = (settings.slug || '').trim()
    const retentionDays = Number(settings.retentionDays || 365)
    if (!name) return 'Organization name is required.'
    if (slug && slugifyOrganizationName(slug) !== slug) return 'Use lowercase letters, numbers, and hyphens for slug.'
    if (!Number.isFinite(retentionDays) || retentionDays < 30 || retentionDays > 2555) return 'Retention days must be between 30 and 2555.'
    return ''
}

export function settingsEqual(left: OrganizationSettings = {}, right: OrganizationSettings = {}) {
    return JSON.stringify(normalizeSettings(left)) === JSON.stringify(normalizeSettings(right))
}

export function parseInviteEmails(value: string) {
    return Array.from(new Set(value.split(/[,\n]/).map(email => email.trim().toLowerCase()).filter(Boolean)))
}

export function invalidInviteEmails(value: string) {
    return parseInviteEmails(value).filter(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

export function inviteEmailConflicts(emails: string[], invites: OrganizationInvite[], members: OrganizationMember[]) {
    const activeInviteEmails = new Set(invites
        .filter(invite => !['revoked', 'expired'].includes(invite.status.toLowerCase()))
        .map(invite => invite.email.toLowerCase()))
    const activeMemberEmailIds = new Set(members
        .filter(member => !['removed', 'revoked', 'inactive'].includes(member.status.toLowerCase()))
        .flatMap(member => [member.email?.toLowerCase(), member.userId.toLowerCase()])
        .filter(isEmailLike))
    return emails.filter(email => activeInviteEmails.has(email.toLowerCase()) || activeMemberEmailIds.has(email.toLowerCase()))
}

export function inviteStatusCounts(invites: OrganizationInvite[]) {
    return countOptions(invites, ['pending', 'accepted', 'revoked', 'expired'], invite => invite.status)
        .map(({ value: status, ...count }) => ({ status, ...count }))
}

export function inviteRoleStatusCounts(invites: OrganizationInvite[]) {
    return countOptions(invites, roleOptions, invite => invite.role)
        .map(({ value: role, ...count }) => ({ role, ...count }))
}

export function memberStatusCounts(members: OrganizationMember[]) {
    return countOptions(members, ['active', 'removed', 'revoked', 'inactive'], member => member.status)
        .map(({ value: status, ...count }) => ({ status, ...count }))
}

export function memberRoleStatusCounts(members: OrganizationMember[]) {
    const roles: OrganizationRole[] = ['owner', 'admin', 'editor', 'reader']
    return countOptions(members, roles, member => member.role)
        .map(({ value: role, ...count }) => ({ role, ...count }))
}

function countOptions<T, Value extends string>(rows: T[], values: Value[], getValue: (row: T) => string) {
    const counts = new Map<string, number>()
    for (const row of rows) {
        const value = getValue(row).toLowerCase()
        counts.set(value, (counts.get(value) || 0) + 1)
    }
    return values.map(value => ({ value, label: sentenceCase(value), count: counts.get(value) || 0 }))
}

export function isEmailLike(value: string | undefined): value is string {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function inviteActionAllowed(invite: OrganizationInvite, action: 'copy' | 'resend' | 'revoke') {
    const status = invite.status.toLowerCase()
    if (action === 'copy') return status === 'pending'
    if (action === 'resend') return status === 'pending' || status === 'expired'
    return status === 'pending'
}

export function memberCanMutate(member: OrganizationMember) {
    const status = member.status.toLowerCase()
    return member.role.toLowerCase() !== 'owner' && status !== 'removed' && status !== 'revoked' && status !== 'inactive'
}

export function memberMutationDisabledReason(canManage: boolean, member: OrganizationMember) {
    if (!canManage) return 'Owner or admin required'
    if (member.role.toLowerCase() === 'owner') return 'Owner role cannot be changed here'
    if (['removed', 'revoked', 'inactive'].includes(member.status.toLowerCase())) return 'Access is closed'
    return ''
}
