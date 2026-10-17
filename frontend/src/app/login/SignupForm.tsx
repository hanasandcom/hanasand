import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import AuthField from '@/components/login/authField'
import { authGhostButtonClass, authInputClass, authPrimaryButtonClass } from './loginMode'
import type { useSignupFlow } from './useSignupFlow'

type SignupFlow = ReturnType<typeof useSignupFlow>

type Props = {
    flow: SignupFlow
    busy: boolean
    hydrated: boolean
    redirectPath: string
    onSubmit(event: FormEvent<HTMLFormElement>): void
    onBackToLogin(): void
}

export default function SignupForm({ flow, busy, hydrated, redirectPath, onSubmit, onBackToLogin }: Props) {
    return (
        <form className='flex w-full flex-col gap-2 self-center' action='/api/auth/register' onSubmit={onSubmit} method='post'>
            <input type='hidden' name='redirectPath' value={redirectPath} />
            {flow.sendError && <p role='alert' className='text-sm text-ui-text'>{flow.sendError}</p>}
            <AuthField
                id='login-signup-username'
                label='Username'
                disabled={!hydrated}
                type='text'
                name='username'
                value={flow.username}
                onChange={event => flow.setUsername(event.target.value)}
                placeholder='Username'
                className={authInputClass}
                autoComplete='username'
                required
            />
            {flow.usernameIsReserved && <p className='px-1 text-xs font-semibold text-ui-warning'>Reserved username.</p>}
            <AuthField
                id='login-signup-name'
                label='Name'
                disabled={!hydrated}
                type='text'
                name='name'
                value={flow.name}
                onChange={event => flow.setName(event.target.value)}
                placeholder='Full name'
                className={authInputClass}
                autoComplete='name'
                required
            />
            <AuthField
                id='login-signup-email'
                label='Email'
                disabled={!hydrated}
                type='email'
                name='email'
                placeholder='example@mail.com'
                value={flow.email}
                onChange={event => flow.setEmail(event.target.value)}
                autoComplete='email'
                maxLength={254}
                className={authInputClass}
                required
            />
            <AuthField
                id='login-signup-password'
                label='Password'
                type='password'
                disabled={!hydrated}
                name='password'
                value={flow.password}
                onChange={event => flow.setPassword(event.target.value)}
                placeholder='Create a strong password'
                className={authInputClass}
                autoComplete='new-password'
                required
            />
            {flow.password && !flow.passwordIsValid ? (
                <p className='px-1 text-xs leading-5 text-ui-muted'>
                    {flow.passwordRequirementMessage}
                </p>
            ) : null}
            <div className='mt-1 flex items-center gap-3'>
                <button type='submit' disabled={!hydrated || busy || !flow.canCreateAccount} className={`${authPrimaryButtonClass} min-w-36`}>
                    {busy ? 'Sending code' : 'Create account'}
                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                </button>
                <button type='button' onClick={onBackToLogin} className={authGhostButtonClass}>Log in</button>
            </div>
        </form>
    )
}
