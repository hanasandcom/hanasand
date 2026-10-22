'use client'

import { getCookie, removeCookies } from 'hanasand/cookies'

export async function startImpersonating(id: string) {
    const actorId = getCookie('id')
    const token = getCookie('access_token')
    if (!actorId || !token) {
        throw new Error('Log in again before impersonating a user.')
    }
    if (actorId === id) {
        throw new Error('You are already viewing your own account.')
    }
    const response = await fetch('/api/impersonation/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            target_id: id,
        }),
    })
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Unable to start impersonation.')
    }

}

export async function stopImpersonating() {
    await fetch('/api/impersonation/stop', { method: 'POST', cache: 'no-store' })
        .catch(() => undefined)
    removeCookies('impersonation_token', 'impersonating_id', 'impersonating_name')
}
