import config from '@/config'
import type { ThesisDocument } from '@/utils/thesis'
import { sameThesis } from './thesisRecovery'

type ThesisTransportOptions = {
    canEdit: boolean
    getDraft(): ThesisDocument
    getBase(): ThesisDocument
    isDirty(): boolean
    hasConflict(): boolean
    receive(document: ThesisDocument): void
    keepDraft(): void
    sentRef: { current: ThesisDocument | null }
    onConflict(document: ThesisDocument): void
    onAccepted(document: ThesisDocument): void
    onSaved(): void
    setError(error: string): void
}

export function createThesisTransport(options: ThesisTransportOptions) {
    const { canEdit, getDraft, getBase, isDirty, hasConflict, receive, keepDraft, sentRef, onConflict, onAccepted, onSaved, setError } = options
    let inFlight: Promise<boolean> | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let reconnect: ReturnType<typeof setTimeout> | undefined
    let socket: WebSocket | undefined
    let stopped = false
    let retryDelay = 1000

    function schedule() {
        if (!canEdit || stopped || hasConflict() || timer || !isDirty()) return
        timer = setTimeout(() => { timer = undefined; void flush() }, 5000)
    }

    async function flush(): Promise<boolean> {
        if (!canEdit || stopped || hasConflict()) return false
        if (inFlight) {
            if (!await inFlight) return false
            return flush()
        }
        if (!isDirty()) return true
        const snapshot = { ...getDraft(), revision: getBase().revision }
        sentRef.current = snapshot
        inFlight = (async() => {
            try {
                const response = await fetch('/api/thesis', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(snapshot),
                    keepalive: new Blob([JSON.stringify(snapshot)]).size <= 60000,
                    signal: AbortSignal.timeout(15000),
                })
                const next = await response.json()
                if (stopped) return false
                if (response.status === 409) {
                    onConflict(next)
                    return false
                }
                if (!response.ok) throw new Error(next.error || 'Autosave failed. Your draft is kept in this browser.')
                receive(next)
                if (sameThesis(getDraft(), next)) {
                    onAccepted(next)
                    keepDraft()
                }
                onSaved()
                return true
            } catch (failure) {
                if (!stopped) setError(failure instanceof Error ? failure.message : 'Autosave failed. Your draft is kept in this browser.')
                return false
            } finally {
                sentRef.current = null
                inFlight = null
                schedule()
            }
        })()
        return inFlight
    }

    function closeFlush() {
        if (!canEdit || hasConflict() || !isDirty()) return
        keepDraft()
        const body = JSON.stringify({ ...getDraft(), revision: getBase().revision })
        // Browsers cap keepalive/beacon payloads at about 64 KiB. Larger drafts remain recoverable locally.
        const payload = new Blob([body], { type: 'application/json' })
        if (payload.size <= 60000 && navigator.sendBeacon('/api/thesis', payload)) return
        void fetch('/api/thesis', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
            keepalive: payload.size <= 60000,
        }).catch(() => {})
    }

    function connect() {
        socket = new WebSocket(`${config.url.api_wss}/thesis`)
        socket.onopen = () => { retryDelay = 1000 }
        socket.onmessage = event => {
            try { receive(JSON.parse(event.data)) } catch { /* Ignore malformed transport messages. */ }
        }
        socket.onclose = () => {
            if (!stopped) {
                reconnect = setTimeout(connect, retryDelay)
                retryDelay = Math.min(retryDelay * 2, 10000)
            }
        }
        socket.onerror = () => socket?.close()
    }

    function start() {
        connect()
        const hide = () => { if (window.document.visibilityState === 'hidden') closeFlush() }
        const online = () => { void flush() }
        window.addEventListener('pagehide', closeFlush)
        window.document.addEventListener('visibilitychange', hide)
        window.addEventListener('online', online)
        return () => {
            closeFlush()
            stopped = true
            clearTimeout(timer)
            clearTimeout(reconnect)
            socket?.close()
            window.removeEventListener('pagehide', closeFlush)
            window.document.removeEventListener('visibilitychange', hide)
            window.removeEventListener('online', online)
        }
    }

    return { start, schedule, flush }
}
