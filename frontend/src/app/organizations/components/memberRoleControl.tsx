import type { OrganizationMember, OrganizationRole } from '../types/organization'
import { organizationRoleLabel } from '../model/labels'
import { compactSelectClass, secondaryButtonClass } from '../constants/styles'
import { roleOptions } from '../constants/options'
import { CheckCircle2 } from 'lucide-react'
import { RoleBadge } from './shared'

export function MemberRoleControl({ member, pendingRole, canEdit, busy, layout, onChange, onApply }: {
    member: OrganizationMember
    pendingRole?: OrganizationRole
    canEdit: boolean
    busy: boolean
    layout: 'mobile' | 'desktop'
    onChange: (memberId: string, role: OrganizationRole) => void
    onApply: (member: OrganizationMember, role: OrganizationRole) => void
}) {
    const role = pendingRole || member.role
    if (!canEdit) return <RoleBadge role={member.role} />

    const changed = role !== member.role
    return (
        <div className={layout === 'mobile' ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-2' : 'flex flex-wrap items-center gap-2'} data-member-role-editor={member.userId}>
            <select className={compactSelectClass} value={role} disabled={busy} onChange={event => onChange(member.userId, event.target.value as OrganizationRole)}>
                {roleOptions.map(option => <option key={option} value={option}>{organizationRoleLabel(option)}</option>)}
            </select>
            {(layout === 'mobile' || changed) && (
                <button type='button' className={secondaryButtonClass} disabled={!changed || busy} onClick={() => onApply(member, role)}>
                    <CheckCircle2 className='h-4 w-4' />
                    Apply
                </button>
            )}
        </div>
    )
}
