// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IdentityLoginForm } from '../src/auth/loginForm'

test('shared login controls are present in server-rendered HTML', () => {
    const html = renderToStaticMarkup(createElement(IdentityLoginForm, {
        loginUrl: '/api/auth/login',
        passkeyOptionsUrl: '/api/auth/passkeys/authenticate/options',
        passkeyVerifyUrl: '/api/auth/passkeys/authenticate/verify',
        ssoHref: '/api/auth/sso/start',
        redirectPath: '/dashboard',
    }))

    expect(html).toContain('name="username"')
    expect(html).toContain('name="password"')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('Sign in with passkey')
})
