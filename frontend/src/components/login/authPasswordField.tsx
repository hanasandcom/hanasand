import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label?: string
}

export default function AuthPasswordField({ label, ...inputProps }: Props) {
    const input = <input {...inputProps} type='password' />

    if (!label) return input

    return (
        <label className='grid gap-1.5' htmlFor={inputProps.id}>
            <span className='text-xs font-semibold text-ui-muted'>{label}</span>
            {input}
        </label>
    )
}
