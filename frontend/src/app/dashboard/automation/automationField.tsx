import type { ReactNode } from 'react'

type Props = {
    label: string
    children: ReactNode
    error?: string
    className?: string
    fieldClassName?: string
    labelClassName?: string
}

export default function AutomationField({ label, children, error, className = '', fieldClassName = 'grid gap-1.5', labelClassName = 'text-xs font-semibold text-ui-muted' }: Props) {
    return <label className={`${fieldClassName} ${className}`}>
        <span className={labelClassName}>{label}</span>
        {children}
        {error && <span className='text-sm text-ui-text'>{error}</span>}
    </label>
}
