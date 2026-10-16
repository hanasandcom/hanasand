import { withTransaction } from '#db'
import { updateActiveOrganizationMemberRole } from '#utils/db/identityDataWrites.ts'
import { activeOrganizationOwnerCount, organizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { hasOrganizationPrivacyDeletionMarker } from '#utils/organizationLifecycle.ts'
import { loadSupportMemberDetail } from '../cases/organizationReadData.ts'
import { supportRoleRecoveryDecision } from './policy.ts'
import type { OrganizationRole } from '#utils/organizations.ts'
import type { MemberRoleRecoveryContext, MemberRoleRecoveryMutation } from './types.ts'

export async function mutateMemberRoleRecovery(
    context: MemberRoleRecoveryContext,
): Promise<
    | { kind: 'denied'; ownerCount: number; message: string }
    | { kind: 'unchanged'; ownerCount: number }
    | { kind: 'mutation'; result: MemberRoleRecoveryMutation }
> {
    const ownerCount = await activeOrganizationOwnerCount(context.organization.id)
    const decision = supportRoleRecoveryDecision(context.member.role as OrganizationRole, context.role, ownerCount)
    if (decision.kind === 'denied') return { kind: 'denied', ownerCount, message: decision.message }
    if (decision.kind === 'unchanged') return { kind: 'unchanged', ownerCount }

    const result = await withTransaction(async query => {
        await query(`
            SELECT users.id
            FROM users
            WHERE users.id = ANY($1::text[])
               OR EXISTS (
                    SELECT 1
                    FROM organization_members membership
                    WHERE membership.organization_id = $2
                      AND membership.user_id = users.id
                      AND membership.status = 'active'
                      AND membership.role IN ('owner', 'admin')
                )
            ORDER BY users.id
            FOR UPDATE
        `, [[context.actor.id, context.req.params.userId].sort(), context.organization.id])
        await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [context.organization.id])
        if (await hasOrganizationPrivacyDeletionMarker(context.organization.id, query)) {
            return { error: 'organization_deletion_in_progress' as const }
        }

        const member = await loadSupportMemberDetail(context.organization.id, context.req.params.userId, query, true)
        if (!member) return { error: 'member_not_found' as const }
        if (member.status !== 'active') return { error: 'revoked_member' as const, member }

        const availability = await organizationMembershipAvailability([context.organization.id], query)
        if (availability[0]?.hasAvailableAdmin === true) {
            return { error: 'active_admin_available' as const, member }
        }

        const currentOwnerCount = await activeOrganizationOwnerCount(context.organization.id, query)
        const currentDecision = supportRoleRecoveryDecision(member.role as OrganizationRole, context.role, currentOwnerCount)
        if (currentDecision.kind === 'denied') {
            return { error: 'permission_denied' as const, member, ownerCount: currentOwnerCount, message: currentDecision.message }
        }
        if (currentDecision.kind === 'unchanged') {
            return { error: 'member_role_already_set' as const, member, ownerCount: currentOwnerCount }
        }

        const updatedMember = await updateActiveOrganizationMemberRole({
            organizationId: context.organization.id,
            userId: context.req.params.userId,
            role: context.role,
        }, query)
        if (!updatedMember) return { error: 'member_not_found' as const }
        return { error: null, member, ownerCount: currentOwnerCount, updatedMember }
    })

    return { kind: 'mutation', result }
}
