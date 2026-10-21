'use client'

import config from '@/config'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import type { MailOverview } from './types'

const apiBase = config.url.api.replace(/\/+$/, '')

export type DraftAttachment = { name: string, type: string, size: number, contentBase64: string }

export async function fetchMailOverview(params: { mailboxUser?: string, mailboxId?: string | null, messageId?: string | null } = {}) {
    const query = new URLSearchParams()
    if (params.mailboxUser) query.set('mailboxUser', params.mailboxUser)
    if (params.mailboxId) query.set('mailboxId', params.mailboxId)
    if (params.messageId) query.set('messageId', params.messageId)
    const payload = await request<Partial<MailOverview>>(`/mail/overview?${query}`, { method: 'GET' })
    return { ...payload, messages: payload.messages || [], mailboxes: payload.mailboxes || [], accessibleAccounts: payload.accessibleAccounts || [] } as MailOverview
}

export async function searchMail(params: { mailboxUser: string, mailboxId: string, query: string }) {
    const query = new URLSearchParams(params)
    return request<{ messages: MailOverview['messages'], nextCursor: string | null }>(`/mail/search?${query}`, { method: 'GET' })
}

export function messageAction(messageId: string, body: { mailboxUser: string, action: 'archive' | 'trash' | 'read' | 'unread' | 'flag' | 'unflag' }) {
    return request(`/mail/message/${encodeURIComponent(messageId)}/action`, { method: 'POST', body: JSON.stringify(body) })
}

export function sendMail(body: {
    mailboxUser: string, to: string, cc?: string, bcc?: string, subject: string, textBody: string, attachments?: DraftAttachment[]
}) {
    return request('/mail/send', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) })
}

export function mailBlobPath(mailboxUser: string, blobId: string, name: string) {
    return `${apiBase}/mail/blob/${encodeURIComponent(mailboxUser)}/${encodeURIComponent(blobId)}/${encodeURIComponent(name)}`
}

export async function fetchMailBlob(mailboxUser: string, blobId: string, name: string) {
    const response = await apiFetch(mailBlobPath(mailboxUser, blobId, name))
    if (!response.ok) throw new Error('Unable to download this attachment.')
    return response.blob()
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await apiFetch(`${apiBase}${path}`, init)
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error((body as { error?: string } | null)?.error || 'The mail request failed.')
    return body as T
}

async function apiFetch(input: string, init: RequestInit = {}) {
    const token = getCookie('access_token')
    const id = getCookie('id')
    if (!token || !id) {
        reauthenticate()
        throw new Error('Your session expired. Sign in again to open mail.')
    }
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('id', id)
    if (init.body) headers.set('Content-Type', 'application/json')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 15_000)
    try {
        const response = await fetch(input, { ...init, headers, cache: 'no-store', signal: controller.signal })
        const refreshed = response.headers.get('x-access-token')
        if (refreshed) setCookieWithExpiresAt('access_token', refreshed, response.headers.get('x-access-token-expires-at'))
        if (response.status === 401) reauthenticate()
        return response
    } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') throw new Error('Mail did not respond in time. Try again shortly.', { cause })
        throw cause
    } finally { window.clearTimeout(timer) }
}

function reauthenticate() {
    if (typeof window !== 'undefined') window.location.assign('/logout?path=/login%3Fpath%3D/mail%26expired=true')
}
