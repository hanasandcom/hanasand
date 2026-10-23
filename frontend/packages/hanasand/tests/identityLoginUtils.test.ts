// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { decodeBase64Url, encodeBase64Url, getSignInError, isSameOriginPath, safeRedirectPath } from '../src/auth/identityLoginUtils'

test('Identity login utilities validate local destinations and encode passkey bytes', () => {
    expect(isSameOriginPath('/api/auth/login')).toBe(true)
    expect(isSameOriginPath('//outside.example')).toBe(false)
    expect(safeRedirectPath('//outside.example')).toBe('/')
    const bytes = new Uint8Array([1, 2, 3]).buffer
    expect(decodeBase64Url(encodeBase64Url(bytes))).toEqual(new Uint8Array([1, 2, 3]))
})

test('Identity login utilities give timeouts an actionable error', () => {
    const timeout = new DOMException('aborted', 'TimeoutError')
    expect(getSignInError(timeout, 'fallback')).toBe('Sign-in took too long. Please try again.')
})
