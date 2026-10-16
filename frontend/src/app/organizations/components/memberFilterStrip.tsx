import { SelectField } from './shared'
import { inputClass, secondaryButtonClass } from '../constants/styles'
import { roleOptions } from '../constants/options'
import type { OrganizationRole } from '../types/organization'

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
                    <span key={'status' in item ? item.status : item.role} className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted'>
                        {item.label}: {item.count}
                    </span>
                ))}
            </div>
            <div className='mb-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_9rem_auto]' data-org-member-filter-strip='true'>
                <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
                    Find member
                    <input value={query} disabled={busy} onChange={event => onQueryChange(event.target.value)} className={inputClass} placeholder='Name, email, status' />
                </label>
                <SelectField label='Role' value={roleFilter} options={['all', 'owner', ...roleOptions]} disabled={busy} onChange={onRoleChange} />
                <div className='grid content-end gap-1'>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted' data-org-member-filter-count='true'>
                        {visibleCount}/{totalCount} shown
                    </span>
                    <button type='button' className={secondaryButtonClass} disabled={roleFilter === 'all' && !query.trim() || busy} onClick={onClear}>Clear</button>
                </div>
            </div>
        </>
    )
}
