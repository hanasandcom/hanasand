import { describe, expect, test } from 'bun:test'
import { identityAuthUrl } from '../src/utils/auth/identityRedirect'

describe('Identity redirects', () => {
    test('login and signup return to the requested Hanasand path', () => {
        const appDestination = 'https://hanasand.com/dashboard?tab=files#recent'
        expect(identityAuthUrl('login', '/dashboard?tab=files#recent'))
            .toBe(`https://identity.hanasand.com/login?returnTo=${encodeURIComponent(appDestination)}`)
        expect(identityAuthUrl('signup', '/dashboard'))
            .toBe(`https://identity.hanasand.com/signup?returnTo=${encodeURIComponent('https://hanasand.com/dashboard')}`)
    })

    test('rejects external and protocol-relative return paths', () => {
        expect(identityAuthUrl('login', '//evil.example/steal'))
            .toBe(`https://identity.hanasand.com/login?returnTo=${encodeURIComponent('https://hanasand.com/dashboard')}`)
        expect(identityAuthUrl('signup', 'https://evil.example/'))
            .toBe(`https://identity.hanasand.com/signup?returnTo=${encodeURIComponent('https://hanasand.com/dashboard')}`)
    })
})
