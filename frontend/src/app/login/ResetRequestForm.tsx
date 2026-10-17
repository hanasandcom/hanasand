import type { FormEvent } from 'react'
import AuthField from '@/components/login/authField'
import AuthSubmitButton from '@/components/login/authSubmitButton'
import { authGhostButtonClass, authInputClass, authPrimaryButtonClass } from './loginMode'

type Props = {
    busy: boolean
    onSubmit(event: FormEvent<HTMLFormElement>): void
    onBack(): void
}

export default function ResetRequestForm({ busy, onSubmit, onBack }: Props) {
    return (
        <form className='flex w-full flex-col gap-2 self-center' onSubmit={onSubmit} method='post'>
            <AuthField
                id='login-reset-username'
                label='Username'
                type='text'
                name='resetUserId'
                placeholder='Username'
                className={authInputClass}
                autoComplete='username'
                required
            />
            <div className='mt-1 flex items-center gap-3'>
                <AuthSubmitButton busy={busy} disabled={busy} pendingLabel='Sending' className={`${authPrimaryButtonClass} min-w-28`}>Send code</AuthSubmitButton>
                <button type='button' onClick={onBack} className={authGhostButtonClass}>Back</button>
            </div>
        </form>
    )
}
