'use client'

import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

let guestSession: Promise<void> | undefined

async function ensureGuestSession() {
    if (typeof window === 'undefined' || getCookie('access_token')) return
    guestSession ||= fetch('/api/support/session', { credentials: 'same-origin', cache: 'no-store' })
        .then(response => { if (!response.ok) throw new Error('Support session could not be started') })
        .catch(error => { guestSession = undefined; throw error })
    await guestSession
}

export async function supportFetch(path: string, init: RequestInit = {}) {
    await ensureGuestSession()
    const headers = new Headers(init.headers)
    const token = getCookie('access_token')
    const id = getCookie('id')
    const impersonation = getCookie('impersonation_token')
    if (token) headers.set('authorization', `Bearer ${token}`)
    if (id) headers.set('id', id)
    if (impersonation) headers.set('x-impersonation-token', impersonation)
    const response = await fetch(`${config.url.support}${path}`, { ...init, headers, credentials: 'include', cache: init.cache || 'no-store' })
    const refreshed = response.headers.get('x-access-token')
    const expiresAt = response.headers.get('x-access-token-expires-at')
    if (refreshed && expiresAt && typeof document !== 'undefined') {
        const expires = new Date(expiresAt).toUTCString()
        document.cookie = `access_token=${encodeURIComponent(refreshed)}; expires=${expires}; path=/; domain=.hanasand.com; SameSite=Lax; Secure`
    }
    return response
}
