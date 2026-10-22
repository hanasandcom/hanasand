'use client'

import { createElement, useEffect, useRef, useState, type FormEvent } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { decodePasskeyRequestOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'
import { browserApiBase, identityApiBase } from './browser/browserSetup'

type IdentitySession = { id?: string; name?: string; token?: string; expires_at?: string; error?: string }

export default function LoginForm() {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        if (!code || !state) return
        const binding = sessionStorage.getItem('browser-identity-sso-binding') || ''
        if (!binding) {
            setError('This sign-in link expired. Start again.')
            return
        }
        setBusy(true)
        void fetch(`${identityApiBase}/auth/sso/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state, binding }),
            cache: 'no-store',
        }).then(async response => {
            const data = await response.json() as IdentitySession
            if (!response.ok || !data.id || !data.token || !data.expires_at) throw new Error(data.error || 'SSO sign in failed.')
            return establishBrowserSession(data)
        }).then(() => {
            sessionStorage.removeItem('browser-identity-sso-binding')
            router.replace('/sandbox')
            router.refresh()
        }).catch(cause => setError(cause instanceof Error ? cause.message : 'Identity service is unavailable.'))
            .finally(() => setBusy(false))
    }, [router])

    async function establishBrowserSession(identity: IdentitySession) {
        const exchange = await fetch(`${browserApiBase}/browser/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: identity.id, token: identity.token }),
            cache: 'no-store',
        })
        const session = await exchange.json() as { error?: string }
        if (!exchange.ok) throw new Error(session.error || 'Could not establish a Browser session.')
    }

    function showError(message: string) {
        setError(message)
        const notice = formRef.current?.querySelector<HTMLElement>('.error')
        if (notice) {
            notice.textContent = message
            notice.hidden = false
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        const fields = new FormData(event.currentTarget)
        const username = String(fields.get('username') || '').trim()
        const password = String(fields.get('password') || '')
        setBusy(true)
        setError('')
        try {
            const response = await fetch(`${identityApiBase}/auth/login/${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
                cache: 'no-store',
            })
            const data = await response.json() as IdentitySession
            if (!response.ok || !data.id || !data.token || !data.expires_at) throw new Error(data.error || 'Unable to sign in.')
            await establishBrowserSession(data)
            router.replace('/sandbox')
            router.refresh()
        } catch (cause) {
            showError(cause instanceof Error ? cause.message : 'Identity service is unavailable.')
        } finally {
            setBusy(false)
        }
    }

    async function signInWithPasskey() {
        if (!window.PublicKeyCredential || !navigator.credentials) return showError('This browser does not support passkeys.')
        setBusy(true)
        setError('')
        try {
            const username = String(new FormData(formRef.current || undefined).get('username') || '').trim()
            const optionsUrl = new URL(`${identityApiBase}/auth/passkeys/authenticate/options`)
            if (username) optionsUrl.searchParams.set('username', username)
            const optionsResponse = await fetch(optionsUrl, { cache: 'no-store' })
            const options = await optionsResponse.json() as { challengeId?: string; publicKey?: Record<string, unknown>; error?: string }
            if (!optionsResponse.ok || !options.challengeId || !options.publicKey) throw new Error(options.error || 'No passkey challenge is available.')
            const credential = await navigator.credentials.get({ publicKey: decodePasskeyRequestOptions(options.publicKey) }) as PublicKeyCredential | null
            if (!credential) throw new Error('No passkey was selected.')
            const verify = await fetch(`${identityApiBase}/auth/passkeys/authenticate/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeId: options.challengeId, credential: passkeyCredentialToJSON(credential) }),
                cache: 'no-store',
            })
            const session = await verify.json() as IdentitySession
            if (!verify.ok || !session.id || !session.token || !session.expires_at) throw new Error(session.error || 'Passkey sign in failed.')
            await establishBrowserSession(session)
            router.replace('/sandbox')
            router.refresh()
        } catch (cause) {
            showError(cause instanceof Error ? cause.message : 'Passkey sign in failed.')
        } finally {
            setBusy(false)
        }
    }

    async function startSso() {
        setBusy(true)
        setError('')
        try {
            const bytes = crypto.getRandomValues(new Uint8Array(32))
            const binding = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
            const response = await fetch(`${identityApiBase}/auth/sso/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ binding, redirectPath: '/sandbox/login' }),
                cache: 'no-store',
            })
            const data = await response.json() as { url?: string; error?: string }
            if (!response.ok || !data.url) throw new Error(data.error || 'SSO sign in is unavailable.')
            sessionStorage.setItem('browser-identity-sso-binding', binding)
            window.location.assign(data.url)
        } catch (cause) {
            showError(cause instanceof Error ? cause.message : 'Identity service is unavailable.')
            setBusy(false)
        }
    }

    return <div className='mt-6 grid gap-3'>
        <Script src={`${identityApiBase}/auth/login-form.js`} strategy='afterInteractive' />
        {error ? <p role='alert' className='rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200'>{error}</p> : null}
        <form ref={formRef} onSubmit={event => void submit(event)} className='grid gap-3'>
            {createElement('hanasand-login-form', {
                'identifier-label': 'Username or email',
                'identifier-placeholder': 'Username or email',
                'submit-label': 'Sign in',
            })}
        </form>
        <button type='button' onClick={() => void signInWithPasskey()} disabled={busy} className='h-11 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised disabled:opacity-50'>
            Sign in with a passkey
        </button>
        <button type='button' onClick={() => void startSso()} disabled={busy} className='h-11 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised disabled:opacity-50'>
            Continue with Google
        </button>
        {busy ? <p role='status' className='text-sm text-ui-muted'>Signing in…</p> : null}
    </div>
}
