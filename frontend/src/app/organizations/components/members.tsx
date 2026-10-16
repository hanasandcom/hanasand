import type { OrganizationMember, OrganizationRole } from '../types/organization'
import type { RowMessage, ActivitySubject } from '../types/activity'
import { memberBusyLabel } from '../model/labels'
import { memberSearchText } from '../model/organization'
import { memberStatusCounts, memberRoleStatusCounts, memberCanMutate, memberMutationDisabledReason } from '../model/forms'
import { InlineBusy, EmptyLine, StatusPill, RoleBadge, ConfirmActionButton, RowStatus } from './shared'
import { MemberFilterStrip } from './memberFilterStrip'
import { MemberRoleEditor } from './memberRoleEditor'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { useState } from 'react'
import { stopRowSelectionKeys } from '../model/keyboard'
import { Trash2 } from 'lucide-react'

export function MemberPanel({ members, canManage, busy, rowMessages, selectedSubject, onSelectSubject, onRoleChange, onRemove }: { members: OrganizationMember[], canManage: boolean, busy: string, rowMessages: Record<string, RowMessage>, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void, onRoleChange: (member: OrganizationMember, role: OrganizationRole) => void, onRemove: (member: OrganizationMember) => void }) {
    const [pendingRoles, setPendingRoles] = useState<Record<string, OrganizationRole>>({})
    const [memberQuery, setMemberQuery] = useState('')
    const [memberRoleFilter, setMemberRoleFilter] = useState('all')
    const busyLabel = memberBusyLabel(busy)
    const normalizedMemberQuery = memberQuery.trim().toLowerCase()
    const visibleMembers = members.filter(member => {
        const roleMatches = memberRoleFilter === 'all' || member.role.toLowerCase() === memberRoleFilter
        if (!roleMatches) return false
        if (!normalizedMemberQuery) return true
        return memberSearchText(member).includes(normalizedMemberQuery)
    })
    const memberCounts = memberStatusCounts(members)
    const memberRoleCounts = memberRoleStatusCounts(members)
    return (
        <section id='members' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-members-panel>
            <div className='overflow-x-auto p-4'>
                {busyLabel && <InlineBusy label={busyLabel} marker='data-org-member-busy' />}
                {members.length === 0 && <EmptyLine text='Invite teammates to populate this access table.' />}
                {members.length > 0 && (
                    <>
                        <MemberFilterStrip
                            memberCounts={memberCounts}
                            roleCounts={memberRoleCounts}
                            query={memberQuery}
                            roleFilter={memberRoleFilter}
                            visibleCount={visibleMembers.length}
                            totalCount={members.length}
                            busy={Boolean(busy)}
                            onQueryChange={setMemberQuery}
                            onRoleChange={setMemberRoleFilter}
                            onClear={() => {
                                setMemberQuery('')
                                setMemberRoleFilter('all')
                            }}
                        />
                        {visibleMembers.length === 0 && (
                            <div className='mb-3'>
                                <EmptyLine text='Adjust filters to see matching team members.' />
                            </div>
                        )}
                        <div className='grid gap-2 md:hidden' data-org-member-mobile-list='true'>
                            {visibleMembers.map(member => {
                                const selectedRole = pendingRoles[member.userId] || member.role
                                const roleChanged = selectedRole !== member.role
                                const canMutateMember = canManage && memberCanMutate(member)
                                const memberMutationReason = memberMutationDisabledReason(canManage, member)
                                const selected = selectedSubject.type === 'member' && selectedSubject.id === member.userId
                                return (
                                    <article
                                        key={member.userId}
                                        role='button'
                                        tabIndex={0}
                                        aria-pressed={selected}
                                        className={`grid gap-3 rounded-lg border p-3 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-raised' : 'border-ui-border bg-ui-panel hover:bg-ui-raised dark:border-ui-border dark:bg-ui-canvas dark:hover:bg-ui-panel'}`}
                                        data-org-member-mobile-row='true'
                                        onClick={() => onSelectSubject({ type: 'member', id: member.userId })}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onSelectSubject({ type: 'member', id: member.userId })
                                            }
                                        }}
                                    >
                                        <div className='flex min-w-0 items-start justify-between gap-3'>
                                            <div className='min-w-0'>
                                                <p className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)}</p>
                                                <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(member.email && member.email !== member.userId ? member.email : member.userId)}</p>
                                            </div>
                                            <StatusPill status={member.status} />
                                        </div>
                                        <div className='grid gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                            {canMutateMember ? <MemberRoleEditor
                                                memberId={member.userId}
                                                role={selectedRole}
                                                changed={roleChanged}
                                                busy={Boolean(busy)}
                                                layout='mobile'
                                                onChange={role => setPendingRoles(current => ({ ...current, [member.userId]: role }))}
                                                onApply={() => {
                                                    onRoleChange(member, selectedRole)
                                                    setPendingRoles(current => {
                                                        const next = { ...current }
                                                        delete next[member.userId]
                                                        return next
                                                    })
                                                }}
                                            /> : <RoleBadge role={member.role} />}
                                            <ConfirmActionButton ariaLabel='Remove member' title={memberMutationReason || 'Remove member'} disabled={!canMutateMember || Boolean(busy)} onConfirm={() => onRemove(member)} icon={<Trash2 className='h-4 w-4' />} />
                                            <RowStatus message={rowMessages[`member-${member.userId}`]} />
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                        <table className='hidden min-w-full border-separate border-spacing-0 text-left text-sm md:table' data-org-member-desktop-table='true'>
                            <thead className='text-xs uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>
                                <tr>
                                    <th className='border-b border-ui-border py-2 pr-3 dark:border-ui-border'>User</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Role</th>
                                    <th className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>Status</th>
                                    <th className='border-b border-ui-border py-2 pl-3 text-right dark:border-ui-border'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleMembers.map(member => {
                                    const selectedRole = pendingRoles[member.userId] || member.role
                                    const roleChanged = selectedRole !== member.role
                                    const canMutateMember = canManage && memberCanMutate(member)
                                    const memberMutationReason = memberMutationDisabledReason(canManage, member)
                                    const selected = selectedSubject.type === 'member' && selectedSubject.id === member.userId
                                    return (
                                        <tr
                                            key={member.userId}
                                            id={`member-${encodeURIComponent(member.userId)}`}
                                            role='button'
                                            tabIndex={0}
                                            aria-pressed={selected}
                                            className={`scroll-mt-24 cursor-pointer align-middle transition ${selected ? 'bg-ui-primary/10 dark:bg-ui-raised' : 'hover:bg-ui-raised dark:hover:bg-ui-panel'}`}
                                            onClick={() => onSelectSubject({ type: 'member', id: member.userId })}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    onSelectSubject({ type: 'member', id: member.userId })
                                                }
                                            }}
                                        >
                                            <td className='max-w-44 border-b border-ui-border py-2 pr-3 dark:border-ui-border'>
                                                <p className='truncate font-semibold text-ui-text dark:text-ui-text'>{sanitizeOrganizationDisplayCopy(member.name || member.email || member.userId)}</p>
                                                <p className='truncate text-xs text-ui-muted dark:text-ui-muted'>{sanitizeOrganizationDisplayCopy(member.email && member.email !== member.userId ? member.email : member.userId)}</p>
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                {canMutateMember ? <MemberRoleEditor
                                                    memberId={member.userId}
                                                    role={selectedRole}
                                                    changed={roleChanged}
                                                    busy={Boolean(busy)}
                                                    layout='desktop'
                                                    onChange={role => setPendingRoles(current => ({ ...current, [member.userId]: role }))}
                                                    onApply={() => {
                                                        onRoleChange(member, selectedRole)
                                                        setPendingRoles(current => {
                                                            const next = { ...current }
                                                            delete next[member.userId]
                                                            return next
                                                        })
                                                    }}
                                                /> : <RoleBadge role={member.role} />}
                                            </td>
                                            <td className='border-b border-ui-border px-3 py-2 dark:border-ui-border'>
                                                <div className='grid gap-1'>
                                                    <StatusPill status={member.status} />
                                                    <RowStatus message={rowMessages[`member-${member.userId}`]} />
                                                </div>
                                            </td>
                                            <td className='border-b border-ui-border py-2 pl-3 text-right dark:border-ui-border'>
                                                <div className='flex items-center justify-end'>
                                                    <ConfirmActionButton ariaLabel='Remove member' title={memberMutationReason || 'Remove member'} disabled={!canMutateMember || Boolean(busy)} onConfirm={() => onRemove(member)} icon={<Trash2 className='h-4 w-4' />} />
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        </section>
    )
}
