import type { OrganizationRole } from './organizationRoles.ts'

export type OrganizationAlertVisibilityPolicy = 'members' | 'admins' | 'owners'
export type OrganizationVisibilityDenyReason = 'not_member' | 'member_removed' | 'member_deactivated' | 'role_not_allowed'

export type OrganizationVisibilityDecisionInput = {
    role?: OrganizationRole | null
    status?: 'active' | 'removed' | 'inactive' | null
    userActive?: boolean | null
    alertVisibilityPolicy?: OrganizationAlertVisibilityPolicy | null
}

export type OrganizationVisibilityDecision = {
    allowed: boolean
    reason: OrganizationVisibilityDenyReason | null
    alertVisibilityPolicy: OrganizationAlertVisibilityPolicy
    allowedRoles: OrganizationRole[]
}

export function allowedOrganizationVisibilityRoles(policy: OrganizationAlertVisibilityPolicy): OrganizationRole[] {
    if (policy === 'owners') return ['owner']
    if (policy === 'admins') return ['owner', 'admin']
    return ['owner', 'admin', 'editor', 'reader', 'member', 'viewer']
}

export function organizationVisibilityDecision(input: OrganizationVisibilityDecisionInput): OrganizationVisibilityDecision {
    const alertVisibilityPolicy = input.alertVisibilityPolicy ?? 'members'
    const allowedRoles = allowedOrganizationVisibilityRoles(alertVisibilityPolicy)
    if (!input.role || !input.status) {
        return { allowed: false, reason: 'not_member', alertVisibilityPolicy, allowedRoles }
    }

    if (input.userActive === false) {
        return { allowed: false, reason: 'member_deactivated', alertVisibilityPolicy, allowedRoles }
    }

    if (input.status !== 'active') {
        return { allowed: false, reason: input.status === 'removed' ? 'member_removed' : 'member_deactivated', alertVisibilityPolicy, allowedRoles }
    }

    if (!allowedRoles.includes(input.role)) {
        return { allowed: false, reason: 'role_not_allowed', alertVisibilityPolicy, allowedRoles }
    }

    return { allowed: true, reason: null, alertVisibilityPolicy, allowedRoles }
}
