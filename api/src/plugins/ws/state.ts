import type WebSocket from 'ws'

export const MAX_QUEUED_BROWSER_MESSAGES = 100
export const MAX_QUEUED_BROWSER_MESSAGE_BYTES = 1024 * 1024

export type PendingUpdates = {
    content: string
    timer: NodeJS.Timeout
    userId?: string | null
}

export type BrowserStream = {
    token: string
    ip: string
    containerId: string
    expiresAt: number
}

export type BrowserRunLogContext = {
    target?: string
    network?: string
    runStatus?: string
    lastUrl?: string
    framesDelivered?: number
}

export const testClients = new Map<string, Set<WebSocket>>()
export const shareClients = new Map<string, Set<WebSocket>>()
export const pendingUpdates = new Map<string, PendingUpdates>()
export const browserRunWarningLogTimes = new Map<string, number>()
export const browserRunFailureLogTimes = new Map<string, number>()
export const browserRunUnreachableLogTimes = new Map<string, number>()
export const browserRunLogContexts = new Map<string, BrowserRunLogContext>()
export const browserStreams = new Map<string, BrowserStream>()
