import { useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import config from '@/config'
import { storePasswordResetSession } from '@/utils/auth/passwordResetSession'
import type { LoginMode } from './loginMode'

type Props = {
    busy: boolean
    setBusy(value: boolean): void
    setError: Dispatch<SetStateAction<string | boolean | null>>
    changeMode(nextMode: LoginMode): void
    setMode(nextMode: LoginMode): void
    router: AppRouterInstance
}

export function usePasswordResetFlow({ busy, setBusy, setError, changeMode, setMode, router }: Props) {
    const [userId, setUserId] = useState('')
    const [code, setCode] = useState('')

    async function requestReset(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        const formData = new FormData(event.currentTarget)
        const id = String(formData.get('resetUserId') || '').trim()
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) return setError(data?.error || 'Unable to send reset code.')
            setUserId(id)
            setMode('verify-reset')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to send reset code.')
        } finally {
            setBusy(false)
        }
    }

    async function verifyResetCode(resetCode: string) {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, code: resetCode }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) return setError(data?.error || 'Invalid reset code.')
            const resetPath = `/reset-password?id=${encodeURIComponent(userId)}`
            const resetUrl = storePasswordResetSession(userId, data.resetToken)
                ? resetPath
                : `${resetPath}#token=${encodeURIComponent(data.resetToken)}`
            router.push(resetUrl)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Invalid reset code.')
        } finally {
            setBusy(false)
        }
    }

    async function verifyResetForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (code.length === 6) await verifyResetCode(code)
    }

    function requestAnotherCode() {
        changeMode('request-reset')
    }

    return { userId, code, setCode, requestReset, verifyResetCode, verifyResetForm, requestAnotherCode }
}
