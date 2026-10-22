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
    const identityId = cookieValue('id')
    const identityToken = cookieValue('access_token')
    let session: BrowserSession | null = null

    try {
        session = await readBrowserSession()
    } catch (error) {
        if (!identityId && !identityToken) return { user: null }
        if (!identityId || !identityToken) throw error
    }

    if (identityId && identityToken && (session?.user?.id !== identityId || session.canSignOut !== true)) {
        const response = await fetch(`${browserApiBase}/browser/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            cache: 'no-store',
            body: JSON.stringify({ id: identityId, token: identityToken }),
        })
        if (!response.ok) throw new Error('Could not use your current Identity session in Browser.')
        session = await response.json() as BrowserSession
    }

    return session || { user: null }
}

export async function ensureBrowserIdentitySession() {
    if (!identitySessionPromise) identitySessionPromise = establishBrowserIdentitySession()
    try {
        return await identitySessionPromise
    } finally {
        identitySessionPromise = null
    }
}
