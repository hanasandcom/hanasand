'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export type VmPickerOption = { id: string; label: string; description?: string }

export default function VmOptionPicker({ value, onChange, disabled, label, menuLabel, promptLabel, options, description }: {
    value: string
    onChange: (value: string) => void
    disabled: boolean
    label: string
    menuLabel: string
    promptLabel?: string
    options: ReadonlyArray<VmPickerOption>
    description?: (option: VmPickerOption) => string
}) {
    const root = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
    const listboxId = useId()
    const [open, setOpen] = useState(false)
    const selected = options.find(option => option.id === value) || options[0]

    useEffect(() => {
        if (!open) return
        const closeOutside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('pointerdown', closeOutside)
        return () => document.removeEventListener('pointerdown', closeOutside)
    }, [open])

    useEffect(() => {
        if (open) optionRefs.current[options.findIndex(option => option.id === value)]?.focus()
    }, [open, options, value])

    function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
        const next = event.key === 'ArrowDown' ? (index + 1) % options.length
            : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length
                : event.key === 'Home' ? 0
                    : event.key === 'End' ? options.length - 1 : -1
        if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
        if (next >= 0) { event.preventDefault(); optionRefs.current[next]?.focus() }
    }

    return <div ref={root} className='relative grid min-w-0 gap-1 text-sm text-ui-muted'>
        <span>{label}</span>
        <button ref={trigger} type='button' role='combobox' aria-label={label} aria-haspopup='listbox' aria-expanded={open} aria-controls={listboxId} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
            else if (event.key === 'Escape') setOpen(false)
        }} className='flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-ui-border bg-ui-raised pl-3 pr-4 text-left text-sm text-ui-text outline-none transition hover:border-ui-primary/40 focus-visible:border-ui-primary focus-visible:ring-2 focus-visible:ring-ui-primary/15 disabled:opacity-50'>
            <span className='truncate'>{selected?.label}</span>
            <ChevronDown aria-hidden='true' className={`h-4 w-4 shrink-0 text-ui-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div id={listboxId} role='listbox' aria-label={menuLabel} className='absolute left-0 right-0 top-full z-30 mt-2 grid max-h-72 overflow-auto rounded-2xl border border-ui-border bg-ui-panel p-2 shadow-2xl shadow-black/35 ring-1 ring-white/10'>
            <p className='px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ui-muted'>{promptLabel || `Choose ${menuLabel.toLowerCase()}`}</p>
            {options.map((option, index) => <button key={option.id} ref={element => { optionRefs.current[index] = element }} type='button' role='option' aria-selected={value === option.id} tabIndex={-1} onClick={() => { onChange(option.id); setOpen(false); trigger.current?.focus() }} onKeyDown={event => moveFocus(event, index)} className={`group flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ui-primary ${value === option.id ? 'border-ui-primary/30 bg-ui-primary/10' : 'border-transparent text-ui-text hover:border-ui-border hover:bg-ui-raised'}`}>
                <span className='grid gap-0.5'><span className={`text-sm font-medium ${value === option.id ? 'text-ui-primary' : 'text-ui-text'}`}>{option.label}</span><span className='text-xs text-ui-muted'>{description?.(option) ?? option.description}</span></span>
                <span aria-hidden='true' className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${value === option.id ? 'border-ui-primary bg-ui-primary text-ui-on-primary' : 'border-ui-border bg-ui-raised text-transparent group-hover:text-ui-muted'}`}>
                    {value === option.id && <Check className='h-3.5 w-3.5' />}
                </span>
            </button>)}
        </div>}
    </div>
}
