import { useEffect, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import config from '@/config'
import { supportFetch } from '@/utils/support/api'
import {
    hasUnreadSupportMessages,
    supportReadStateKey,
    SUPPORT_READ_STATE_EVENT,
    SUPPORT_TICKETS_UPDATED_EVENT,
    type SupportUnreadTicket,
} from '@/utils/supportUnread'

const SUPPORT_TICKETS_REFRESH_EVENT = 'hanasand-support-tickets-refresh'
type SupportQueue = { userId: string; scope: string; tickets: SupportUnreadTicket[]; hasUnread: boolean }

export function useDashboardSidebarSupport(userId: string, pathname: string) {
    const [supportQueue, setSupportQueue] = useState<SupportQueue | null>(null)
    const hasOpenSupportChats = supportQueue?.userId === userId && supportQueue.tickets.some(ticket => ticket.status === 'open')
    const hasUnreadSupport = supportQueue?.userId === userId && supportQueue.hasUnread

    useEffect(() => {
        const controller = new AbortController()
        let requestInFlight = false
        let refreshRequested = false
        const refresh = async () => {
            if (requestInFlight) { refreshRequested = true; return }
            requestInFlight = true
            try {
                const response = await supportFetch('/support/tickets', { signal: controller.signal })
                if (!response.ok) return
                const payload = await response.json() as { tickets?: SupportUnreadTicket[] }
                if (!controller.signal.aborted) {
                    const actorId = getCookie('impersonating_id') || getCookie('id') || userId
                    const scope = `user:${actorId}`
                    const tickets = payload.tickets || []
                    setSupportQueue({ userId, scope, tickets, hasUnread: hasUnreadSupportMessages(tickets, scope) })
                }
            } catch { /* Keep the last known support queue state if the request fails. */ }
            finally {
                requestInFlight = false
                if (refreshRequested && !controller.signal.aborted) { refreshRequested = false; void refresh() }
            }
        }
        const currentScope = () => `user:${getCookie('impersonating_id') || getCookie('id') || userId}`
        const refreshReadState = (scope: string) => {
            setSupportQueue(current => current?.userId === userId && current.scope === scope
                ? { ...current, hasUnread: hasUnreadSupportMessages(current.tickets, scope) }
                : current)
        }
        const onReadState = (event: Event) => {
            const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope
            if (scope === currentScope()) refreshReadState(scope)
        }
        const onStorage = (event: StorageEvent) => {
            const scope = currentScope()
            if (event.key === supportReadStateKey(scope)) refreshReadState(scope)
        }
        const onTicketsUpdated = (event: Event) => {
            const detail = (event as CustomEvent<{ scope?: string; tickets?: SupportUnreadTicket[] }>).detail
            const scope = currentScope()
            if (detail?.scope !== scope) return
            const tickets = detail.tickets || []
            setSupportQueue({ userId, scope, tickets, hasUnread: hasUnreadSupportMessages(tickets, scope) })
        }
        if (pathname !== '/support') void refresh()
        window.addEventListener(SUPPORT_READ_STATE_EVENT, onReadState)
        window.addEventListener('storage', onStorage)
        window.addEventListener(SUPPORT_TICKETS_UPDATED_EVENT, onTicketsUpdated)
        window.addEventListener(SUPPORT_TICKETS_REFRESH_EVENT, refresh)
        return () => {
            controller.abort()
            window.removeEventListener(SUPPORT_READ_STATE_EVENT, onReadState)
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(SUPPORT_TICKETS_UPDATED_EVENT, onTicketsUpdated)
            window.removeEventListener(SUPPORT_TICKETS_REFRESH_EVENT, refresh)
        }
    }, [userId, pathname])

    useEffect(() => {
        if (!hasOpenSupportChats || pathname === '/support') return
        const id = getCookie('id') || userId
        const token = getCookie('access_token') || ''
        const impersonationToken = getCookie('impersonation_token') || undefined
        if (!id || !token) return
        let disposed = false
        let socket: WebSocket | undefined
        let retry: ReturnType<typeof setTimeout> | undefined
        let refreshTimer: ReturnType<typeof setTimeout> | undefined
        let attempts = 0
        const publishChange = () => {
            if (refreshTimer) return
            refreshTimer = setTimeout(() => {
                refreshTimer = undefined
                window.dispatchEvent(new Event(SUPPORT_TICKETS_REFRESH_EVENT))
            }, 100)
        }
        const connect = () => {
            if (disposed) return
            const next = new WebSocket(`${config.url.support_wss}/ws/support`)
            socket = next
            next.onopen = () => next.send(JSON.stringify({ type: 'auth', id, token, impersonationToken }))
            next.onmessage = event => {
                try {
                    const message = JSON.parse(event.data)
                    if (message.type === 'ready') { attempts = 0; publishChange() }
                    else if (message.type === 'changed') publishChange()
                } catch { /* Ignore malformed events. */ }
            }
            next.onerror = () => next.close()
            next.onclose = () => {
                if (socket !== next) return
                socket = undefined
                if (!disposed) retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)))
            }
        }
        connect()
        return () => {
            disposed = true
            clearTimeout(retry)
            clearTimeout(refreshTimer)
            socket?.close()
        }
    }, [userId, hasOpenSupportChats, pathname])

    return { hasOpenSupportChats: Boolean(hasOpenSupportChats), hasUnreadSupport: Boolean(hasUnreadSupport) }
}
