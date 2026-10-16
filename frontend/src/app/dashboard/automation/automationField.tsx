import type { ReactNode } from 'react'

type Props = {
    label: string
    children: ReactNode
    error?: string
    className?: string
    labelClassName?: string
}

export default function AutomationField({ label, children, error, className = '', labelClassName = 'text-xs font-semibold text-ui-muted' }: Props) {
    return <label className={`grid gap-1.5 ${className}`}>
        <span className={labelClassName}>{label}</span>
        {children}
        {error && <span className='text-sm text-ui-text'>{error}</span>}
    </label>
}
