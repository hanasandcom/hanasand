import { createElement } from 'react'
import { authGhostButtonClass } from './loginMode'

type Props = {
    redirectPath: string
    initialUsername?: string
    hydrated: boolean
    socialError?: string
    ssoHref: string
    onChangeMode(mode: 'signup' | 'request-reset'): void
}

export default function LoginForm({ redirectPath, initialUsername, hydrated, socialError, ssoHref, onChangeMode }: Props) {
    return (
        <div className='grid gap-5'>
            {socialError ? <p role='alert' className='text-sm text-ui-text'>{socialError}</p> : null}
            {createElement('hanasand-login-form', {
                'login-url': '/api/auth/login',
                'passkey-options-url': '/api/auth/passkeys/authenticate/options',
                'passkey-verify-url': '/api/auth/passkeys/authenticate/verify',
                'sso-href': ssoHref,
                'redirect-path': redirectPath,
                'identifier-label': 'Username',
                'identifier-placeholder': 'Username',
                'identifier-value': initialUsername || '',
                'submit-label': 'Log in',
            })}
            <div className='flex flex-wrap items-center gap-2 border-t border-ui-border/70 pt-4'>
                <button type='button' disabled={!hydrated} onClick={() => onChangeMode('signup')} className={authGhostButtonClass}>Sign up</button>
                <button
                    type='button'
                    disabled={!hydrated}
                    onClick={() => onChangeMode('request-reset')}
                    className='ml-auto h-9 rounded-md px-2 text-sm font-medium text-ui-muted transition hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'
                >
                    Reset password
                </button>
            </div>
        </div>
    )
}
