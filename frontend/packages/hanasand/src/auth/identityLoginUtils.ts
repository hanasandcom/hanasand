export function isSameOriginPath(value: string) {
    if (!value.startsWith('/') || value.startsWith('//')) return false
    if (typeof window === 'undefined') return true
    try {
        const url = new URL(value, window.location.href)
        return url.origin === window.location.origin && url.pathname.startsWith('/') && !url.pathname.startsWith('//')
    } catch {
        return false
    }
}

export function requireSameOriginPath(value: string) {
    if (!value.startsWith('/') || value.startsWith('//')) throw new Error('Sign-in route must stay on this site.')
    return value
}

export function safeRedirectPath(value: string) {
    return value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function getSignInError(cause: unknown, fallback: string) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
        return 'Sign-in took too long. Please try again.'
    }
    return cause instanceof Error ? cause.message : fallback
}

export function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0))
}

export function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
