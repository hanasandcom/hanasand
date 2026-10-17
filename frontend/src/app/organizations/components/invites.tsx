import type { OrganizationRole, OrganizationInvite, OrganizationMember } from '../types/organization'
import type { RowMessage, ActivitySubject } from '../types/activity'
import { parseInviteEmails, invalidInviteEmails, inviteEmailConflicts, inviteStatusCounts, inviteRoleStatusCounts, inviteLink, inviteActionAllowed } from '../model/forms'
import { inviteBusyLabel } from '../model/labels'
import { inviteSearchText } from '../model/organization'
import { DisclosureSummary, InlineBusy, SelectField, RowStatus, EmptyLine, RoleBadge, StatusPill, ConfirmActionButton, OrganizationMetadataBadge } from './shared'
import { OrganizationFilterStrip } from './filterStrip'
import { OrganizationCountBadges } from './organizationCountBadges'
import { inputClass, primaryButtonClass, iconButtonClass } from '../constants/styles'
import { roleOptions } from '../constants/options'
import { useState } from 'react'
import { ChevronDown, Copy, RefreshCw, Trash2, UserPlus } from 'lucide-react'
import { stopRowSelectionKeys } from '../model/keyboard'
import { SelectableSubjectRow } from './selectableSubjectRow'
import { filterRowsByQueryAndStatus } from '../model/filterRows'

export function InvitePanel({ emails, setEmails, role, setRole, invites, members, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onInvite, onInviteAction, onCopyInvite }: { emails: string, setEmails: (value: string) => void, role: OrganizationRole, setRole: (value: OrganizationRole) => void, invites: OrganizationInvite[], members: OrganizationMember[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onInvite: () => void, onInviteAction: (invite: OrganizationInvite, action: 'revoke' | 'resend') => void, onCopyInvite: (invite: OrganizationInvite) => void }) {
    const [inviteQuery, setInviteQuery] = useState('')
    const [inviteStatusFilter, setInviteStatusFilter] = useState('all')
    const parsedEmails = parseInviteEmails(emails)
    const invalidEmails = invalidInviteEmails(emails)
    const inviteConflicts = inviteEmailConflicts(parsedEmails, invites, members)
    const canSendInvite = canManage && parsedEmails.length > 0 && invalidEmails.length === 0 && inviteConflicts.length === 0 && !busy
    const busyLabel = inviteBusyLabel(busy)
    const normalizedInviteQuery = inviteQuery.trim().toLowerCase()
    const visibleInvites = filterRowsByQueryAndStatus(invites, inviteStatusFilter, normalizedInviteQuery, invite => invite.status, inviteSearchText)
    const inviteFiltersActive = Boolean(inviteQuery.trim()) || inviteStatusFilter !== 'all'
    const inviteCounts = inviteStatusCounts(invites)
    const inviteRoleCounts = inviteRoleStatusCounts(invites)
    const pendingInviteCount = invites.filter(invite => invite.status.toLowerCase() === 'pending').length
    return (
        <details id='invites' className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-invite-disclosure>
            <DisclosureSummary
                icon={<UserPlus className='h-4 w-4' />}
                title='Invite'
                detail=''
                accessory={<span className='flex shrink-0 items-center gap-2'>
                    <OrganizationMetadataBadge>{pendingInviteCount} pending</OrganizationMetadataBadge>
                    <ChevronDown aria-hidden='true' className='h-4 w-4 text-ui-muted transition-transform group-open:rotate-180' />
                </span>}
            />
            <div className='grid gap-3 border-t border-ui-border p-4 dark:border-ui-border'>
                {busyLabel && <InlineBusy label={busyLabel} marker='data-org-invite-busy' />}
                {invites.length > 0 && (
                    <OrganizationCountBadges counts={[...inviteCounts, ...inviteRoleCounts]} className='mt-3 flex flex-wrap gap-2' marker='data-org-invite-status-counts' />
                )}
                <div className='mt-4 grid gap-3'>
                    <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                        Emails
                        <textarea value={emails} disabled={!canManage} onChange={event => setEmails(event.target.value)} className={`${inputClass} min-h-24 resize-y`} placeholder='analyst@company.com, admin@company.com' />
                        {invalidEmails.length > 0 && <span className='text-xs font-semibold text-ui-text dark:text-ui-text'>Invalid: {invalidEmails.slice(0, 2).join(', ')}{invalidEmails.length > 2 ? ` +${invalidEmails.length - 2}` : ''}</span>}
                        {invalidEmails.length === 0 && inviteConflicts.length > 0 && <span className='text-xs font-semibold text-ui-warning dark:text-ui-warning' data-org-invite-conflicts='true'>Already in this workspace: {inviteConflicts.slice(0, 2).join(', ')}{inviteConflicts.length > 2 ? ` +${inviteConflicts.length - 2}` : ''}</span>}
                        {invalidEmails.length === 0 && inviteConflicts.length === 0 && parsedEmails.length > 0 && <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>{parsedEmails.length} recipient{parsedEmails.length === 1 ? '' : 's'}</span>}
                    </label>
                    <SelectField label='Role' value={role} options={roleOptions} disabled={!canManage} onChange={value => setRole(value as OrganizationRole)} />
                    <button type='button' className={primaryButtonClass} disabled={!canSendInvite} onClick={onInvite}>
                        <UserPlus className='h-4 w-4' />
                        Send invites
                    </button>
                    <RowStatus message={rowMessages['invite-create']} />
                </div>
                <div className='mt-5 grid gap-2'>
                    {invites.length === 0 && <EmptyLine text='Send invites from the form above. Pending access requests appear here with copy, resend, and revoke actions.' />}
                    {invites.length > 0 && (
                        <>
                            <OrganizationFilterStrip
                                scope='invite'
                                searchLabel='Find invite'
                                query={inviteQuery}
                                placeholder='Email, role, status'
                                onQueryChange={setInviteQuery}
                                selectLabel='Status'
                                selectedOption={inviteStatusFilter}
                                options={['all', 'pending', 'accepted', 'revoked', 'expired']}
                                onSelectChange={setInviteStatusFilter}
                                visibleCount={visibleInvites.length}
                                totalCount={invites.length}
                                disabled={Boolean(busy)}
                                canClear={inviteFiltersActive}
                                onClear={() => {
                                    setInviteQuery('')
                                    setInviteStatusFilter('all')
                                }}
                            />
                            {visibleInvites.length === 0 && <EmptyLine text='Adjust filters to see pending access requests.' />}
                            {visibleInvites.map(invite => {
                                const linkAvailable = Boolean(inviteLink(invite)) && inviteActionAllowed(invite, 'copy')
                                const canCopy = canManage && linkAvailable && !busy
                                const canResend = canManage && inviteActionAllowed(invite, 'resend') && !busy
                                const canRevoke = canManage && inviteActionAllowed(invite, 'revoke') && !busy
                                const copyReason = !canManage ? 'Owner or admin required' : !inviteLink(invite) ? 'Invite link unavailable' : !inviteActionAllowed(invite, 'copy') ? 'Pending invite required' : ''
                                const resendReason = !canManage ? 'Owner or admin required' : !inviteActionAllowed(invite, 'resend') ? 'Invite closed' : ''
                                const revokeReason = !canManage ? 'Owner or admin required' : !inviteActionAllowed(invite, 'revoke') ? 'Invite already closed' : ''
                                const linkState = !canManage ? 'restricted' : linkAvailable ? 'available' : 'closed'
                                const selected = selectedSubject.type === 'invite' && selectedSubject.id === invite.id
                                return (
                                    <SelectableSubjectRow
                                        selected={selected}
                                        id={`invite-${encodeURIComponent(invite.id)}`}
                                        key={invite.id}
                                        className={`grid min-w-0 gap-3 rounded-lg border border-ui-border p-3 text-left transition dark:border-ui-border ${selected ? 'bg-ui-primary/10 dark:bg-ui-raised' : 'hover:bg-ui-raised dark:hover:bg-ui-panel'}`}
                                        onSelect={() => onSelectSubject({ type: 'invite', id: invite.id })}
                                    >
                                        <span className='grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                                            <span className='min-w-0'>
                                                <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{invite.email}</span>
                                                <span className='mt-1 flex flex-wrap gap-2'>
                                                    <RoleBadge role={invite.role} />
                                                    <StatusPill status={invite.status} />
                                                    <span className='rounded-full border border-ui-border px-2 py-0.5 text-xs font-semibold text-ui-muted dark:border-ui-border dark:text-ui-muted' data-org-invite-link-state='true'>
                                                        Link {linkState}
                                                    </span>
                                                </span>
                                                <RowStatus message={rowMessages[`invite-${invite.id}`]} />
                                            </span>
                                            <span className='flex gap-1 sm:justify-end' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                                <button type='button' aria-label={copyReason ? `Copy invite link: ${copyReason}` : 'Copy invite link'} title={copyReason || 'Copy invite link'} className={iconButtonClass} disabled={!canCopy} onClick={event => { event.stopPropagation(); onCopyInvite(invite) }}><Copy className='h-4 w-4' /></button>
                                                <button type='button' aria-label={resendReason ? `Resend invite: ${resendReason}` : 'Resend invite'} title={resendReason || 'Resend invite'} className={iconButtonClass} disabled={!canResend} onClick={event => { event.stopPropagation(); onInviteAction(invite, 'resend') }}><RefreshCw className='h-4 w-4' /></button>
                                                <ConfirmActionButton ariaLabel='Revoke invite' title={revokeReason || 'Revoke invite'} disabled={!canRevoke} onConfirm={() => onInviteAction(invite, 'revoke')} icon={<Trash2 className='h-4 w-4' />} />
                                            </span>
                                        </span>
                                    </SelectableSubjectRow>
                                )
                            })}
                        </>
                    )}
                </div>
            </div>
        </details>
    )
}
