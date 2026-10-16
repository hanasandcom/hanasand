'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ErrorNotice from '@/components/error/errorNotice'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import LoginForm from './LoginForm'
import ResetRequestForm from './ResetRequestForm'
import ResetVerificationForm from './ResetVerificationForm'
import SignupForm from './SignupForm'
import SignupVerification from './SignupVerification'
import { LoginMode, LoginPageProps, safeRedirectPath } from './loginMode'
import { usePasskeyLogin } from './usePasskeyLogin'
import { usePasswordResetFlow } from './usePasswordResetFlow'
import { useSignupFlow } from './useSignupFlow'

export default function LoginPage({
    path,
    serverInternal,
    serverExpired,
    socialError,
    initialMode = 'login',
    serverError,
    initialUsername,
}: LoginPageProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [mode, setMode] = useState<LoginMode>(initialMode)
    const [busy, setBusy] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const loginUsernameRef = useRef<HTMLInputElement>(null)
    const { condition: error, setCondition: setError } = useClearStateAfter({ initialState: serverError })
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const { condition: expired } = useClearStateAfter({ initialState: serverExpired, timeout: 8000 })
    const redirectPath = safeRedirectPath(path)
    const ssoHref = `/api/auth/sso/start?redirectPath=${encodeURIComponent(redirectPath)}`

    function changeMode(nextMode: LoginMode) {
        setError(null)
        if (nextMode !== 'verify-reset') reset.setCode('')
        if (nextMode === 'signup' || nextMode === 'login') {
            const target = nextMode === 'signup' ? '/signup' : '/login'
            if (pathname !== target) {
                router.push(`${target}?path=${encodeURIComponent(redirectPath)}`)
                return
            }
        }
        setMode(nextMode)
    }

    const signup = useSignupFlow({ busy, setBusy, setError, changeMode, setMode, redirectPath })
    const reset = usePasswordResetFlow({ busy, setBusy, setError, changeMode, setMode, router })
    const handlePasskeyLogin = usePasskeyLogin({
        usernameRef: loginUsernameRef,
        setBusy,
        setError,
        redirectPath,
        router,
    })

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id && !serverInternal && !serverExpired && !socialError) router.push(redirectPath)
        setHydrated(true)
    }, [redirectPath, router, serverExpired, serverInternal, socialError])

    function handleLoginSubmit() {
        setBusy(true)
    }

    return (
        <section className='grid min-h-app-viewport w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-98 gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='text-[42px] font-semibold leading-none tracking-normal text-ui-primary'>Hanasand</h1>
                </div>
                <div className='grid w-full gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-lg'>
                    {expired && path ? (
                        <ErrorNotice
                            variant='info'
                            message={`Token expired. You will be redirected back to ${path} after reauthenticating.`}
                        />
                    ) : null}
                    {internal && path ? (
                        <ErrorNotice variant='info' message={`Sign in to continue to ${path}.`} />
                    ) : null}
                    <Notify message={error as string | null} />
                    {mode === 'login' ? (
                        <LoginForm
                            redirectPath={redirectPath}
                            initialUsername={initialUsername}
                            usernameRef={loginUsernameRef}
                            hydrated={hydrated}
                            busy={busy}
                            socialError={socialError}
                            ssoHref={ssoHref}
                            onSubmit={handleLoginSubmit}
                            onChangeMode={changeMode}
                            onPasskeyLogin={handlePasskeyLogin}
                        />
                    ) : null}
                    {mode === 'signup' ? (
                        <SignupForm
                            flow={signup}
                            busy={busy}
                            hydrated={hydrated}
                            redirectPath={redirectPath}
                            onSubmit={signup.handleSubmit}
                            onBackToLogin={() => changeMode('login')}
                        />
                    ) : null}
                    {mode === 'verify-signup' ? <SignupVerification flow={signup} busy={busy} /> : null}
                    {mode === 'request-reset' ? (
                        <ResetRequestForm busy={busy} onSubmit={reset.requestReset} onBack={() => changeMode('login')} />
                    ) : null}
                    {mode === 'verify-reset' ? (
                        <ResetVerificationForm
                            code={reset.code}
                            setCode={reset.setCode}
                            busy={busy}
                            onSubmit={reset.verifyResetForm}
                            onVerify={reset.verifyResetCode}
                            onRequestAnother={reset.requestAnotherCode}
                        />
                    ) : null}
                </div>
            </div>
        </section>
    )
}
