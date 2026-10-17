import WebSocket from 'ws'
import type { RawData } from 'ws'
import { resumableBrowserSocket } from '#utils/ws/browserReconnect.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { recordWebsocketFailure, rawMessageBytes, sendErrorThenClose } from './protocol.ts'
import { proxyEphemeralBrowserSocket } from './ephemeralBrowserSession.ts'
import { socketMessageText } from '#utils/ws/socketMessageText.ts'
import { MAX_QUEUED_BROWSER_MESSAGES, MAX_QUEUED_BROWSER_MESSAGE_BYTES } from './state.ts'

export function proxyBrowserSocket(connection: WebSocket, id: string, route: 'browser' | 'browser-sandbox' | 'onion-session') {
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') return false
    if (process.env.BROWSER_SANDBOX_ALLOW_SHARED_WORKER !== 'development') {
        void recordLog({
            level: 'info',
            message: `Starting isolated browser worker for ${route} session ${id}`,
            metadata: { category: 'browser_sandbox_worker', route, sessionId: id },
        }).catch(() => {})
        const resumed = resumableBrowserSocket(connection, `${route}:${id}`)
        if (resumed) proxyEphemeralBrowserSocket(resumed, id, route)
        return true
    }
    const base = process.env.BROWSER_SANDBOX_WORKER_WS
    if (!base) {
        const message = 'Shared browser worker is disabled; isolated per-session workers are required in production.'
        if (connection.readyState === WebSocket.OPEN) {
            sendErrorThenClose(connection, message)
        }
        void recordLog({
            level: 'error',
            message,
            metadata: { category: 'browser_sandbox_worker', route, sessionId: id },
        }).catch(() => {})
        return true
    }

    const upstream = new WebSocket(`${base.replace(/\/$/, '')}/${route}/${encodeURIComponent(id)}`)
    const pending: RawData[] = []
    let pendingBytes = 0
    let closed = false
    let overloaded = false

    upstream.on('open', () => {
        if (closed || overloaded) { upstream.close(); return }
        while (pending.length && upstream.readyState === WebSocket.OPEN) {
            const message = pending.shift()!
            pendingBytes -= rawMessageBytes(message)
            upstream.send(message)
        }
    })
    upstream.on('message', message => {
        if (connection.readyState === WebSocket.OPEN) connection.send(socketMessageText(message))
    })
    connection.on('message', message => {
        if (closed || overloaded) return
        if (upstream.readyState === WebSocket.OPEN) upstream.send(message)
        else {
            const messageBytes = rawMessageBytes(message)
            if (pending.length >= MAX_QUEUED_BROWSER_MESSAGES
                || pendingBytes + messageBytes > MAX_QUEUED_BROWSER_MESSAGE_BYTES) {
                closeBoth('Too many browser commands are waiting. The session is closing.', 1013, 'Too many queued browser commands.')
                return
            }
            pending.push(message)
            pendingBytes += messageBytes
        }
    })
    const closeBoth = (errorMessage?: string, closeCode = 1000, closeReason = '') => {
        if (closed) return
        closed = true
        if (errorMessage) overloaded = true
        pending.length = 0
        pendingBytes = 0
        if (connection.readyState === WebSocket.OPEN) {
            if (errorMessage) sendErrorThenClose(connection, errorMessage, closeCode, closeReason)
            else connection.close(closeCode, closeReason)
        }
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
    }
    connection.on('close', () => closeBoth())
    upstream.on('close', () => closeBoth())
    connection.on('error', error => {
        void recordWebsocketFailure(`browser-proxy-client-${route}`, id, error)
        closeBoth()
    })
    upstream.on('error', error => {
        void recordWebsocketFailure(`browser-proxy-upstream-${route}`, id, error)
        closeBoth()
    })

    return true
}
