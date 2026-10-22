import { forwardRef, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
    label?: string
}

const AuthField = forwardRef<HTMLInputElement, Props>(function AuthField({ label, ...inputProps }, ref) {
    const input = <input {...inputProps} ref={ref} />

    if (!label) return input

    return (
        <label className='grid gap-4' htmlFor={inputProps.id}>
            <span className='text-xs font-semibold text-ui-muted'>{label}</span>
            {input}
        </label>
    )
})

export default AuthField
