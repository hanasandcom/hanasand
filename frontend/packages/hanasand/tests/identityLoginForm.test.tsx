// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IdentityLoginForm } from '../src/auth/identityLoginForm'

test('shared Identity login renders credentials and providers in server HTML', () => {
    const html = renderToStaticMarkup(createElement(IdentityLoginForm, {
        loginUrl: '/api/auth/login',
        passkeyOptionsUrl: '/api/auth/passkeys/authenticate/options',
        passkeyVerifyUrl: '/api/auth/passkeys/authenticate/verify',
        ssoStartUrl: '/api/auth/sso/start',
        redirectPath: '/dashboard',
        identifierField: 'username',
    }))

    expect(html).toContain('name="username"')
    expect(html).toContain('name="password"')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('Sign in with passkey')
    expect(html).not.toContain('<hanasand-login-form')
    expect(html).not.toContain('name="id"')
})

test('shared Identity login preserves the legacy id field by default', () => {
    const html = renderToStaticMarkup(createElement(IdentityLoginForm, {
        loginUrl: '/api/auth/login',
        passkeyOptionsUrl: '/api/auth/passkeys/authenticate/options',
        passkeyVerifyUrl: '/api/auth/passkeys/authenticate/verify',
        redirectPath: '/dashboard',
    }))

    expect(html).toContain('name="id"')
})
