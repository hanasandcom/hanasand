import { grantInternalOrganizationAccess } from './fixture.mjs'

export async function setupActors(context, api) {
    const { adminId, targetId, inactiveTargetId, nonAdminId, pool } = context
    await api.signup(adminId, 'Impersonation Admin')
    await api.signup(targetId, 'Impersonation Target')
    await api.signup(inactiveTargetId, 'Inactive Impersonation Target')
    await api.signup(nonAdminId, 'Impersonation Non Admin')
    await grantInternalOrganizationAccess(context)
    await pool.query('UPDATE users SET active = FALSE WHERE id = $1', [inactiveTargetId])

    return {
        adminToken: await api.login(adminId),
        nonAdminToken: await api.login(nonAdminId),
    }
}
