import type { FormEvent, RefObject } from 'react'
import { Fingerprint, KeyRound } from 'lucide-react'
import AuthField from '@/components/login/authField'
import AuthSubmitButton from '@/components/login/authSubmitButton'
import SocialSignIn from '@/components/login/socialSignIn'
import { authGhostButtonClass, authInputClass, authPrimaryButtonClass } from './loginMode'

type Props = {
    redirectPath: string
    initialUsername?: string
    usernameRef: RefObject<HTMLInputElement | null>
    hydrated: boolean
    busy: boolean
    socialError?: string
    ssoHref: string
    onSubmit(event: FormEvent<HTMLFormElement>): void
    onChangeMode(mode: 'signup' | 'request-reset'): void
    onPasskeyLogin(): void
}

export default function LoginForm({ redirectPath, initialUsername, usernameRef, hydrated, busy, socialError, ssoHref, onSubmit, onChangeMode, onPasskeyLogin }: Props) {
    return (
        <div className='grid gap-3'>
            <form className='flex w-full flex-col gap-2 self-center' action='/api/auth/login' onSubmit={onSubmit} method='post'>
                <input type='hidden' name='redirectPath' value={redirectPath} />
                <AuthField
                    id='login-username'
                    label='Username'
                    ref={usernameRef}
                    type='text'
                    name='username'
                    placeholder='Username'
                    defaultValue={initialUsername}
                    className={authInputClass}
                    autoComplete='username'
                    required
                />
                <AuthField
                    id='login-password'
                    label='Password'
                    type='password'
                    name='password'
                    placeholder='Enter your password'
                    className={authInputClass}
                    autoComplete='current-password'
                    required
                />
                <div className='mt-1 flex items-center gap-3'>
                    <AuthSubmitButton busy={busy} disabled={!hydrated || busy} pendingLabel='Logging in' className={`${authPrimaryButtonClass} min-w-24`}>Log in</AuthSubmitButton>
                    <button type='button' disabled={!hydrated} onClick={() => onChangeMode('signup')} className={authGhostButtonClass}>Sign up</button>
                    <button
                        type='button'
                        disabled={!hydrated}
                        onClick={() => onChangeMode('request-reset')}
                        className='ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'
                    >
                        Reset password
                    </button>
                </div>
            </form>
            <div className='grid gap-2 border-t border-ui-border pt-3'>
                {socialError && <p role='alert' className='text-sm text-ui-text'>{socialError}</p>}
                <SocialSignIn redirectPath={redirectPath} />
                <button
                    type='button'
                    onClick={onPasskeyLogin}
                    disabled={!hydrated || busy}
                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-4 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:text-ui-muted'
                >
                    <Fingerprint className='h-4 w-4 text-ui-primary' />
                    Sign in with passkey
                </button>
                <a href={ssoHref} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-4 focus:ring-ui-primary/20'>
                    <KeyRound className='h-4 w-4 text-ui-primary' />
                    Continue with SSO
                </a>
            </div>
        </div>
    )
}
