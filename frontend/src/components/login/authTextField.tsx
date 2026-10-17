import { forwardRef, type InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
    label: string
}

const AuthTextField = forwardRef<HTMLInputElement, Props>(function AuthTextField({ label, ...inputProps }, ref) {
    return (
        <label className='grid gap-1.5' htmlFor={inputProps.id}>
            <span className='text-xs font-semibold text-ui-muted'>{label}</span>
            <input {...inputProps} ref={ref} />
        </label>
    )
})

export default AuthTextField
