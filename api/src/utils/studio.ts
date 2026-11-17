import { queryOnce } from '#db'
import type WebSocket from 'ws'

export type StudioDocument = { title: string, body: string, revision: number }
const clients = new Set<WebSocket>()
const columns = 'title, content AS body, revision::float8 AS revision'

export async function readStudio(): Promise<StudioDocument> {
    const result = await queryOnce(`SELECT ${columns} FROM studio WHERE id = 1`)
    if (!result.rows[0]) throw new Error('Studio is not initialized.')
    return result.rows[0] as StudioDocument
}

export function validStudio(value: unknown): value is StudioDocument {
    const document = value as StudioDocument | null
    return typeof document?.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function saveStudio(document: StudioDocument) {
    const result = await queryOnce(`UPDATE studio SET title = $1, content = $2, revision = revision + 1, updated_at = NOW()
        WHERE id = 1 AND revision = $3 RETURNING ${columns}`, [document.title, document.body, document.revision])
    if (!result.rows[0]) return { status: 409, document: await readStudio() }
    const saved = result.rows[0] as StudioDocument
    for (const socket of clients) send(socket, saved)
    return { status: 200, document: saved }
}

function send(socket: WebSocket, document: StudioDocument) {
    if (socket.readyState !== 1) return
    if (socket.bufferedAmount > 2_000_000) return socket.close(1013, 'Reconnect for the latest version')
    socket.send(JSON.stringify(document), error => { if (error) socket.close() })
}

export function subscribeStudio(socket: WebSocket) {
    clients.add(socket)
    socket.on('close', () => clients.delete(socket))
    socket.on('error', () => clients.delete(socket))
    void readStudio().then(document => send(socket, document)).catch(() => socket.close(1011))
}
