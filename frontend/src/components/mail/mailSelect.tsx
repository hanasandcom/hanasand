'use client'

import { ChevronDown } from 'lucide-react'

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
    return <div className={`relative min-w-0 ${className}`}>
        <select
            id={id}
            aria-label={label}
            value={value}
            onChange={event => onChange(event.target.value)}
            className={`block w-full min-w-0 appearance-none truncate rounded-lg border border-ui-border bg-ui-raised text-ui-text shadow-sm shadow-ui-canvas/10 outline-none transition-colors hover:border-ui-primary/50 focus-visible:border-ui-primary focus-visible:ring-2 focus-visible:ring-ui-primary/20 ${compact ? 'h-9 pl-2.5 pr-9 text-xs' : 'h-10 pl-3 pr-10 text-sm'}`}
        >
            {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <ChevronDown aria-hidden='true' className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
    </div>
}
