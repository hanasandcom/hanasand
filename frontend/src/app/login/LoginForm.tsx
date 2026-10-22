import { createElement, useEffect, useRef, type FormEvent, type RefObject } from 'react'
import { Fingerprint, KeyRound } from 'lucide-react'
import SocialSignIn from '@/components/login/socialSignIn'
import { authGhostButtonClass } from './loginMode'

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
    const sharedFormRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        void customElements.whenDefined('hanasand-login-form').then(() => {
            const input = sharedFormRef.current?.querySelector<HTMLInputElement>('input[name="username"]')
            if (input) usernameRef.current = input
        })
    }, [usernameRef])

    function submit(event: FormEvent<HTMLFormElement>) {
        const sharedForm = sharedFormRef.current as (HTMLElement & { setBusy(busy: boolean): void }) | null
        sharedForm?.setBusy(true)
        onSubmit(event)
    }

    return (
        <div className='grid gap-3'>
            <form className='flex w-full flex-col gap-4 self-center' action='/api/auth/login' onSubmit={submit} method='post'>
                <input type='hidden' name='redirectPath' value={redirectPath} />
                {createElement('hanasand-login-form', {
                    ref: sharedFormRef,
                    'identifier-label': 'Username',
                    'identifier-placeholder': 'Username',
                    'identifier-value': initialUsername || '',
                    'submit-label': 'Log in',
                })}
                <div className='mt-1 flex items-center gap-3'>
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
