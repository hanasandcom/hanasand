import { IdentityLoginForm } from 'hanasand'
import { authGhostButtonClass } from './loginMode'

type Props = {
    redirectPath: string
    initialUsername?: string
    hydrated: boolean
    socialError?: string
    ssoHref: string
    stageLocalAuth?: boolean
    onChangeMode(mode: 'signup' | 'request-reset'): void
}

export default function LoginForm({ redirectPath, initialUsername, hydrated, socialError, ssoHref, stageLocalAuth = false, onChangeMode }: Props) {
    return (
        <div className='grid gap-5' onSubmitCapture={event => { if (!hydrated) event.preventDefault() }} onClickCapture={event => { if (!hydrated) event.preventDefault() }}>
            {socialError ? <p role='alert' className='text-sm text-ui-text'>{socialError}</p> : null}
            <IdentityLoginForm
                loginUrl='/api/auth/login'
                passkeyOptionsUrl={stageLocalAuth ? '' : '/api/auth/passkeys/authenticate/options'}
                passkeyVerifyUrl={stageLocalAuth ? '' : '/api/auth/passkeys/authenticate/verify'}
                ssoHref={ssoHref}
                redirectPath={redirectPath}
                identifierLabel='Email or username'
                identifierPlaceholder='name@hanasand.com'
                identifierValue={initialUsername || ''}
                submitLabel='Sign in'
            />
            {!stageLocalAuth ? <div className='flex flex-wrap items-center gap-2 border-t border-ui-border/70 pt-4'>
                <button type='button' disabled={!hydrated} onClick={() => onChangeMode('signup')} className={authGhostButtonClass}>Sign up</button>
                <button
                    type='button'
                    disabled={!hydrated}
                    onClick={() => onChangeMode('request-reset')}
                    className='ml-auto h-9 rounded-md px-2 text-sm font-medium text-ui-muted transition hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'
                >
                    Reset password
                </button>
            </div> : null}
        </div>
    )
}
