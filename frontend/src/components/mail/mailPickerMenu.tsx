'use client'

import { Check, Mail } from 'lucide-react'
import type { MailPickerOption } from './mailPicker'

export function MailPickerMenu({
    id,
    label,
    title,
    value,
    options,
    activeIndex,
    onActiveIndexChange,
    onSelect,
}: {
    id: string
    label: string
    title: string
    value: string
    options: MailPickerOption[]
    activeIndex: number
    onActiveIndexChange: (index: number) => void
    onSelect: (id: string) => void
}) {
    return <div
        id={id}
        role='listbox'
        aria-label={label}
        className={[
            'absolute left-auto right-0 top-[calc(100%+0.5rem)] z-[70] max-h-[min(60dvh,24rem)]',
            'w-[min(22rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-2xl',
            'border border-ui-border/80 bg-ui-panel/98 p-1.5 text-ui-text shadow-2xl shadow-black/35',
            'ring-1 ring-white/5 backdrop-blur-xl lg:left-0 lg:right-auto',
        ].join(' ')}
    >
        <div className='flex items-center justify-between gap-3 border-b border-ui-border/70 px-3 py-2.5'>
            <span className='text-xs font-semibold tracking-wide text-ui-text'>{title}</span>
            <span className='rounded-full border border-ui-border/70 bg-ui-raised px-2 py-0.5 text-[10px] font-medium tabular-nums text-ui-muted'>
                {options.length}
            </span>
        </div>
        {options.map((option, index) => {
            const selected = option.id === value
            const active = index === activeIndex
            return <div
                key={option.id}
                id={`${id}-${index}`}
                role='option'
                aria-selected={selected}
                onMouseEnter={() => onActiveIndexChange(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => onSelect(option.id)}
                className={[
                    'flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm',
                    'transition-[background-color,color,box-shadow] duration-150',
                    active ? 'bg-ui-raised text-ui-text' : 'text-ui-muted hover:bg-ui-raised/75 hover:text-ui-text',
                    selected ? 'font-medium shadow-sm ring-1 ring-inset ring-ui-primary/25' : '',
                ].join(' ')}
            >
                <span aria-hidden='true' className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-ui-primary/12 text-ui-primary' : 'bg-ui-canvas text-ui-muted'}`}>
                    <Mail className='h-4 w-4' />
                </span>
                <span className='grid min-w-0 flex-1 gap-0.5'>
                    <span className='truncate'>{option.label}</span>
                    {option.description ? <span className='truncate text-[11px] font-normal text-ui-muted'>{option.description}</span> : null}
                </span>
                {option.badge ? <span className='rounded-full border border-ui-border/70 bg-ui-canvas/75 px-2 py-0.5 text-[10px] font-medium text-ui-muted'>
                    {option.badge}
                </span> : null}
                {selected ? <span aria-hidden='true' className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-primary/12 text-ui-primary'>
                    <Check className='h-3.5 w-3.5' />
                </span> : null}
            </div>
        })}
    </div>
}
