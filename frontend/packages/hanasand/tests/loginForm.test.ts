// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { registerHanasandLoginForm, renderHanasandLoginFormMarkup } from '../src/auth/loginForm'

test('server markup helper renders credential and provider controls safely', () => {
    const html = renderHanasandLoginFormMarkup({
        loginUrl: '/api/auth/login',
        passkeyOptionsUrl: '/api/auth/passkeys/authenticate/options',
        passkeyVerifyUrl: '/api/auth/passkeys/authenticate/verify',
        ssoHref: '/api/auth/sso/start?returnTo=%2Fgallery',
        redirectPath: '/gallery?album=summer&sort=date',
        identifierValue: 'eirik@example.com" autofocus="true',
    })

    expect(html).toContain('name="username"')
    expect(html).toContain('name="password"')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('Sign in with passkey')
    expect(html).toContain('action="/api/auth/login"')
    expect(html).toContain('value="eirik@example.com&quot; autofocus=&quot;true"')
    expect(() => renderHanasandLoginFormMarkup({
        loginUrl: 'https://attacker.example/login',
        passkeyOptionsUrl: '/options',
        passkeyVerifyUrl: '/verify',
        ssoHref: '/sso',
        redirectPath: '/',
    })).toThrow('Login route must stay on this site.')
})

test('package exports an idempotent local login component registration', () => {
    const definitions = new Map<string, CustomElementConstructor>()
    const registry = {
        get: (name: string) => definitions.get(name),
        define: (name: string, element: CustomElementConstructor) => {
            if (definitions.has(name)) throw new Error(`Already defined: ${name}`)
            definitions.set(name, element)
        },
    }
    const originalRegistry = Object.getOwnPropertyDescriptor(globalThis, 'customElements')
    const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')
    Object.defineProperty(globalThis, 'customElements', { configurable: true, value: registry })
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: class {} })
    try {
        registerHanasandLoginForm()
        registerHanasandLoginForm()
        expect(definitions.has('hanasand-login-form')).toBe(true)
    } finally {
        if (originalRegistry) Object.defineProperty(globalThis, 'customElements', originalRegistry)
        else Reflect.deleteProperty(globalThis, 'customElements')
        if (originalElement) Object.defineProperty(globalThis, 'HTMLElement', originalElement)
        else Reflect.deleteProperty(globalThis, 'HTMLElement')
    }
})
