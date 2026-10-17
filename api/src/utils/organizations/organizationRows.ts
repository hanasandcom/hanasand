import { normalizeOrganizationRole } from '../organizationRoles.ts'
import type { OrganizationRow } from './rowTypes.ts'
import { organizationSettingsFromRow } from './organizationSettings.ts'
import { normalizeOrganizationStatus } from './normalization/organizationValues.ts'

export function toOrganization(row: OrganizationRow) {
    const settings = organizationSettingsFromRow(row)
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: normalizeOrganizationStatus(row.status),
        role: row.role ? normalizeOrganizationRole(row.role) : undefined,
        memberCount: Number(row.member_count ?? 0),
        ownerCount: Number(row.owner_count ?? 0),
        activeAdminCount: Number(row.admin_count ?? row.owner_count ?? 0),
        pendingInviteCount: Number(row.pending_invite_count ?? 0),
        sharedWatchlistCount: Number(row.shared_watchlist_count ?? 0),
        settings,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}
