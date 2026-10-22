import { afterEach, describe, expect, test } from 'bun:test'
import { getCookie, removeCookie, removeCookies, setCookie, setCookieWithExpiresAt } from '../src/cookies'

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let writes: string[] = []

function installBrowser(hostname: string) {
    writes = []
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            cookie: '',
            set cookie(value: string) { writes.push(value) },
            get cookie() { return writes.join('; ') },
        },
    })
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { location: { hostname } },
    })
}

afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')

    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
})

describe('browser cookie helpers', () => {
    test('reads encoded cookie values and escapes special names', () => {
        installBrowser('app.hanasand.com')
        Object.defineProperty(globalThis, 'document', {
            configurable: true,
            value: { cookie: 'session?key=first; token.name=hello%20world' },
        })

        expect(getCookie('token.name')).toBe('hello world')
        expect(getCookie('missing')).toBeNull()
    })

    test('sets a host cookie and clears the previous shared-domain cookie', () => {
        installBrowser('app.hanasand.com')

        setCookie('session', 'a b', 1)

        expect(writes).toHaveLength(2)
        expect(writes[0]).toContain('session=a%20b; expires=')
        expect(writes[0]).toContain('path=/; SameSite=Lax')
        expect(writes[1]).toContain('domain=.hanasand.com; SameSite=Lax; Secure')
    })

    test('sets an explicit expiry and removes a shared cookie by name', () => {
        installBrowser('hanasand.com')

        setCookieWithExpiresAt('theme', 'dark', '2026-10-22T00:00:00.000Z')
        removeCookies('theme')

        expect(writes).toHaveLength(4)
        expect(writes[0]).toContain('theme=dark; expires=Thu, 22 Oct 2026 00:00:00 GMT')
        expect(writes[1]).toContain('domain=.hanasand.com')
        expect(writes[2]).toContain('expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/')
        expect(writes[3]).toContain('domain=.hanasand.com')
    })

    test('does not delete the shared-domain cookie on unrelated hosts', () => {
        installBrowser('localhost')

        removeCookie('session')

        expect(writes).toHaveLength(1)
        expect(writes[0]).not.toContain('domain=.hanasand.com')
    })
})
