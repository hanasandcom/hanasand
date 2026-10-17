import http from 'node:http'
import WebSocket from 'ws'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { socketMessageText } from '#utils/ws/socketMessageText.ts'
import { browserStreams, MAX_QUEUED_BROWSER_MESSAGES, MAX_QUEUED_BROWSER_MESSAGE_BYTES } from './state.ts'
import { sendErrorThenClose } from './protocol.ts'
import { recordWebsocketFailure } from './protocol.ts'
import { logBrowserStreamClosure } from './browserRunLogging.ts'

export function registerBrowserStreamRoute(fastify: FastifyInstance) {
    fastify.route<{
        Params: { id: string, token: string, '*': string }
    }>({
        method: 'GET',
        url: '/api/browser-stream/:id/:token/*',
        handler: (req, reply) => proxyBrowserStreamHttp(req, reply),
        wsHandler: (connection, req) => proxyBrowserStreamWebSocket(connection, req),
    })
}

function browserStreamFor(id: string, token: string) {
    const stream = browserStreams.get(id)
    if (!stream || stream.token !== token || stream.expiresAt <= Date.now()) return null
    return stream
}

function browserStreamUpstreamPath(req: FastifyRequest<{ Params: { '*': string } }>) {
    const query = req.raw.url?.split('?')[1]
    return `/${req.params['*'] || ''}${query ? `?${query}` : ''}`
}

function proxyBrowserStreamHttp(
    req: FastifyRequest<{ Params: { id: string, token: string, '*': string } }>,
    reply: FastifyReply,
) {
    const stream = browserStreamFor(req.params.id, req.params.token)
    if (!stream) return reply.code(404).send({ error: 'Browser stream is unavailable.' })

    reply.hijack()
    const upstream = http.request({
        hostname: stream.ip,
        port: 8080,
        method: 'GET',
        path: browserStreamUpstreamPath(req),
        headers: { accept: req.headers.accept || '*/*', 'user-agent': req.headers['user-agent'] || 'hanasand-browser-stream' },
    }, response => {
        reply.raw.writeHead(response.statusCode || 502, response.headers)
        response.pipe(reply.raw)
    })
    upstream.setTimeout(10_000, () => upstream.destroy(new Error('Browser stream proxy timed out.')))
    upstream.on('error', error => {
        if (!reply.raw.headersSent) reply.raw.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        reply.raw.end(`Browser stream unavailable: ${error.message}`)
    })
    req.raw.on('aborted', () => upstream.destroy())
    upstream.end()
}

function proxyBrowserStreamWebSocket(
    connection: WebSocket,
    req: FastifyRequest<{ Params: { id: string, token: string, '*': string } }>,
) {
    const stream = browserStreamFor(req.params.id, req.params.token)
    if (!stream) {
        connection.close(1008, 'Browser stream is unavailable.')
        return
    }

    const upstream = new WebSocket(`ws://${stream.ip}:8080${browserStreamUpstreamPath(req)}`)
    proxyBrowserStreamSocket(connection, upstream, req.params.id)
}

export function proxyBrowserStreamSocket(connection: WebSocket, upstream: WebSocket, id: string) {
    const pending: string[] = []
    let pendingBytes = 0
    let closed = false
    const keepAliveTimer = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) connection.ping()
        if (upstream.readyState === WebSocket.OPEN) upstream.ping()
    }, 20_000)
    keepAliveTimer.unref()
    const closeBoth = (errorMessage?: string, closeCode = 1000, closeReason = '') => {
        if (closed) return
        closed = true
        clearInterval(keepAliveTimer)
        pending.length = 0
        pendingBytes = 0
        if (connection.readyState === WebSocket.OPEN) {
            if (errorMessage) sendErrorThenClose(connection, errorMessage, closeCode, closeReason)
            else connection.close(closeCode, closeReason)
        }
        if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
    }
    upstream.on('open', () => {
        if (closed) { upstream.close(); return }
        while (pending.length && upstream.readyState === WebSocket.OPEN) {
            const message = pending.shift()!
            pendingBytes -= Buffer.byteLength(message, 'utf8')
            upstream.send(message)
        }
    })
    upstream.on('message', message => {
        if (connection.readyState === WebSocket.OPEN) connection.send(socketMessageText(message))
    })
    connection.on('message', message => {
        if (closed) return
        const text = socketMessageText(message)
        if (upstream.readyState === WebSocket.OPEN) upstream.send(text)
        else {
            const messageBytes = Buffer.byteLength(text, 'utf8')
            if (pending.length >= MAX_QUEUED_BROWSER_MESSAGES
                || pendingBytes + messageBytes > MAX_QUEUED_BROWSER_MESSAGE_BYTES) {
                closeBoth('Too many browser commands are waiting. The session is closing.', 1013, 'Too many queued browser commands.')
                return
            }
            pending.push(text)
            pendingBytes += messageBytes
        }
    })
    connection.on('close', (code, reason) => {
        if (code === 1006) void logBrowserStreamClosure(id, code, reason)
        closeBoth()
    })
    upstream.on('close', () => closeBoth())
    connection.on('error', error => {
        void recordWebsocketFailure('browser-stream-client', id, error)
        closeBoth()
    })
    upstream.on('error', error => {
        void recordWebsocketFailure('browser-stream-upstream', id, error)
        closeBoth()
    })
}
