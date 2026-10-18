import type { ReactNode } from 'react'

type FormFieldProps = {
    label: ReactNode
    children: ReactNode
    className: string
    htmlFor?: string
}

export default function FormField({ label, children, className, htmlFor }: FormFieldProps) {
    if (htmlFor) {
        return <div className={className}><label htmlFor={htmlFor}>{label}</label>{children}</div>
    }

    return <label className={className}>{label}{children}</label>
}
