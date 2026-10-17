import { useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { passwordMeetsRequirements, passwordRequirementMessage } from '@/utils/auth/password'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import type { LoginMode } from './loginMode'
import { postAuthJson } from './postAuthJson'

type Props = {
    busy: boolean
    setBusy(value: boolean): void
    setError: Dispatch<SetStateAction<string | boolean | null>>
    changeMode(nextMode: LoginMode): void
    setMode(nextMode: LoginMode): void
    redirectPath: string
}

export function useSignupFlow({ busy, setBusy, setError, changeMode, setMode, redirectPath }: Props) {
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [challenge, setChallenge] = useState('')
    const [code, setCode] = useState('')
    const [notice, setNotice] = useState('')
    const [sendError, setSendError] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const passwordIsValid = passwordMeetsRequirements(password)
    const usernameIsReserved = reservedUsernames.includes(username.trim().toLowerCase())
    const canCreateAccount = Boolean(name.trim() && username.trim() && email.trim() && passwordIsValid && !usernameIsReserved)

    async function submitSignup(verificationCode = '', resend = false) {
        if (busy) return
        setSendError('')
        setNotice('')
        setError(null)
        if (!passwordIsValid || usernameIsReserved) {
            setError(usernameIsReserved ? 'This username is reserved.' : passwordRequirementMessage)
            return
        }
        setBusy(true)
        try {
            const response = await postAuthJson('/api/auth/register', {
                id: username,
                name,
                email,
                password,
                ...(!resend && challenge ? { challengeId: challenge, code: verificationCode } : {}),
            })
            const data = await response.json()
            if (!response.ok) {
                if (data.accountCreated) changeMode('login')
                throw new Error(data.error || 'Unable to create account.')
            }
            if (data.verificationRequired) {
                setNotice(challenge ? 'A new code has been sent. Check your inbox and junk folder; use the newest code.' : 'Check junk.')
                setChallenge(data.challengeId)
                setCode('')
                setMode('verify-signup')
                return
            }
            window.location.assign(redirectPath)
        } catch (error) {
            setCode('')
            setSendError(error instanceof Error ? error.message : 'Unable to create account. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        void submitSignup('', true)
    }

    function editDetails() {
        setChallenge('')
        setCode('')
        changeMode('signup')
    }

    return {
        name, setName, username, setUsername, email, setEmail, password, setPassword,
        passwordIsValid, passwordRequirementMessage, usernameIsReserved, canCreateAccount, challenge, code, setCode,
        notice, sendError, submitSignup, handleSubmit, editDetails,
    }
}
