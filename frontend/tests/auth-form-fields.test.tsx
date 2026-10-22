// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LoginForm from '../src/app/login/LoginForm'
import ResetRequestForm from '../src/app/login/ResetRequestForm'
import SignupForm from '../src/app/login/SignupForm'

test('login renders the shared Identity form and keeps redirect handling outside it', () => {
    const html = renderToStaticMarkup(createElement(LoginForm, {
        redirectPath: '/dashboard',
        usernameRef: { current: null },
        hydrated: false,
        busy: false,
        ssoHref: '/api/auth/sso/start',
        onSubmit: () => {},
        onChangeMode: () => {},
        onPasskeyLogin: () => {},
    }))

    expect(html).toContain('<form class="flex w-full flex-col gap-4 self-center" action="/api/auth/login"')
    expect(html).toContain('name="redirectPath" value="/dashboard"')
    expect(html).toContain('<hanasand-login-form')
    expect(html).toContain('identifier-label="Username"')
    expect(html).toContain('identifier-placeholder="Username"')
    expect(html).toContain('submit-label="Log in"')
    expect(html).not.toContain('name="password"')
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
