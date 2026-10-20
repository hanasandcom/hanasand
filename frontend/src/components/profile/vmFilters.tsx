'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ListFilter, RotateCcw } from 'lucide-react'
import { defaultVmFilters, type VmFilters } from '@/utils/vms/filterVms'

export default function VmFiltersButton({ filters, onChange, editors }: { filters: VmFilters, onChange: (filters: VmFilters) => void, editors: string[] }) {
    const [open, setOpen] = useState(false)
    const panelId = useId()
    const root = useRef<HTMLDivElement>(null)
    const activeCount = Object.entries(filters).filter(([key, value]) => key === 'name' ? Boolean(value.trim()) : Boolean(value)).length

    useEffect(() => {
        if (!open) return
        const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
        const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
        document.addEventListener('pointerdown', closeOutside)
        document.addEventListener('keydown', closeEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOutside)
            document.removeEventListener('keydown', closeEscape)
        }
    }, [open])

    function update(key: keyof VmFilters, value: string) { onChange({ ...filters, [key]: value }) }
    function select(label: string, key: keyof VmFilters, choices: [string, string][]) {
        return <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>{label}<select value={filters[key]} onChange={event => update(key, event.target.value)} className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15'><option value=''>Any</option>{choices.map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label>
    }

    return <div className='relative' ref={root}>
        <button type='button' aria-label='Filter virtual machines' aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${open || activeCount ? 'border-ui-primary/40 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>
            <ListFilter className='h-4 w-4' aria-hidden='true' />
            {activeCount > 0 && <span className='absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-ui-panel bg-ui-primary px-1 text-[9px] font-semibold text-ui-on-primary'>{activeCount}</span>}
        </button>
        {open && <section id={panelId} aria-label='Filter virtual machines' className='fixed right-3 top-16 z-30 grid max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] gap-4 overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-4 text-ui-text shadow-2xl shadow-black/25 ring-1 ring-white/5 lg:absolute lg:right-0 lg:top-11 lg:max-h-[min(80vh,42rem)]'>
            <div className='flex items-start justify-between gap-3'>
                <div><h3 className='text-sm font-semibold'>Refine machines</h3><p className='mt-1 text-xs text-ui-muted'>Narrow the list by name and configuration.</p></div>
                {activeCount > 0 && <button type='button' onClick={() => onChange(defaultVmFilters)} className='inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'><RotateCcw className='h-3.5 w-3.5' />Clear</button>}
            </div>
            <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Name<input type='search' value={filters.name} onChange={event => update('name', event.target.value)} placeholder='Search VM names' className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none transition placeholder:text-ui-muted/70 focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15' /></label>
            <div className='grid grid-cols-2 gap-3'>
                {select('Minimum CPU', 'cpu', [['1', '1 core'], ['2', '2 cores'], ['4', '4 cores'], ['8', '8 cores']])}
                {select('Minimum memory', 'memory', [['1', '1 GB'], ['2', '2 GB'], ['4', '4 GB'], ['8', '8 GB']])}
                {select('Editors', 'editors', [['with', 'Has editors'], ['without', 'No editors'], ...editors.map(editor => [editor, editor] as [string, string])])}
                {select('Deletion', 'lifecycle', [['active', 'Active'], ['scheduled', 'Scheduled']])}
                {select('Power state', 'status', [['running', 'Running'], ['stopped', 'Stopped']])}
            </div>
            <p className='border-t border-ui-border pt-3 text-xs text-ui-muted'>Filters update the list as you choose them.</p>
        </section>}
    </div>
}
