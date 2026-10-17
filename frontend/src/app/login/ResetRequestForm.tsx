import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import AuthTextField from '@/components/login/authTextField'
import { authGhostButtonClass, authInputClass, authPrimaryButtonClass } from './loginMode'

type Props = {
    busy: boolean
    onSubmit(event: FormEvent<HTMLFormElement>): void
    onBack(): void
}

export default function ResetRequestForm({ busy, onSubmit, onBack }: Props) {
    return (
        <form className='flex w-full flex-col gap-2 self-center' onSubmit={onSubmit} method='post'>
            <AuthTextField
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
                <button type='submit' disabled={busy} className={`${authPrimaryButtonClass} min-w-28`}>
                    {busy ? 'Sending' : 'Send code'}
                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                </button>
                <button type='button' onClick={onBack} className={authGhostButtonClass}>Back</button>
            </div>
        </form>
    )
}
