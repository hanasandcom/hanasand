import { browserApiBase, identityApiBase } from './browserSetup'

type BrowserSession = {
    user?: { id?: string; name?: string } | null
    canSignOut?: boolean
}

let identitySessionPromise: Promise<BrowserSession> | null = null

function cookieValue(name: string) {
    const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
    if (!entry) return ''
    try {
        return decodeURIComponent(entry.slice(name.length + 1))
    } catch {
        return entry.slice(name.length + 1)
    }
}

async function readBrowserSession() {
    const response = await fetch(`${browserApiBase}/browser/session`, {
        credentials: 'include',
        cache: 'no-store',
    })
    if (!response.ok) throw new Error('Could not read the Browser session.')
    return await response.json() as BrowserSession
}

async function validateIdentitySession(id: string, token: string) {
    const response = await fetch(`${identityApiBase}/auth/token/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) {
        throw new Error('Your Hanasand session has expired. Sign in again to use Browser.')
    }
    if (!response.ok) throw new Error('Could not verify your current session with Identity.')
    const identity = await response.json() as { id?: unknown; name?: unknown; token?: unknown }
    if (identity.id !== id || typeof identity.token !== 'string' || !identity.token) {
        throw new Error('Identity returned an incomplete session. Sign in again to use Browser.')
    }
    return { id, token: identity.token }
}

async function establishBrowserApiSession(id: string, token: string) {
    const response = await fetch(`${browserApiBase}/browser/session`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
    })
    if (response.status === 401 || response.status === 403) {
        throw new Error('Browser could not establish a session from your signed-in Identity account.')
    }
    if (!response.ok) throw new Error('Could not establish your Browser session.')
}

async function establishBrowserIdentitySession() {
    const identityId = cookieValue('id')
    const identityToken = cookieValue('access_token')
    if (identityId && identityToken) {
        const verified = await validateIdentitySession(identityId, identityToken)
        let session = await readBrowserSession()
        if (session?.user?.id !== verified.id) {
            await establishBrowserApiSession(verified.id, verified.token)
            session = await readBrowserSession()
        }
        if (session?.user?.id === verified.id) return session
        throw new Error('Identity verified your session, but Browser could not establish it.')
    }

    // HttpOnly Identity cookies are not visible to page JavaScript. In that
    // case Browser can use the session only if its API verifies those cookies.
    const session = await readBrowserSession()
    if (session?.user?.id && (!identityId || session.user.id === identityId)) return session
    if (identityId || identityToken) {
        throw new Error('Your Hanasand session is incomplete. Refresh the page or sign in again.')
    }
    return { user: null }
}

export async function ensureBrowserIdentitySession() {
    if (!identitySessionPromise) identitySessionPromise = establishBrowserIdentitySession()
    try {
        return await identitySessionPromise
    } finally {
        identitySessionPromise = null
    }
}
