'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { defaultVmFilters, type VmFilters } from '@/utils/vms/filterVms'
import { createPortal } from 'react-dom'

export default function VmFiltersButton({ filters, onChange, editors }: { filters: VmFilters, onChange: (filters: VmFilters) => void, editors: string[] }) {
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<{ top: number, right: number, mobile: boolean, maxHeight: number }>()
    const panelId = useId()
    const root = useRef<HTMLDivElement>(null)
    const panel = useRef<HTMLElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const activeCount = Object.entries(filters).filter(([key, value]) => key === 'name' ? Boolean(value.trim()) : Boolean(value)).length

    useEffect(() => {
        if (!open) return
        const closeOutside = (event: PointerEvent) => {
            const target = event.target as Node
            if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
        }
        const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
        const closeOnScroll = () => setOpen(false)
        document.addEventListener('pointerdown', closeOutside)
        document.addEventListener('keydown', closeEscape)
        document.addEventListener('scroll', closeOnScroll, true)
        return () => {
            document.removeEventListener('pointerdown', closeOutside)
            document.removeEventListener('keydown', closeEscape)
            document.removeEventListener('scroll', closeOnScroll, true)
        }
    }, [open])

    function togglePanel() {
        if (open) {
            setOpen(false)
            return
        }
        const triggerBounds = trigger.current?.getBoundingClientRect()
        let top = Math.round((triggerBounds?.bottom || 80) + 8)
        const mobile = window.innerWidth < 1024
        const viewportHeight = window.visualViewport?.height || window.innerHeight
        if (triggerBounds && viewportHeight - top < 240) top = Math.max(80, Math.round(triggerBounds.top - Math.min(420, viewportHeight - 96)))
        const right = mobile ? 8 : Math.max(8, window.innerWidth - (triggerBounds?.right || window.innerWidth - 8))
        setPosition({ top, right, mobile, maxHeight: Math.max(160, viewportHeight - top - 8) })
        setOpen(true)
    }

    function update(key: keyof VmFilters, value: string) { onChange({ ...filters, [key]: value }) }
    function select(label: string, key: keyof VmFilters, choices: [string, string][]) {
        return <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>{label}<select value={filters[key]} onChange={event => update(key, event.target.value)} className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15'><option value=''>Any</option>{choices.map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label>
    }

    return <>
        <div className='relative' ref={root}>
            <button ref={trigger} type='button' aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'} aria-expanded={open} aria-controls={panelId} onClick={togglePanel} className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary ${open || activeCount ? 'border-ui-primary/40 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>
                <svg aria-hidden='true' viewBox='0 0 20 20' className='h-[18px] w-[18px]' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
                    <path d='M2.5 4.5h15M2.5 10h15M2.5 15.5h15' />
                    <circle cx='6' cy='4.5' r='1.6' fill='var(--ui-panel)' />
                    <circle cx='13.5' cy='10' r='1.6' fill='var(--ui-panel)' />
                    <circle cx='8.5' cy='15.5' r='1.6' fill='var(--ui-panel)' />
                </svg>
                {activeCount > 0 && <span aria-hidden='true' className='absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-ui-panel bg-ui-primary px-1 text-[10px] font-semibold leading-none text-ui-on-primary'>{activeCount}</span>}
            </button>
        </div>
        {open && position && typeof document !== 'undefined' && createPortal(<section ref={panel} id={panelId} aria-label='Filter virtual machines' className='fixed z-[1100] grid w-auto gap-4 overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-2 text-ui-text shadow-2xl shadow-black/25 ring-1 ring-white/5' style={{ top: position.top, left: position.mobile ? 8 : undefined, right: position.right, width: position.mobile ? 'calc(100vw - 16px)' : '22rem', maxHeight: position.maxHeight }}>
            <div className='flex items-start justify-between gap-3'>
                <h3 className='text-sm font-semibold'>Filter</h3>
                {activeCount > 0 && <button type='button' onClick={() => onChange(defaultVmFilters)} className='inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'><RotateCcw className='h-3.5 w-3.5' />Clear</button>}
            </div>
            <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Name<input type='search' value={filters.name} onChange={event => update('name', event.target.value)} placeholder='Search VM names' className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none transition placeholder:text-ui-muted/70 focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15' /></label>
            <div className='grid grid-cols-1 gap-3 min-[380px]:grid-cols-2'>
                {select('Minimum CPU', 'cpu', [['1', '1 core'], ['2', '2 cores'], ['4', '4 cores'], ['8', '8 cores']])}
                {select('Minimum memory', 'memory', [['1', '1 GB'], ['2', '2 GB'], ['4', '4 GB'], ['8', '8 GB']])}
                {select('Editors', 'editors', [['with', 'Has editors'], ['without', 'No editors'], ...editors.map(editor => [editor, editor] as [string, string])])}
                {select('Deletion', 'lifecycle', [['active', 'Active'], ['scheduled', 'Scheduled']])}
                {select('Power state', 'status', [['running', 'Running'], ['stopped', 'Stopped']])}
            </div>
        </section>, document.body)}
    </>
}
