import { browserApiBase } from './browserSetup'

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

async function establishBrowserIdentitySession() {
    // Browser validates the shared Hanasand Identity cookies directly. Do not
    // copy the bearer token into a Browser-only session cookie: that can leave
    // the sandbox appearing signed out when the exchange fails or the cookies
    // are only partially visible to JavaScript.
    const session = await readBrowserSession()
    if (session.user?.id) return session

    const identityId = cookieValue('id')
    const identityToken = cookieValue('access_token')
    if (identityId || identityToken) {
        throw new Error('Your Hanasand session could not be verified by Browser. Retry or refresh the page.')
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
