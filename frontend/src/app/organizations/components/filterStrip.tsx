import { SelectField } from './shared'
import { inputClass, secondaryButtonClass } from '../constants/styles'

type Props = {
    scope: 'member' | 'invite'
    className?: string
    searchLabel: string
    query: string
    placeholder: string
    onQueryChange: (value: string) => void
    selectLabel: string
    selectedOption: string
    options: string[]
    onSelectChange: (value: string) => void
    visibleCount: number
    totalCount: number
    disabled: boolean
    canClear: boolean
    onClear: () => void
}

export function OrganizationFilterStrip({
    scope,
    className = '',
    searchLabel,
    query,
    placeholder,
    onQueryChange,
    selectLabel,
    selectedOption,
    options,
    onSelectChange,
    visibleCount,
    totalCount,
    disabled,
    canClear,
    onClear,
}: Props) {
    const stripMarker = scope === 'member'
        ? { 'data-org-member-filter-strip': 'true' }
        : { 'data-org-invite-filter-strip': 'true' }
    const countMarker = scope === 'member'
        ? { 'data-org-member-filter-count': 'true' }
        : { 'data-org-invite-filter-count': 'true' }

    return <div {...stripMarker} className={`${className} grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas md:grid-cols-[minmax(0,1fr)_9rem_auto]`.trim()}>
        <label className='grid min-w-0 gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
            {searchLabel}
            <input value={query} disabled={disabled} onChange={event => onQueryChange(event.target.value)} className={inputClass} placeholder={placeholder} />
        </label>
        <SelectField label={selectLabel} value={selectedOption} options={options} disabled={disabled} onChange={onSelectChange} />
        <div className='grid content-end gap-1'>
            <span {...countMarker} className='rounded-md border border-ui-border bg-ui-panel px-2 py-2 text-center text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>
                {visibleCount}/{totalCount} shown
            </span>
            <button type='button' className={secondaryButtonClass} disabled={!canClear || disabled} onClick={onClear}>Clear</button>
        </div>
    </div>
}
