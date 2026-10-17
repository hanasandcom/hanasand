'use client'
import ErrorNotice from '@/components/error/errorNotice'
import AuthActionLayout from '@/components/login/authActionLayout'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { storePasswordResetSession } from '@/utils/auth/passwordResetSession'
import usePasswordAction from '@/utils/auth/usePasswordAction'

const authPrimaryButtonClass = 'group flex h-10 w-full items-center justify-between rounded-lg bg-ui-text px-3.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authSecondaryLinkClass = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:border-ui-primary hover:text-ui-text'
type ResetActionResponse = { error?: string, id: string, resetToken: string }

export default function ResetPasswordAgainPage() {
    const router = useRouter()
    const { token, tokenLoaded, busy, error, submit } = usePasswordAction('Unable to start a new password reset.')

    function startReset() {
        void submit<ResetActionResponse>('/auth/password-reset/start-again', data => {
            const resetPath = `/reset-password?id=${encodeURIComponent(data.id)}`
            const resetUrl = storePasswordResetSession(data.id, data.resetToken)
                ? resetPath
                : `${resetPath}#token=${encodeURIComponent(data.resetToken)}`
            router.replace(resetUrl)
        })
    }

    return (
        <AuthActionLayout tagline='Update your password.'>
            <div className='grid gap-1 px-1'>
                <div className='flex items-center justify-center gap-2 text-ui-text'>
                    <KeyRound className='h-4 w-4 text-ui-primary' />
                    <h2 className='text-base font-medium tracking-normal'>Reset your password again</h2>
                </div>
                <p className='text-center text-xs leading-5 text-ui-muted'>Start a new reset and choose a different password.</p>
            </div>
            <ErrorNotice compact message={error as string | null} />
            {!tokenLoaded ? (
                <p className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-center text-xs text-ui-muted'>Checking reset link...</p>
            ) : token ? (
                <button type='button' onClick={startReset} disabled={busy} className={authPrimaryButtonClass}>
                    {busy ? 'Preparing reset...' : 'Continue to new password'}
                    <ArrowRight className='h-4 w-4' />
                </button>
            ) : (
                <ErrorNotice compact variant='info' message='This reset link is missing or expired. Request a new code from login.' />
            )}
            <Link href='/login' className={authSecondaryLinkClass}>
                <ArrowLeft className='h-4 w-4' />
                Back to login
            </Link>
        </AuthActionLayout>
    )
}
