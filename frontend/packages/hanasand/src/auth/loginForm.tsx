'use client'

import { useState, type FormEvent } from 'react'

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
    onAuthenticated?: (session: { id: string; name?: string | null }) => void
}

const field = 'h-12 w-full rounded-xl border border-ui-border bg-ui-canvas px-4 text-[15px] text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
const action = 'inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-ui-border bg-ui-panel px-4 text-[15px] font-medium text-ui-text transition hover:border-ui-primary/50 hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ui-primary/20 disabled:cursor-wait disabled:opacity-60'

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

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setBusy(true)
        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: identifier.trim(), password, redirectPath }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) throw new Error(result?.error || 'Unable to sign in. Please try again.')
            if (result?.id) onAuthenticated?.(result)
            window.location.assign(redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/')
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
            const optionsUrl = new URL(passkeyOptionsUrl, window.location.href)
            if (identifier.trim()) optionsUrl.searchParams.set('username', identifier.trim())
            const optionsResponse = await fetch(optionsUrl, { credentials: 'same-origin', cache: 'no-store' })
            const options = await optionsResponse.json()
            if (!optionsResponse.ok || !options?.publicKey || !options?.challengeId) throw new Error(options?.error || 'Passkey sign-in could not be started.')
            const credential = await navigator.credentials.get({ publicKey: {
                ...options.publicKey,
                challenge: decodeBase64Url(options.publicKey.challenge),
                allowCredentials: options.publicKey.allowCredentials?.map((entry: PublicKeyCredentialDescriptor & { id: string }) => ({ ...entry, id: decodeBase64Url(entry.id) })),
            } }) as PublicKeyCredential | null
            if (!credential) throw new Error('Passkey sign-in was cancelled.')
            const response = credential.response as AuthenticatorAssertionResponse
            const verified = await fetch(passkeyVerifyUrl, {
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
            const result = await verified.json().catch(() => null)
            if (!verified.ok) throw new Error(result?.error || 'Passkey sign-in failed.')
            window.location.assign(redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/')
        } catch (cause) {
            setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Passkey sign-in was cancelled.' : cause instanceof Error ? cause.message : 'Passkey sign-in failed.')
            setBusy(false)
        }
    }

    return <div className='grid gap-5'>
        <form className='grid gap-4' onSubmit={submit}>
            <label className='grid gap-2 text-sm font-medium text-ui-text'>
                {identifierLabel}
                <input className={field} name='username' type='text' autoComplete='username' autoCapitalize='none' spellCheck={false} required placeholder={identifierPlaceholder} value={identifier} onChange={event => setIdentifier(event.target.value)} />
            </label>
            <label className='grid gap-2 text-sm font-medium text-ui-text'>
                Password
                <input className={field} name='password' type='password' autoComplete='current-password' required placeholder='Enter your password' value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error ? <p role='alert' className='rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-ui-text'>{error}</p> : null}
            <button className='inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ui-primary px-4 text-[15px] font-semibold text-ui-on-primary transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ui-primary/25 disabled:cursor-wait disabled:opacity-60' type='submit' disabled={busy}>{busy ? 'Signing in…' : submitLabel}</button>
        </form>
        <div className='grid gap-3'>
            {ssoHref ? <a className={action} href={ssoHref}>Continue with Google</a> : null}
            <button className={action} type='button' onClick={signInWithPasskey} disabled={busy}>Sign in with passkey</button>
        </div>
    </div>
}

function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), char => char.charCodeAt(0))
}

function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
