import type { RawData } from 'ws'
import { socketMessageText } from '../../utils/ws/socketMessageText.ts'

export const DEFAULT_TARGET = 'http://sample-intel-source.onion'

export type BrokerMessage = {
    type?: string
    sessionId?: string
    network?: 'tor' | 'regular'
    target?: string
    durationMinutes?: number
    durationSeconds?: number
    profileTools?: Array<{ id?: string; name?: string; url?: string }>
    clientId?: string
    userId?: string
    sessionToken?: string
    width?: number
    height?: number
    userAgent?: string
    locale?: string
    timezoneId?: string
    platform?: string
    isMobile?: boolean
    hasTouch?: boolean
    x?: number
    y?: number
    deltaX?: number
    deltaY?: number
    event?: string
    button?: number
    buttons?: number
    key?: string
    ctrlKey?: boolean
    metaKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
    text?: string
    direction?: string
    tabId?: string
    extension?: 'free' | 'paid'
    paidAuthorized?: boolean
}

export function parseMessage(raw: RawData): (BrokerMessage & { type: string }) | null {
    try {
        const message = JSON.parse(socketMessageText(raw)) as BrokerMessage
        return message?.type ? message as BrokerMessage & { type: string } : null
    } catch {
        return null
    }
}

export function normalizeTarget(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return DEFAULT_TARGET
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `http://${trimmed}`
}

export function mouseButton(value: unknown): 'left' | 'right' | 'middle' {
    if (value === 2) return 'right'
    if (value === 1) return 'middle'
    return 'left'
}

export function keyShortcut(message: BrokerMessage) {
    const modifiers = [
        message.ctrlKey || message.metaKey ? 'Control' : '',
        message.altKey ? 'Alt' : '',
        message.shiftKey ? 'Shift' : '',
    ].filter(Boolean)
    if (modifiers.length === 0) return ''
    const key = normalizeKey(message.key || '')
    return [...modifiers, key].join('+')
}

export function normalizeKey(key: string) {
    if (key === ' ') return 'Space'
    if (key.length === 1) return key.toUpperCase()
    return key
}

export function isPasteShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'v')
}

export function isCopyShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'c')
}

export function isSelectAllShortcut(message: BrokerMessage) {
    return Boolean((message.ctrlKey || message.metaKey) && message.key?.toLowerCase() === 'a')
}
