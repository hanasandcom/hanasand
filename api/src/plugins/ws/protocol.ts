import WebSocket from 'ws'
import type { RawData } from 'ws'
import recordLog from '#utils/logs/recordLog.ts'
import { socketMessageText } from '#utils/ws/socketMessageText.ts'

export function parseSocketMessage(message: RawData): any {
    const text = socketMessageText(message)
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

export function rawMessageBytes(message: RawData) {
    if (Buffer.isBuffer(message)) return message.byteLength
    if (message instanceof ArrayBuffer) return message.byteLength
    if (Array.isArray(message)) return message.reduce((total, chunk) => total + chunk.byteLength, 0)
    return Buffer.byteLength(String(message), 'utf8')
}

export function closeMessage(code: number, reason: Buffer) {
    const text = reason.toString('utf8')
    return text ? `${code} ${text}` : String(code)
}

export function sendStatus(connection: WebSocket, state: string, message: string) {
    if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'status', state, message }))
}

export function sendErrorThenClose(connection: WebSocket, message: string, closeCode = 1000, closeReason = '') {
    connection.send(JSON.stringify({ type: 'error', message }), () => {
        if (connection.readyState === WebSocket.OPEN) connection.close(closeCode, closeReason)
    })
}

export async function recordWebsocketFailure(kind: string, id: string, error: unknown) {
    await recordLog({
        level: 'warn',
        message: `Websocket ${kind} failure for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
            category: 'websocket_failure',
            kind,
            id,
        },
    }).catch(() => {})
}
