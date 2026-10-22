import type WebSocket from 'ws'

export type PendingUpdates = {
    content: string
    timer: NodeJS.Timeout
    userId?: string | null
}

export const testClients = new Map<string, Set<WebSocket>>()
export const shareClients = new Map<string, Set<WebSocket>>()
export const pendingUpdates = new Map<string, PendingUpdates>()
