'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { vmOperatingSystems } from '@/utils/vms/createOptions'

export default function VmOperatingSystemPicker({ value, onChange, disabled }: { value: string, onChange: (value: string) => void, disabled: boolean }) {
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const options = useRef<Array<HTMLButtonElement | null>>([])
    const listboxId = useId()
    const [open, setOpen] = useState(false)
    const selected = vmOperatingSystems.find(os => os.id === value) || vmOperatingSystems[0]

    useEffect(() => {
        if (!open) return
        const closeOutside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('pointerdown', closeOutside)
        return () => document.removeEventListener('pointerdown', closeOutside)
    }, [open])

    useEffect(() => {
        if (open) options.current[vmOperatingSystems.findIndex(os => os.id === value)]?.focus()
    }, [open, value])

    function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
        let next: number | undefined
        if (event.key === 'ArrowDown') next = (index + 1) % vmOperatingSystems.length
        else if (event.key === 'ArrowUp') next = (index - 1 + vmOperatingSystems.length) % vmOperatingSystems.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = vmOperatingSystems.length - 1
        else if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
        if (next !== undefined) { event.preventDefault(); options.current[next]?.focus() }
    }

    return <div ref={root} className='relative grid min-w-0 gap-1 text-sm text-ui-muted'>
        <span>Operating system</span>
        <button ref={trigger} type='button' role='combobox' aria-label='Operating system' aria-haspopup='listbox' aria-expanded={open} aria-controls={listboxId} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
            else if (event.key === 'Escape') setOpen(false)
        }} className='flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-ui-border bg-ui-raised pl-3 pr-5 text-left text-sm text-ui-text outline-none transition hover:border-ui-primary/40 focus-visible:border-ui-primary focus-visible:ring-2 focus-visible:ring-ui-primary/15 disabled:opacity-50'>
            <span>{selected.label}</span>
            <span aria-hidden='true' className='grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted shadow-sm'>
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </span>
        </button>
        {open && <div id={listboxId} role='listbox' aria-label='Operating systems' className='absolute left-0 right-0 top-full z-30 mt-2 grid max-h-72 overflow-auto rounded-2xl border border-ui-border bg-ui-panel p-2 shadow-2xl shadow-black/35 ring-1 ring-white/10'>
            <p className='px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ui-muted'>Choose an image</p>
            {vmOperatingSystems.map((os, index) => <button key={os.id} ref={element => { options.current[index] = element }} type='button' role='option' aria-selected={value === os.id} tabIndex={-1} onClick={() => { onChange(os.id); setOpen(false); trigger.current?.focus() }} onKeyDown={event => moveFocus(event, index)} className={`group flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ui-primary ${value === os.id ? 'border-ui-primary/30 bg-ui-primary/10' : 'border-transparent text-ui-text hover:border-ui-border hover:bg-ui-raised'}`}>
                <span className='grid gap-0.5'><span className={`text-sm font-medium ${value === os.id ? 'text-ui-primary' : 'text-ui-text'}`}>{os.label}</span><span className='text-xs text-ui-muted'>{os.description}</span></span>
                <span aria-hidden='true' className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${value === os.id ? 'border-ui-primary bg-ui-primary text-ui-on-primary' : 'border-ui-border bg-ui-raised text-transparent group-hover:text-ui-muted'}`}>
                    {value === os.id && <Check className='h-3.5 w-3.5' />}
                </span>
            </button>)}
        </div>}
    </div>
}
