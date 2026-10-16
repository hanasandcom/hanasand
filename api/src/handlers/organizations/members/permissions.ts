import type { OrganizationRole } from '#utils/organizations.ts'

export function removalPermissionError(actorRole: OrganizationRole | undefined, targetRole: OrganizationRole) {
    if (actorRole === 'owner') return null
    if (actorRole === 'admin' && ['editor', 'reader', 'member', 'viewer'].includes(targetRole)) return null
    if (actorRole === 'admin') return 'Organization admins can only remove editors and readers.'
    return 'Only organization owners and admins can remove members.'
}

export function roleUpdatePermissionError(actorRole: OrganizationRole | undefined, targetRole: OrganizationRole, newRole: OrganizationRole) {
    if (actorRole === 'owner') return null
    if (actorRole === 'admin' && ['editor', 'reader', 'member', 'viewer'].includes(targetRole) && ['editor', 'reader'].includes(newRole)) return null
    if (actorRole === 'admin') return 'Organization admins can only update editors and readers to editor or reader roles.'
    return 'Only organization owners and admins can update member roles.'
}
