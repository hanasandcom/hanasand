import type { ReactNode } from 'react'
import { Filter, Search } from 'lucide-react'
import type { ActivityFilters } from './activityModel'

type Props = {
    filters: ActivityFilters
    open: boolean
    onToggle: () => void
    onChange: (key: keyof ActivityFilters, value: string) => void
    onClear: () => void
}

export function ActivityFilters({ filters, open, onToggle, onChange, onClear }: Props) {
    const activeCount = Object.entries(filters).filter(([key, value]) => key !== 'q' && Boolean(value)).length
    return <section className='sticky top-0 z-20 border-b border-ui-border bg-ui-panel/95 px-4 py-3 backdrop-blur md:px-6'>
        <div className='flex flex-col gap-2 xl:grid xl:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.8fr_0.8fr_8rem_8rem_auto]'>
            <div className='flex min-w-0 gap-2'>
                <div className='min-w-0 flex-1 xl:contents'>
                    <FilterInput icon={<Search className='h-4 w-4' />} label='Search' value={filters.q} onChange={value => onChange('q', value)} placeholder='Any text' />
                </div>
                <button type='button' aria-expanded={open} aria-controls='activity-extra-filters' onClick={onToggle} className='inline-flex h-11 shrink-0 items-center gap-2 self-end rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:text-ui-text xl:hidden'>
                    <Filter className='h-4 w-4' />
                    Filters{activeCount ? ` · ${activeCount}` : ''}
                </button>
            </div>
            <div id='activity-extra-filters' className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-2 sm:grid-cols-3 xl:contents`}>
                <FilterInput label='Company' value={filters.company} onChange={value => onChange('company', value)} placeholder='Company' />
                <FilterInput label='Actor' value={filters.actor} onChange={value => onChange('actor', value)} placeholder='Group' />
                <FilterInput label='Category' value={filters.category} onChange={value => onChange('category', value)} placeholder='Documents' />
                <FilterInput label='Size' value={filters.size} onChange={value => onChange('size', value)} placeholder='5GB' />
                <FilterInput label='Country' value={filters.country} onChange={value => onChange('country', value)} placeholder='Norway' />
                <DateInput label='From' value={filters.from} onChange={value => onChange('from', value)} />
                <DateInput label='To' value={filters.to} onChange={value => onChange('to', value)} />
                <ClearFilters onClear={onClear} />
            </div>
        </div>
    </section>
}

function ClearFilters({ onClear }: { onClear: () => void }) {
    return <div className='grid gap-1'>
        <span className='text-[10px] font-semibold uppercase text-ui-muted'>Filters</span>
        <button type='button' onClick={onClear} className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:text-ui-text'>
            <Filter className='h-4 w-4' />Clear
        </button>
    </div>
}

function FilterInput({ label, value, onChange, placeholder, icon }: { label: string, value: string, onChange: (value: string) => void, placeholder: string, icon?: ReactNode }) {
    return <label className='grid gap-1'>
        <span className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</span>
        <span className='flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3'>
            {icon}
            <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className='min-w-0 flex-1 bg-transparent text-sm font-semibold text-ui-text outline-none placeholder:text-ui-muted' />
        </span>
    </label>
}

function DateInput({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
    return <label className='grid gap-1'>
        <span className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</span>
        <input type='date' value={value} onChange={event => onChange(event.target.value)} className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text outline-none' />
    </label>
}
