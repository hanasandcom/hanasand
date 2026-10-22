// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { registerHanasandLoginForm } from '../src/auth/loginForm'

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
