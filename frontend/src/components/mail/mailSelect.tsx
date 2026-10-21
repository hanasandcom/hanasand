'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export type MailSelectOption = { id: string; label: string }

export function MailSelect({
    id,
    label,
    value,
    options,
    onChange,
    className = '',
    compact = false,
}: {
    id?: string
    label: string
    value: string
    options: MailSelectOption[]
    onChange: (value: string) => void
    className?: string
    compact?: boolean
}) {
    const generatedId = useId().replace(/:/g, '')
    const listboxId = `${id || `mail-select-${generatedId}`}-options`
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLDivElement>(null)
    const typeaheadRef = useRef('')
    const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex(option => option.id === value)))
    const selectedOption = options.find(option => option.id === value)
    const activeOption = options[activeIndex]

    useEffect(() => {
        if (!open) return
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
        }
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            setOpen(false)
            triggerRef.current?.focus()
        }
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [open])

    useEffect(() => {
        if (open) setActiveIndex(Math.max(0, options.findIndex(option => option.id === value)))
    }, [open, options, value])

    useEffect(() => {
        if (open) document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex, listboxId, open])

    const selectActiveOption = () => {
        if (!activeOption) return
        onChange(activeOption.id)
        setOpen(false)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!options.length) return
            if (!open) setOpen(true)
            else setActiveIndex(index => Math.min(index + 1, options.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (!options.length) return
            if (!open) setOpen(true)
            else setActiveIndex(index => Math.max(index - 1, 0))
        } else if (event.key === 'Home' && open) {
            event.preventDefault()
            setActiveIndex(0)
        } else if (event.key === 'End' && open) {
            event.preventDefault()
            setActiveIndex(options.length - 1)
        } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault()
            selectActiveOption()
        } else if ((event.key === 'Enter' || event.key === ' ') && !open) {
            event.preventDefault()
            setActiveIndex(Math.max(0, options.findIndex(option => option.id === value)))
            setOpen(true)
        } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const query = `${typeaheadRef.current}${event.key}`.toLocaleLowerCase()
            typeaheadRef.current = query
            if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current)
            typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = '' }, 700)
            const start = open ? activeIndex + 1 : 0
            const match = options.findIndex((option, index) => index >= start && option.label.toLocaleLowerCase().startsWith(query))
            const wrappedMatch = match === -1 ? options.findIndex(option => option.label.toLocaleLowerCase().startsWith(query)) : match
            if (wrappedMatch !== -1) {
                setActiveIndex(wrappedMatch)
                setOpen(true)
            }
        }
    }

    return <div ref={rootRef} className={`relative min-w-0 ${className}`}>
        <div
            ref={triggerRef}
            id={id}
            role='combobox'
            aria-label={label}
            aria-expanded={open}
            aria-haspopup='listbox'
            aria-controls={listboxId}
            aria-activedescendant={open && activeOption ? `${listboxId}-${activeIndex}` : undefined}
            aria-autocomplete='none'
            tabIndex={0}
            onClick={() => {
                if (!open) setActiveIndex(Math.max(0, options.findIndex(option => option.id === value)))
                setOpen(current => !current)
            }}
            onKeyDown={handleKeyDown}
            onBlur={event => {
                if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
            }}
            className={`group flex w-full cursor-pointer select-none items-center gap-2 rounded-lg border border-ui-border bg-ui-raised text-ui-text shadow-sm shadow-ui-canvas/10 outline-none transition-[border-color,background-color,box-shadow] hover:border-ui-primary/50 hover:bg-ui-panel focus-visible:border-ui-primary focus-visible:ring-2 focus-visible:ring-ui-primary/20 ${compact ? 'h-9 p-1.5 text-xs' : 'h-10 p-2 text-sm'}`}
        >
            <span className='min-w-0 flex-1 truncate text-left'>{selectedOption?.label ?? ''}</span>
            <span aria-hidden='true' className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ui-panel/80 text-ui-muted transition-colors group-hover:text-ui-primary'>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </span>
        </div>
        {open ? <div
            id={listboxId}
            role='listbox'
            aria-label={label}
            className='absolute left-0 top-[calc(100%+0.5rem)] z-[70] max-h-72 w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-ui-border bg-ui-raised p-1.5 text-ui-text shadow-xl shadow-black/25 ring-1 ring-black/5'
        >
            {options.map((option, index) => {
                const selected = option.id === value
                const active = index === activeIndex
                return <div
                    key={option.id}
                    id={`${listboxId}-${index}`}
                    role='option'
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                        onChange(option.id)
                        setOpen(false)
                        triggerRef.current?.focus()
                    }}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm transition-colors ${active ? 'bg-ui-primary/10 text-ui-text' : 'text-ui-muted hover:bg-ui-primary/5 hover:text-ui-text'} ${selected ? 'font-medium' : ''}`}
                >
                    <span className='min-w-0 flex-1 truncate'>{option.label}</span>
                    {selected ? <Check aria-hidden='true' className='h-4 w-4 shrink-0 text-ui-primary' /> : null}
                </div>
            })}
        </div> : null}
    </div>
}
