'use client'

import { createElement, useEffect, useRef, type FormEvent } from 'react'
import { registerHanasandLoginForm } from './loginForm.js'

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
    const element = useRef<HTMLElement | null>(null)

    useEffect(() => {
        registerHanasandLoginForm()
        const current = element.current
        if (!current || !onAuthenticated) return
        const handleAuthenticated = (event: Event) => {
            const customEvent = event as CustomEvent<IdentityAuthenticatedSession>
            event.preventDefault()
            onAuthenticated(customEvent.detail)
        }
        current.addEventListener('hanasand-authenticated', handleAuthenticated)
        return () => current.removeEventListener('hanasand-authenticated', handleAuthenticated)
    }, [onAuthenticated])

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        if (!loginUrl.startsWith('/') || loginUrl.startsWith('//')) event.preventDefault()
    }

    return createElement('form', { action: loginUrl, method: 'post', className: 'grid gap-4', onSubmit: handleSubmit },
        createElement('input', { type: 'hidden', name: 'redirectPath', value: redirectPath }),
        createElement('hanasand-login-form', {
            ref: element,
            'passkey-options-url': passkeyOptionsUrl,
            'passkey-verify-url': passkeyVerifyUrl,
            'sso-href': ssoHref,
            'redirect-path': redirectPath,
            'identifier-label': identifierLabel,
            'identifier-placeholder': identifierPlaceholder,
            'identifier-value': identifierValue,
            'submit-label': submitLabel,
        }),
    )
}
