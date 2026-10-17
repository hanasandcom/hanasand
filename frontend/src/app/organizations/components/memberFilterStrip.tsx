import { OrganizationFilterStrip } from './filterStrip'
import { roleOptions } from '../constants/options'
import type { OrganizationRole } from '../types/organization'
import { OrganizationCountBadges } from './organizationCountBadges'

type StatusCount = { status: string, label: string, count: number }
type RoleCount = { role: OrganizationRole, label: string, count: number }

export function MemberFilterStrip({ memberCounts, roleCounts, query, roleFilter, visibleCount, totalCount, busy, onQueryChange, onRoleChange, onClear }: {
    memberCounts: StatusCount[]
    roleCounts: RoleCount[]
    query: string
    roleFilter: string
    visibleCount: number
    totalCount: number
    busy: boolean
    onQueryChange: (query: string) => void
    onRoleChange: (role: string) => void
    onClear: () => void
}) {
    return (
        <>
            <OrganizationCountBadges counts={[...memberCounts, ...roleCounts]} className='mb-3 flex flex-wrap gap-2' marker='data-org-member-status-counts' hideZero />
            <OrganizationFilterStrip
                scope='member'
                className='mb-3'
                searchLabel='Find member'
                query={query}
                placeholder='Name, email, status'
                onQueryChange={onQueryChange}
                selectLabel='Role'
                selectedOption={roleFilter}
                options={['all', 'owner', ...roleOptions]}
                onSelectChange={onRoleChange}
                visibleCount={visibleCount}
                totalCount={totalCount}
                disabled={busy}
                canClear={roleFilter !== 'all' || Boolean(query.trim())}
                onClear={onClear}
            />
        </>
    )
}
