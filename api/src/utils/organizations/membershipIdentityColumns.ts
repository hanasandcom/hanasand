type MembershipUserAlias = 'u' | 'users'

export function organizationMembershipIdentityColumns(userAlias: MembershipUserAlias) {
    return `
        om.organization_id,
        om.user_id,
        ${userAlias}.name,
        ${userAlias}.avatar,
        om.role,
        om.status,
        om.invited_by,
        om.joined_at,
        om.created_at
    `
}
