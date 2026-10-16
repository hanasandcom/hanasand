import type { OrganizationRole } from '#utils/organizations.ts'

export function supportRoleRecoveryDecision(currentRole: OrganizationRole, newRole: OrganizationRole, ownerCount: number) {
    if (newRole === 'owner') return { kind: 'denied' as const, message: 'Support role recovery cannot grant organization owner.' }
    if (!['owner', 'admin', 'editor', 'reader', 'member', 'viewer'].includes(currentRole)) {
        return { kind: 'denied' as const, message: 'Unsupported current member role.' }
    }
    if (currentRole === 'owner' && ownerCount <= 1) {
        return { kind: 'denied' as const, message: 'Support role recovery cannot demote the last active owner.' }
    }
    if (currentRole === newRole) return { kind: 'unchanged' as const }
    return { kind: 'allowed' as const }
}
