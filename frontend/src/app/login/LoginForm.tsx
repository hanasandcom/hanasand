import { IdentityLoginForm } from 'hanasand'
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
            <IdentityLoginForm
                loginUrl='/api/auth/login'
                passkeyOptionsUrl='/api/auth/passkeys/authenticate/options'
                passkeyVerifyUrl='/api/auth/passkeys/authenticate/verify'
                ssoHref={ssoHref}
                redirectPath={redirectPath}
                identifierLabel='Username'
                identifierPlaceholder='Username'
                identifierValue={initialUsername || ''}
                submitLabel='Log in'
            />
            <div className='flex items-center gap-3'>
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
