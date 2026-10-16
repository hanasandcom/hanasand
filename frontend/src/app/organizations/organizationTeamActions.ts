import type { Dispatch, SetStateAction } from 'react'
import type { OrganizationInvite, OrganizationMember, OrganizationRole, OrganizationSummary } from './types/organization'
import type { WorkspaceAction } from './useWorkspaceActionRunner'
import type { OrgBundle } from './types/bundle'
import { inviteEmailConflicts, invalidInviteEmails, parseInviteEmails } from './model/forms'
import { organizationMemberLabel } from './model/organization'
import { requestJson } from './model/workspaceApi'

type TeamOptions = {
    selectedOrganization?: OrganizationSummary
    runAction: WorkspaceAction
    requireManage: () => void
    inviteEmails: string
    setInviteEmails: Dispatch<SetStateAction<string>>
    inviteRole: OrganizationRole
    bundle: OrgBundle
}

export function createOrganizationTeamActions(options: TeamOptions) {
    const { selectedOrganization, runAction, requireManage, inviteEmails, setInviteEmails, inviteRole, bundle } = options
    const sendInvite = () => selectedOrganization && runAction('send-invite', async () => {
        requireManage()
        const emails = parseInviteEmails(inviteEmails)
        const invalidEmails = invalidInviteEmails(inviteEmails)
        const conflicts = inviteEmailConflicts(emails, bundle.invites, bundle.members)
        if (invalidEmails.length) throw new Error(`Invalid email: ${invalidEmails[0]}`)
        if (!emails.length) throw new Error('Enter at least one email.')
        if (conflicts.length) throw new Error(`Already in this workspace: ${conflicts[0]}`)
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/invites`, {
            method: 'POST',
            body: JSON.stringify({
                emails,
                role: inviteRole,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setInviteEmails('')
        return `${emails.length} ${inviteRole} invite${emails.length === 1 ? '' : 's'} sent.`
    }, 'invite-create')

    const inviteAction = (invite: OrganizationInvite, action: 'revoke' | 'resend') => selectedOrganization && runAction(`${action}-invite`, async () => {
        requireManage()
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/invites/${encodeURIComponent(invite.id)}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                reason: action === 'revoke' ? 'Access no longer required.' : 'Invite reissued from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return action === 'revoke' ? `Invite revoked for ${invite.email}.` : `Invite resent to ${invite.email}.`
    }, `invite-${invite.id}`)

    const copyInvite = (invite: OrganizationInvite) => runAction('copy-invite', async () => {
        requireManage()
        const value = invite.acceptanceUrl || invite.acceptancePath || invite.token
        if (!value) throw new Error('Invite link is not available.')
        await navigator.clipboard.writeText(value)
        return 'Invite link copied.'
    }, `invite-${invite.id}`)

    const changeMemberRole = (member: OrganizationMember, role: OrganizationRole) => selectedOrganization && runAction('change-role', async () => {
        requireManage()
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/members/${encodeURIComponent(member.userId)}/role`, {
            method: 'PATCH',
            body: JSON.stringify({
                role,
                reason: 'Role updated from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return `${organizationMemberLabel(member.userId, bundle.members)} changed to ${role}.`
    }, `member-${member.userId}`)

    const removeMember = (member: OrganizationMember) => selectedOrganization && runAction('remove-member', async () => {
        requireManage()
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/members/${encodeURIComponent(member.userId)}`, {
            method: 'DELETE',
            body: JSON.stringify({
                reason: 'Member removed from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return `${organizationMemberLabel(member.userId, bundle.members)} removed.`
    }, `member-${member.userId}`)
    return { sendInvite, inviteAction, copyInvite, changeMemberRole, removeMember }
}
