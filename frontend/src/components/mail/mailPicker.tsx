'use client'

import { ChevronDown, Mail } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { MailPickerMenu } from './mailPickerMenu'

export type MailPickerOption = { id: string; label: string; description?: string; badge?: string }

export function mailAccountPickerOptions(accounts: Array<{ id: string; name: string; address: string; shared?: boolean }>): MailPickerOption[] {
    return accounts.map(({ id, name, address, shared }) => {
        const hasDistinctName = Boolean(name && name.toLocaleLowerCase() !== address.toLocaleLowerCase())
        return {
            id,
            label: hasDistinctName ? name : address || name,
            description: hasDistinctName ? address : undefined,
            badge: shared ? 'Shared' : 'Personal',
        }
    })
}

export function MailPicker({
    id,
    label,
    menuTitle,
    value,
    options,
    onChange,
    className = '',
    compact = false,
}: {
    id?: string
    label: string
    menuTitle: string
    value: string
    options: MailPickerOption[]
    onChange: (value: string) => void
    className?: string
    compact?: boolean
}) {
    const generatedId = useId().replace(/:/g, '')
    const listboxId = `${id || `mail-picker-${generatedId}`}-options`
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
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

    useEffect(() => () => {
        if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current)
    }, [])

    const selectActiveOption = () => {
        if (!activeOption) return
        onChange(activeOption.id)
        setOpen(false)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
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
            const match = options.findIndex((option, index) =>
                index >= start && option.label.toLocaleLowerCase().startsWith(query)
            )
            const wrappedMatch = match === -1 ? options.findIndex(option => option.label.toLocaleLowerCase().startsWith(query)) : match
            if (wrappedMatch !== -1) {
                setActiveIndex(wrappedMatch)
                setOpen(true)
            }
        }
    }

    return <div ref={rootRef} className={`relative min-w-0 ${className}`}>
        <button
            type='button'
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
            className={[
                'group flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-ui-border/80',
                'bg-gradient-to-br from-ui-panel to-ui-raised text-ui-text shadow-sm shadow-black/10',
                'outline-none transition-[border-color,background-color,box-shadow] hover:border-ui-primary/45',
                'hover:shadow-md hover:shadow-black/15 focus-visible:border-ui-primary',
                'focus-visible:ring-2 focus-visible:ring-ui-primary/25',
                compact ? 'h-11 p-2 text-xs' : 'h-11 p-2.5 text-sm',
            ].join(' ')}
        >
            <span aria-hidden='true' className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-ui-primary/10 text-ui-primary ring-1 ring-ui-primary/10 ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}>
                <Mail className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </span>
            <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate font-medium leading-5'>{selectedOption?.label ?? 'Select mailbox'}</span>
                {!compact && selectedOption?.description ? <span className='block truncate text-[11px] leading-4 text-ui-muted'>{selectedOption.description}</span> : null}
            </span>
            <span aria-hidden='true' className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-ui-canvas/80 text-ui-muted transition-colors group-hover:bg-ui-primary/10 group-hover:text-ui-primary ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </span>
        </button>
        {open ? <MailPickerMenu
            id={listboxId}
            label={label}
            title={menuTitle}
            value={value}
            options={options}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={optionId => {
                onChange(optionId)
                setOpen(false)
                triggerRef.current?.focus()
            }}
        /> : null}
    </div>
}
