'use client'

import { useState, type FormEvent } from 'react'

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
    ssoHref: string
    redirectPath: string
    identifierLabel?: string
    identifierPlaceholder?: string
    identifierValue?: string
    submitLabel?: string
    onAuthenticated?: (session: IdentityAuthenticatedSession) => void
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
            const response = await fetch(requireSameOriginPath(loginUrl), {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: identifier.trim(), password, redirectPath }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) throw new Error(result?.error || 'Unable to sign in. Please try again.')
            if (result?.id) onAuthenticated?.(result)
            window.location.assign(safeRedirectPath(redirectPath))
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.')
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
            const optionsResponse = await fetch(optionsUrl, { credentials: 'same-origin', cache: 'no-store' })
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
            })
            const result = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) throw new Error(result?.error || 'Passkey sign-in failed.')
            if (result?.id && onAuthenticated) onAuthenticated(result)
            window.location.assign(safeRedirectPath(redirectPath))
        } catch (cause) {
            setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Passkey sign-in was cancelled.' : cause instanceof Error ? cause.message : 'Passkey sign-in failed.')
            setBusy(false)
        }
    }

    return <div className='grid gap-4'>
        <form className='hanasand-login-form__fields' onSubmit={handleSubmit}>
            <input type='hidden' name='redirectPath' value={redirectPath} />
            <label className='hanasand-login-form__label'>
                <span>{identifierLabel}</span>
                <input name='username' type='text' autoComplete='username' autoCapitalize='none' spellCheck={false} required placeholder={identifierPlaceholder} value={identifier} onChange={event => setIdentifier(event.target.value)} />
            </label>
            <label className='hanasand-login-form__label'>
                <span>Password</span>
                <input name='password' type='password' autoComplete='current-password' placeholder='Enter your password' required value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error ? <p className='hanasand-login-form__error' role='alert' aria-live='polite'>{error}</p> : null}
            <button className='hanasand-login-form__submit' type='submit' disabled={busy}>{busy ? 'Signing in…' : submitLabel}</button>
        </form>
        <div className='hanasand-login-form__providers'>
            {ssoHref && isSameOriginPath(ssoHref) ? <a className='hanasand-login-form__provider' href={ssoHref}>Continue with Google</a> : null}
            {isSameOriginPath(passkeyOptionsUrl) && isSameOriginPath(passkeyVerifyUrl) ? <button className='hanasand-login-form__provider' type='button' onClick={() => void signInWithPasskey()} disabled={busy}>Sign in with passkey</button> : null}
        </div>
    </div>
}

function isSameOriginPath(value: string) {
    if (!value.startsWith('/') || value.startsWith('//')) return false
    if (typeof window === 'undefined') return true
    try {
        const url = new URL(value, window.location.href)
        return url.origin === window.location.origin && url.pathname.startsWith('/') && !url.pathname.startsWith('//')
    } catch {
        return false
    }
}

function requireSameOriginPath(value: string) {
    if (!value.startsWith('/') || value.startsWith('//')) throw new Error('Sign-in route must stay on this site.')
    return value
}

function safeRedirectPath(value: string) {
    return value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0))
}

function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
