import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import LoginForm from '../src/app/login/LoginForm'
import { identityApiUrl } from '../src/utils/auth/authApiUrl'

describe('staging local login UI', () => {
    test('the authentication proxy uses the staging Identity API when configured', () => {
        const previous = process.env.FRONTEND_IDENTITY_API
        try {
            process.env.FRONTEND_IDENTITY_API = 'http://hanasand_identity_staging_primary:8081/api'
            expect(identityApiUrl()).toBe('http://hanasand_identity_staging_primary:8081/api')
        } finally {
            if (previous === undefined) delete process.env.FRONTEND_IDENTITY_API
            else process.env.FRONTEND_IDENTITY_API = previous
        }
    })

    test('keeps sign-in same-origin and hides production identity and unavailable account flows', () => {
        const html = renderToStaticMarkup(createElement(LoginForm, {
            redirectPath: '/ai',
            hydrated: true,
            ssoHref: '',
            stageLocalAuth: true,
            onChangeMode: () => {},
        }))

        expect(html).toContain('<form')
        expect(html).not.toContain('Continue with Google')
        expect(html).not.toContain('Sign in with passkey')
        expect(html).not.toContain('Sign up')
        expect(html).not.toContain('Reset password')
        expect(readFileSync(new URL('../src/app/login/LoginForm.tsx', import.meta.url), 'utf8'))
            .toContain('loginUrl=\'/api/auth/login\'')
    })
})
