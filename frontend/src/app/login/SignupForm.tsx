import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
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
            <label className='grid gap-1.5' htmlFor='login-signup-username'>
                <span className='text-xs font-semibold text-ui-muted'>Username</span>
                <input
                    id='login-signup-username'
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
            </label>
            {flow.usernameIsReserved && <p className='px-1 text-xs font-semibold text-ui-warning'>Reserved username.</p>}
            <label className='grid gap-1.5' htmlFor='login-signup-name'>
                <span className='text-xs font-semibold text-ui-muted'>Name</span>
                <input
                    id='login-signup-name'
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
            </label>
            <label className='grid gap-1.5' htmlFor='login-signup-email'>
                <span className='text-xs font-semibold text-ui-muted'>Email</span>
                <input
                    id='login-signup-email'
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
            </label>
            <label className='grid gap-1.5' htmlFor='login-signup-password'>
                <span className='text-xs font-semibold text-ui-muted'>Password</span>
                <input
                    id='login-signup-password'
                    disabled={!hydrated}
                    type='password'
                    name='password'
                    value={flow.password}
                    onChange={event => flow.setPassword(event.target.value)}
                    placeholder='Create a strong password'
                    className={authInputClass}
                    autoComplete='new-password'
                    required
                />
            </label>
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
