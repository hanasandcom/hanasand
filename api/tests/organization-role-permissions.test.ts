import { expect, test } from 'bun:test'
import { normalizeInviteInput, normalizeMemberRoleInput, organizationAlertCaseRoleActions, organizationMemberAccessContract, organizationMemberMutationDenial, organizationVisibilityDecision } from '../src/utils/organizations.ts'
import { roleCanEditOrganization, roleCanManageOrganization, type OrganizationRole } from '../src/utils/organizationRoles.ts'

test('legacy roles and invitations become Reader without gaining permissions', () => {
    for (const legacy of ['member', 'viewer']) {
        expect(normalizeInviteInput({ email: 'person@example.com', role: legacy }).role).toBe('reader')
        expect(normalizeMemberRoleInput({ role: legacy, reason: 'Migrate existing access' }).role).toBe('reader')
        expect(roleCanEditOrganization(legacy)).toBe(false)
        expect(organizationAlertCaseRoleActions(legacy as OrganizationRole)).toEqual([])
    }
    expect(normalizeInviteInput({ email: 'person@example.com' }).role).toBe('reader')
    expect(normalizeInviteInput({ email: 'person@example.com', role: 'editor' }).role).toBe('editor')
})
test('organization roles grant only their documented case and management actions', () => {
    const allManagementActions = [
        'create_watchlist', 'edit_watchlist_terms', 'archive_watchlist', 'restore_watchlist',
        'acknowledge_alert', 'assign_case', 'link_case', 'manage_invites',
    ]
    const editorActions = allManagementActions.filter(action => action !== 'manage_invites')
    const analystActions = ['acknowledge_alert', 'assign_case', 'link_case']

    for (const role of ['owner', 'admin'] as const) {
        expect(roleCanManageOrganization(role)).toBe(true)
        expect(roleCanEditOrganization(role)).toBe(true)
        expect(organizationAlertCaseRoleActions(role)).toEqual(allManagementActions)
    }
    expect(roleCanManageOrganization('editor')).toBe(false)
    expect(roleCanEditOrganization('editor')).toBe(true)
    expect(organizationAlertCaseRoleActions('editor')).toEqual(editorActions)
    expect(organizationAlertCaseRoleActions('analyst')).toEqual(analystActions)

    for (const role of ['reader', 'member', 'viewer'] as const) {
        expect(roleCanManageOrganization(role)).toBe(false)
        expect(roleCanEditOrganization(role)).toBe(false)
        expect(organizationAlertCaseRoleActions(role)).toEqual([])
    }
    expect(roleCanEditOrganization('unexpected')).toBe(false)
})
test('member role targets stay aligned across validation and access contracts', () => {
    const roleTargets = ['admin', 'editor', 'reader']
    const access = organizationMemberAccessContract({
        id: 'org',
        role: 'owner',
        status: 'active',
        alert_visibility_policy: 'members',
    }, [])
    const deniedRoleChanges = (['remove_member', 'change_member_role'] as const).map(action => organizationMemberMutationDenial({
        organizationId: 'org',
        actorId: 'owner',
        actorRole: 'owner',
        targetUserId: 'member',
        targetRole: 'editor',
        action,
        message: 'Member role change is not allowed.',
    }))

    expect(roleTargets.map(role => normalizeMemberRoleInput({ role, reason: 'Update access.' }).role)).toEqual(roleTargets)
    expect(access.memberLifecycle.roleTargets).toEqual(roleTargets)
    expect(access.memberLifecycle.roleChange.ownerCanAssign).toEqual(roleTargets)
    expect(access.memberLifecycle.roleTargets).not.toBe(access.memberLifecycle.roleChange.ownerCanAssign)
    expect(deniedRoleChanges.map(denial => denial.allowedTargetRoles)).toEqual([roleTargets, roleTargets])
})
test('alert visibility policies allow only the roles named by each policy', () => {
    const policies = [
        { policy: 'members', allowed: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] },
        { policy: 'admins', allowed: ['owner', 'admin'] },
        { policy: 'owners', allowed: ['owner'] },
    ] as const

    for (const { policy, allowed } of policies) {
        for (const candidate of ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] as const) {
            const decision = organizationVisibilityDecision({
                role: candidate,
                status: 'active',
                userActive: true,
                alertVisibilityPolicy: policy,
            })
            expect(decision.allowed).toBe(allowed.includes(candidate))
            expect(decision.reason).toBe(allowed.includes(candidate) ? null : 'role_not_allowed')
            expect(decision.allowedRoles).toEqual(allowed)
        }
    }

    expect(organizationVisibilityDecision({ role: 'editor', status: 'removed', userActive: true }).reason).toBe('member_removed')
    expect(organizationVisibilityDecision({ role: 'editor', status: 'active', userActive: false }).reason).toBe('member_deactivated')
    expect(organizationVisibilityDecision({ status: 'active', userActive: true }).reason).toBe('not_member')
})
