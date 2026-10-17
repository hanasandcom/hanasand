import { createHmac } from 'node:crypto'
import WebSocket from 'ws'
import { sendStatus } from './protocol.ts'

export function browserTurnCredentials(sessionId: string, lifetimeSeconds = 60 * 60) {
    const secret = process.env.BROWSER_SANDBOX_TURN_SECRET || ''
    const host = process.env.BROWSER_SANDBOX_TURN_HOST || ''
    if (process.env.NODE_ENV === 'production' && (!secret || secret === 'unsafe-dev-turn-secret' || !host)) {
        throw new Error('Production WebRTC browser streams require BROWSER_SANDBOX_TURN_SECRET and BROWSER_SANDBOX_TURN_HOST.')
    }
    const username = `${Math.floor(Date.now() / 1000) + lifetimeSeconds}:${sessionId}`
    return {
        host: host || '127.0.0.1',
        username,
        password: createHmac('sha1', secret || 'unsafe-dev-turn-secret').update(username).digest('base64'),
    }
}

export async function announceBrowserStream(connection: WebSocket, id: string, token: string, ip: string) {
    const ready = await waitForBrowserStream(ip)
    if (!ready) {
        sendStatus(connection, 'stream_unavailable', 'The browser started, but its WebRTC transport did not become ready.')
        return null
    }
    if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({
            type: 'stream_ready',
            transport: 'webrtc',
            targetFps: 30,
            streamUrl: `/api/browser-stream/${encodeURIComponent(id)}/${token}/index.html`,
        }))
    }
    const sendMetrics = () => void browserStreamMetrics(ip).then(metrics => {
        if (metrics && connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'stream_metrics', ...metrics }))
    })
    sendMetrics()
    const timer = setInterval(sendMetrics, 1_000)
    timer.unref()
    return timer
}

async function waitForBrowserStream(ip: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const ready = await fetch(`http://${ip}:8080/health`, { signal: AbortSignal.timeout(750) })
            .then(response => response.ok)
            .catch(() => false)
        if (ready) return true
        await new Promise(resolve => setTimeout(resolve, 250))
    }
    return false
}

async function browserStreamMetrics(ip: string) {
    const body = await fetch(`http://${ip}:9081/metrics`, { signal: AbortSignal.timeout(750) })
        .then(response => response.ok ? response.text() : '')
        .catch(() => '')
    if (!body) return null
    const fps = Number(body.match(/^fps ([\d.]+)$/m)?.[1])
    const latencyMs = Number(body.match(/^latency ([\d.]+)$/m)?.[1])
    if (!Number.isFinite(fps) && !Number.isFinite(latencyMs)) return null
    return {
        fps: Number.isFinite(fps) ? fps : undefined,
        latencyMs: Number.isFinite(latencyMs) ? latencyMs : undefined,
        sampledAt: new Date().toISOString(),
    }
}

export function browserStreamResolution(payload: { width?: unknown; height?: unknown }) {
    const width = Math.max(320, Math.min(2400, Math.round(Number(payload.width) || 1280)))
    const height = Math.max(320, Math.min(2160, Math.round(Number(payload.height) || width * 9 / 16)))
    return `${width}x${height}`
}

