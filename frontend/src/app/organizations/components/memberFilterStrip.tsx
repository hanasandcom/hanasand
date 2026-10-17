import { OrganizationFilterStrip } from './filterStrip'
import { roleOptions } from '../constants/options'
import type { OrganizationRole } from '../types/organization'
import { OrganizationMetadataBadge } from './shared'

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
            <div className='mb-3 flex flex-wrap gap-2' data-org-member-status-counts='true'>
                {[...memberCounts, ...roleCounts].filter(item => item.count > 0).map(item => (
                    <OrganizationMetadataBadge key={'status' in item ? item.status : item.role}>
                        {item.label}: {item.count}
                    </OrganizationMetadataBadge>
                ))}
            </div>
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
