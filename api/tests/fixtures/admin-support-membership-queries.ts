import { hasSqlFragments, state, defaultSupportInviteFixture } from './admin-support-routes-state.ts'

export async function runSupportMembershipQueries(sql: string, normalizedSql: string) {
    // Invite and membership reads.
    if (hasSqlFragments(normalizedSql, [
        'SELECT invite.*, organization.name AS organization_name, organization.slug AS organization_slug',
        'FROM organization_invites invite JOIN organizations organization ON organization.id = invite.organization_id',
        'WHERE invite.id = $1 AND invite.organization_id = $2 LIMIT 1',
    ])) {
        if (state.supportInspectionInvite === null) return { rows: [] }
        if (state.supportInspectionInvite !== undefined) return { rows: [state.supportInspectionInvite] }
        return { rows: [defaultSupportInviteFixture()] }
    }
    if (normalizedSql.includes('SELECT * FROM organization_invites WHERE id = $1 AND organization_id = $2 LIMIT 1')) {
        state.supportInviteReads += 1
        if (state.supportInspectionInvite === null) return { rows: [] }
        if (state.supportInspectionInvite) return { rows: [state.supportInspectionInvite] }
        const invite = defaultSupportInviteFixture(
            state.supportInviteReads > 1 && state.acceptedInviteWinsRace ? 'accepted' : 'pending',
        )
        return { rows: [invite] }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN users ON users.id = om.user_id',
        'JOIN organizations ON organizations.id = om.organization_id',
        'WHERE om.organization_id = $1',
        'om.user_id = $2',
    ])) {
        if (state.supportInspectionMember === null) return { rows: [] }
        if (state.supportInspectionMember) return { rows: [state.supportInspectionMember] }
        return { rows: [{
            organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org', user_id: 'member-1',
            name: 'Member', avatar: null, active: true, role: state.supportMemberRole, status: 'active', invited_by: 'owner-1',
            joined_at: '2026-10-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        }] }
    }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN organizations ON organizations.id = om.organization_id',
        'om.organization_id ILIKE',
        'ORDER BY organizations.name ASC, users.name ASC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN users ON users.id = om.user_id',
        'WHERE om.organization_id = $1',
        'ORDER BY',
        'CASE om.role',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM organization_members om',
        'JOIN organizations ON organizations.id = om.organization_id',
        'WHERE om.user_id = $1',
        'ORDER BY organizations.name ASC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'organization_invites.organization_id ILIKE',
        'ORDER BY organization_invites.status ASC, organization_invites.created_at DESC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'organization_invites.id ILIKE',
        'ORDER BY organization_invites.status ASC, organization_invites.created_at DESC',
        'LIMIT',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT organization_invites.*',
        'FROM organization_invites',
        'JOIN organizations ON organizations.id = organization_invites.organization_id',
        'lower(organization_invites.email) = lower($1)',
        'organization_invites.status = \'pending\'',
        'ORDER BY organization_invites.created_at DESC',
    ])) return { rows: state.supportUserInvites }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_invites',
        'WHERE organization_id = $1',
        'id = ANY($2::text[])',
        'ORDER BY created_at DESC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_invites',
        'WHERE organization_id = $1',
        'ORDER BY status ASC, created_at DESC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT *',
        'FROM organization_watchlist_items',
        'WHERE organization_id = $1',
        'archived_at IS NULL',
        'ORDER BY kind ASC, value ASC',
    ])) return { rows: [] }
    if (hasSqlFragments(normalizedSql, [
        'SELECT',
        'FROM dwm_webhook_destinations',
        'WHERE org_id = $1',
        'status <> \'archived\'',
        'ORDER BY status ASC, updated_at DESC',
    ])) return { rows: [] }
    return undefined
}
