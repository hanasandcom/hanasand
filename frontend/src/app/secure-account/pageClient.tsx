'use client'
import ErrorNotice from '@/components/error/errorNotice'
import AuthActionLayout from '@/components/login/authActionLayout'
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import usePasswordAction from '@/utils/auth/usePasswordAction'

const authPrimaryButtonClass = 'group flex h-10 w-full items-center justify-between rounded-lg bg-ui-text px-3.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authSecondaryLinkClass = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:border-ui-primary hover:text-ui-text'

export default function SecureAccountPage() {
    const [locked, setLocked] = useState(false)
    const { token, tokenLoaded, busy, error, submit } = usePasswordAction('Unable to lock your account.')

    function lockAccount() {
        void submit('/auth/password-reset/lock-account', () => setLocked(true), locked)
    }

    return (
        <AuthActionLayout tagline='Secure your account.'>
            <div className='grid gap-1 px-1'>
                <div className='flex items-center justify-center gap-2 text-ui-text'>
                    <ShieldAlert className='h-4 w-4 text-ui-primary' />
                    <h2 className='text-base font-medium tracking-normal'>{locked ? 'Your account is locked' : 'Wasn’t you? Lock your account.'}</h2>
                </div>
                <p className='text-center text-xs leading-5 text-ui-muted'>
                    {locked
                        ? 'Your sessions have been signed out. Reset your password before signing in again.'
                        : 'This will sign out all devices and block sign-ins until you reset your password.'}
                </p>
            </div>
            <ErrorNotice compact message={error as string | null} />
            {!tokenLoaded ? (
                <p className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-center text-xs text-ui-muted'>Checking security link...</p>
            ) : locked ? (
                <Link href='/login' className={authPrimaryButtonClass}>
                    Go to login
                    <ArrowRight className='h-4 w-4' />
                </Link>
            ) : token ? (
                <button type='button' onClick={lockAccount} disabled={busy} className={authPrimaryButtonClass}>
                    {busy ? 'Locking account...' : 'Lock account'}
                    <ArrowRight className='h-4 w-4' />
                </button>
            ) : (
                <ErrorNotice compact variant='info' message='This security link is missing or expired. Use the reset link in your email or start a reset from login.' />
            )}
            {!locked ? (
                <Link href='/login' className={authSecondaryLinkClass}>
                    <ArrowLeft className='h-4 w-4' />
                    Back to login
                </Link>
            ) : null}
        </AuthActionLayout>
    )
}
