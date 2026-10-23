'use client'

import { useState, type FormEvent } from 'react'
import { decodeBase64Url, encodeBase64Url, getSignInError, isSameOriginPath, requireSameOriginPath, safeRedirectPath } from './identityLoginUtils.js'

export type IdentityAuthenticatedSession = {
    token?: string
    id: string
    name?: string | null
    avatar?: string | null
    expires_at?: number | null
}

export type IdentityLoginFormProps = {
    loginUrl: string
    passkeyOptionsUrl: string
    passkeyVerifyUrl: string
    ssoHref?: string
    redirectPath: string
    identifierLabel?: string
    identifierPlaceholder?: string
    identifierValue?: string
    submitLabel?: string
    identifierField?: 'id' | 'username'
    ssoStartUrl?: string
    onAuthenticated?: (session: IdentityAuthenticatedSession) => void | Promise<void>
}

export function IdentityLoginForm({
    loginUrl,
    passkeyOptionsUrl,
    passkeyVerifyUrl,
    ssoHref,
    redirectPath,
    identifierLabel = 'Email or username',
    identifierPlaceholder = 'name@hanasand.com',
    identifierValue = '',
    submitLabel = 'Sign in',
    identifierField = 'id',
    ssoStartUrl,
    onAuthenticated,
}: IdentityLoginFormProps) {
    const [identifier, setIdentifier] = useState(identifierValue)
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setBusy(true)
        try {
            const identity = { [identifierField]: identifier.trim() }
            const response = await fetch(requireSameOriginPath(loginUrl), {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...identity, password, redirectPath }),
                signal: AbortSignal.timeout(15_000),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) throw new Error(result?.error || 'Unable to sign in. Please try again.')
            if (onAuthenticated) {
                if (typeof result?.id !== 'string' || typeof result?.token !== 'string') {
                    throw new Error('Sign-in could not be completed.')
                }
                await onAuthenticated(result)
            }
            window.location.assign(safeRedirectPath(redirectPath))
        } catch (cause) {
            setError(getSignInError(cause, 'Unable to sign in. Please try again.'))
            setBusy(false)
        }
    }

    async function signInWithPasskey() {
        setBusy(true)
        setError('')
        try {
            if (!navigator.credentials?.get || !window.PublicKeyCredential) throw new Error('Passkeys are not available in this browser.')
            const optionsUrl = new URL(requireSameOriginPath(passkeyOptionsUrl), window.location.href)
            if (identifier.trim()) optionsUrl.searchParams.set('username', identifier.trim())
            const optionsResponse = await fetch(optionsUrl, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
            const options = await optionsResponse.json()
            if (!optionsResponse.ok || !options?.publicKey || !options?.challengeId) throw new Error(options?.error || 'Passkey sign-in could not be started.')
            const publicKey = {
                ...options.publicKey,
                challenge: decodeBase64Url(options.publicKey.challenge),
                allowCredentials: options.publicKey.allowCredentials?.map((entry: PublicKeyCredentialDescriptor & { id: string }) => ({ ...entry, id: decodeBase64Url(entry.id) })),
            }
            const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null
            if (!credential) throw new Error('Passkey sign-in was cancelled.')
            const response = credential.response as AuthenticatorAssertionResponse
            const verifyResponse = await fetch(requireSameOriginPath(passkeyVerifyUrl), {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId: options.challengeId, credential: {
                    id: credential.id, rawId: encodeBase64Url(credential.rawId), type: credential.type,
                    response: {
                        clientDataJSON: encodeBase64Url(response.clientDataJSON),
                        authenticatorData: encodeBase64Url(response.authenticatorData),
                        signature: encodeBase64Url(response.signature),
                        userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : null,
                    },
                } }),
                signal: AbortSignal.timeout(15_000),
            })
            const result = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) throw new Error(result?.error || 'Passkey sign-in failed.')
            if (onAuthenticated) {
                if (typeof result?.id !== 'string' || typeof result?.token !== 'string') {
                    throw new Error('Sign-in could not be completed.')
                }
                await onAuthenticated(result)
            }
            window.location.assign(safeRedirectPath(redirectPath))
        } catch (cause) {
            setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Passkey sign-in was cancelled.' : getSignInError(cause, 'Passkey sign-in failed.'))
            setBusy(false)
        }
    }

    async function startSso() {
        if (!ssoStartUrl) return
        setBusy(true)
        setError('')
        try {
            const bytes = crypto.getRandomValues(new Uint8Array(32))
            const binding = encodeBase64Url(bytes.buffer)
            const returnTo = new URL(redirectPath, window.location.href).searchParams.get('returnTo') || '/dashboard'
            const response = await fetch(requireSameOriginPath(ssoStartUrl), {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ binding, redirectPath: returnTo }),
                signal: AbortSignal.timeout(15_000),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok || typeof result?.url !== 'string') {
                throw new Error(result?.error || 'Google sign-in is unavailable.')
            }
            window.location.assign(result.url)
        } catch (cause) {
            setError(getSignInError(cause, 'Google sign-in is unavailable.'))
            setBusy(false)
        }
    }

    return <div className='hanasand-login-form'>
        <form className='hanasand-login-form__fields' onSubmit={handleSubmit}>
            <input type='hidden' name='redirectPath' value={redirectPath} />
            <label className='hanasand-login-form__label'>
                <span>{identifierLabel}</span>
                <input name={identifierField} type='text' autoComplete='username' autoCapitalize='none' spellCheck={false} required placeholder={identifierPlaceholder} value={identifier} onChange={event => setIdentifier(event.target.value)} />
            </label>
            <label className='hanasand-login-form__label'>
                <span>Password</span>
                <input name='password' type='password' autoComplete='current-password' placeholder='Enter your password' required value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error ? <p className='hanasand-login-form__error' role='alert' aria-live='polite'>{error}</p> : null}
            <button className='hanasand-login-form__submit' type='submit' disabled={busy}>{busy ? 'Signing in…' : submitLabel}</button>
        </form>
        <div className='hanasand-login-form__providers'>
            {ssoStartUrl && isSameOriginPath(ssoStartUrl)
                ? <button className='hanasand-login-form__provider' type='button' onClick={() => void startSso()} disabled={busy}>Continue with Google</button>
                : ssoHref && isSameOriginPath(ssoHref)
                    ? <a className='hanasand-login-form__provider' href={ssoHref}>Continue with Google</a>
                    : null}
            {isSameOriginPath(passkeyOptionsUrl) && isSameOriginPath(passkeyVerifyUrl) ? <button className='hanasand-login-form__provider' type='button' onClick={() => void signInWithPasskey()} disabled={busy}>Sign in with passkey</button> : null}
        </div>
    </div>
}
