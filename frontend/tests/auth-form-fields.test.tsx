// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LoginForm from '../src/app/login/LoginForm'
import ResetRequestForm from '../src/app/login/ResetRequestForm'
import SignupForm from '../src/app/login/SignupForm'

test('login renders shared credentials and auth methods before hydration', () => {
    const html = renderToStaticMarkup(createElement(LoginForm, {
        redirectPath: '/dashboard',
        hydrated: false,
        ssoHref: '/api/auth/sso/start',
        onChangeMode: () => {},
    }))

    expect(html).toContain('action="/api/auth/login"')
    expect(html).toContain('method="post"')
    expect(html).toContain('<hanasand-login-form')
    expect(html).toContain('identifier-label="Username"')
    expect(html).toContain('identifier-placeholder="Username"')
    expect(html).toContain('passkey-options-url="/api/auth/passkeys/authenticate/options"')
    expect(html).toContain('passkey-verify-url="/api/auth/passkeys/authenticate/verify"')
    expect(html).toContain('sso-href="/api/auth/sso/start"')
    expect(html).toContain('disabled=""')
})

test('reset request shares the auth submit loading and disabled presentation', () => {
    const html = renderToStaticMarkup(createElement(ResetRequestForm, {
        busy: true,
        onSubmit: () => {},
        onBack: () => {},
    }))

    expect(html).toContain('type="submit" disabled=""')
    expect(html).toContain('Sending')
    expect(html).not.toContain('Send code')
    expect(html).toContain('Back')
})

test('signup reports validation errors and disables unavailable account submission', () => {
    const flow = {
        sendError: 'Could not send code.',
        username: 'reserved',
        usernameIsReserved: true,
        setUsername: () => {},
        name: 'Alice Example',
        setName: () => {},
        email: 'alice@example.test',
        setEmail: () => {},
        password: 'weak',
        setPassword: () => {},
        passwordIsValid: false,
        passwordRequirementMessage: 'Use a stronger password.',
        canCreateAccount: false,
    } as unknown as Parameters<typeof SignupForm>[0]['flow']
    const html = renderToStaticMarkup(createElement(SignupForm, {
        flow,
        busy: false,
        hydrated: true,
        redirectPath: '/dashboard',
        onSubmit: () => {},
        onBackToLogin: () => {},
    }))

    expect(html).toContain('role="alert"')
    expect(html).toContain('Could not send code.')
    expect(html).toContain('Reserved username.')
    expect(html).toContain('Use a stronger password.')
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).toContain('autoComplete="new-password"')
    expect(html).toContain('Create account')
    expect(html).toContain('type="submit" disabled=""')
})
