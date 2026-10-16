import type { OrganizationRole } from '../types/organization'
import { organizationRoleLabel } from '../model/labels'
import { compactSelectClass, secondaryButtonClass } from '../constants/styles'
import { roleOptions } from '../constants/options'
import { CheckCircle2 } from 'lucide-react'

export function MemberRoleEditor({ memberId, role, changed, busy, layout, onChange, onApply }: {
    memberId: string
    role: OrganizationRole
    changed: boolean
    busy: boolean
    layout: 'mobile' | 'desktop'
    onChange: (role: OrganizationRole) => void
    onApply: () => void
}) {
    const editor = (
        <>
            <select className={compactSelectClass} value={role} disabled={busy} onChange={event => onChange(event.target.value as OrganizationRole)}>
                {roleOptions.map(option => <option key={option} value={option}>{organizationRoleLabel(option)}</option>)}
            </select>
            {(layout === 'mobile' || changed) && (
                <button type='button' className={secondaryButtonClass} disabled={!changed || busy} onClick={onApply}>
                    <CheckCircle2 className='h-4 w-4' />
                    Apply
                </button>
            )}
        </>
    )
    return (
        <div className={layout === 'mobile' ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-2' : 'flex flex-wrap items-center gap-2'} data-member-role-editor={memberId}>
            {editor}
        </div>
    )
}
