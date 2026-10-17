import assert from 'node:assert/strict'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import type WebSocket from 'ws'
import type { WebSocketServer } from 'ws'
import type { BrokerPayload } from './types.ts'

export function listen(server: http.Server) {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => resolve())
    })
}

export function onceListening(server: WebSocketServer) {
    return new Promise<void>((resolve) => {
        if (server.address()) {
            resolve()
            return
        }
        server.once('listening', () => resolve())
    })
}

export function onceOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve())
        socket.once('error', reject)
    })
}

export function portFor(server: http.Server | WebSocketServer) {
    const address = server.address()
    assert(address && typeof address !== 'string')
    return (address as AddressInfo).port
}

export function waitForPayload(
    payloads: BrokerPayload[],
    predicate: (payload: BrokerPayload) => boolean,
    timeoutMs = 20_000,
) {
    const started = Date.now()

    return new Promise<BrokerPayload>((resolve, reject) => {
        const timer = setInterval(() => {
            const match = payloads.find(predicate)
            if (match) {
                clearInterval(timer)
                resolve(match)
                return
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                const recent = payloads.slice(-10).map(summarizePayload)
                reject(new Error(`Timed out waiting for ${predicate.toString()}. Received: ${JSON.stringify(recent)}`))
            }
        }, 50)
    })
}

function summarizePayload(payload: BrokerPayload) {
    if (payload.type === 'tool_capture') {
        return {
            type: payload.type,
            id: payload.id,
            url: payload.url,
            imageBytes: payload.image?.length || 0,
            toolAnalysis: payload.toolAnalysis,
            webcrackLoad: payload.webcrackLoad,
            evidence: summarizeEvidence(payload),
        }
    }
    if (payload.type !== 'frame') return payload
    return {
        type: payload.type,
        reason: payload.reason,
        url: payload.url,
        title: payload.title,
        imageBytes: payload.image?.length || 0,
        evidence: summarizeEvidence(payload),
    }
}

function summarizeEvidence(payload: BrokerPayload) {
    if (!payload.evidence) return undefined
    return {
        verdict: payload.evidence.verdict,
        reasons: payload.evidence.reasons,
        obfuscatedScripts: payload.evidence.obfuscatedScripts?.length,
    }
}
