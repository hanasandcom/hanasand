import { queryOnce, withTransaction } from '#db'
import type WebSocket from 'ws'

export type StudioDocument = { id: number, title: string, body: string, revision: number }
export type StudioPage = { id: number, title: string }
const clients = new Set<WebSocket>()
const columns = 'id, title, content AS body, revision::float8 AS revision'

export async function listStudioPages(): Promise<StudioPage[]> {
    const result = await queryOnce('SELECT id, title FROM studio ORDER BY id')
    return result.rows as StudioPage[]
}

export async function readStudio(id = 1): Promise<StudioDocument | null> {
    const result = await queryOnce(`SELECT ${columns} FROM studio WHERE id = $1`, [id])
    return result.rows[0] as StudioDocument | null
}

export async function createStudioPage(): Promise<StudioDocument> {
    const page = await withTransaction(async query => {
        await query('LOCK TABLE studio IN EXCLUSIVE MODE')
        const result = await query(`INSERT INTO studio (id, title, content)
            SELECT COALESCE(MAX(id), 0) + 1, 'Page ' || (COALESCE(MAX(id), 0) + 1), '' FROM studio RETURNING ${columns}`)
        return result.rows[0] as StudioDocument
    })
    broadcast({ type: 'pages', pages: await listStudioPages() })
    return page
}

export function validStudio(value: unknown): value is StudioDocument {
    const document = value as StudioDocument | null
    return document !== null && Number.isSafeInteger(document.id) && document.id > 0 && document.id <= 32767
        && typeof document.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function saveStudio(document: StudioDocument) {
    const result = await queryOnce(`UPDATE studio SET title = $1, content = $2, revision = revision + 1, updated_at = NOW()
        WHERE id = $4 AND revision = $3 RETURNING ${columns}`, [document.title, document.body, document.revision, document.id])
    if (!result.rows[0]) {
        const current = await readStudio(document.id)
        return { status: current ? 409 : 404, document: current }
    }
    const saved = result.rows[0] as StudioDocument
    broadcast(saved)
    broadcast({ type: 'pages', pages: await listStudioPages() })
    return { status: 200, document: saved }
}

function broadcast(message: StudioDocument | { type: 'pages', pages: StudioPage[] }) {
    for (const socket of clients) send(socket, message)
}

function send(socket: WebSocket, message: StudioDocument | { type: 'pages', pages: StudioPage[] }) {
    if (socket.readyState !== 1) return
    if (socket.bufferedAmount > 2_000_000) return socket.close(1013, 'Reconnect for the latest version')
    socket.send(JSON.stringify(message), error => { if (error) socket.close() })
}

export function subscribeStudio(socket: WebSocket) {
    clients.add(socket)
    socket.on('close', () => clients.delete(socket))
    socket.on('error', () => clients.delete(socket))
    void listStudioPages().then(async pages => {
        send(socket, { type: 'pages', pages })
        for (const page of pages) {
            const document = await readStudio(page.id)
            if (document) send(socket, document)
        }
    }).catch(() => socket.close(1011))
}
