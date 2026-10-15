const DEFAULT_BROWSER_MAX_SESSIONS = 100

export type BrowserAdmissionStatus = {
    activeSessions: number
    queuedSessions: number
    maxSessions: number
    queuePosition?: number
}

type BrowserAdmissionRelease = {
    release: () => void
    status: BrowserAdmissionStatus
}

type BrowserAdmissionRequest = {
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    resolve: (release: BrowserAdmissionRelease) => void
    cancelled: boolean
}

let activeBrowserSessions = 0
const browserSessionQueue: BrowserAdmissionRequest[] = []

function browserMaxSessions() {
    const configured = Number(process.env.BROWSER_SANDBOX_MAX_SESSIONS)
    if (!Number.isFinite(configured)) return DEFAULT_BROWSER_MAX_SESSIONS
    return Math.max(1, Math.min(100, Math.floor(configured)))
}

export function currentBrowserAdmissionStatus(queuePosition?: number): BrowserAdmissionStatus {
    return {
        activeSessions: activeBrowserSessions,
        queuedSessions: browserSessionQueue.length,
        maxSessions: browserMaxSessions(),
        queuePosition,
    }
}

export function requestBrowserAdmission(sessionId: string, send: (payload: Record<string, unknown>) => void) {
    // A newly available slot belongs to the oldest waiter, even if the cap changed.
    drainBrowserQueue()
    const maxSessions = browserMaxSessions()
    if (activeBrowserSessions < maxSessions) {
        activeBrowserSessions += 1
        return {
            promise: Promise.resolve({
                release: releaseBrowserAdmission(),
                status: currentBrowserAdmissionStatus(),
            }),
            cancel: () => undefined,
        }
    }

    let entry: BrowserAdmissionRequest
    const promise = new Promise<BrowserAdmissionRelease>((resolve) => {
        entry = { sessionId, send, resolve, cancelled: false }
        browserSessionQueue.push(entry)
        sendBrowserQueueStatus(entry)
        broadcastBrowserQueuePositions()
    })

    return {
        promise,
        cancel: () => {
            entry.cancelled = true
            const index = browserSessionQueue.indexOf(entry)
            if (index >= 0) {
                browserSessionQueue.splice(index, 1)
                broadcastBrowserQueuePositions()
            }
        },
    }
}

export function trackBrowserAdmissionRelease(
    admission: Promise<{ release: () => void }>,
    isClosed: () => boolean,
) {
    let release: (() => void) | null = null
    void admission.then(slot => {
        if (isClosed()) slot.release()
        else release = slot.release
    })
    return {
        release() {
            release?.()
            release = null
        },
    }
}

function releaseBrowserAdmission() {
    let released = false
    return () => {
        if (released) return
        released = true
        activeBrowserSessions = Math.max(0, activeBrowserSessions - 1)
        drainBrowserQueue()
    }
}

function drainBrowserQueue() {
    const maxSessions = browserMaxSessions()
    while (activeBrowserSessions < maxSessions && browserSessionQueue.length) {
        const entry = browserSessionQueue.shift()
        if (!entry || entry.cancelled) continue
        activeBrowserSessions += 1
        const status = currentBrowserAdmissionStatus()
        entry.send({
            type: 'status',
            state: 'capacity_admitted',
            sessionId: entry.sessionId,
            capacity: status,
            message: 'Sandbox capacity is available. Starting this queued browser now.',
        })
        entry.resolve({
            release: releaseBrowserAdmission(),
            status,
        })
    }
    broadcastBrowserQueuePositions()
}

function sendBrowserQueueStatus(entry: BrowserAdmissionRequest) {
    const position = browserSessionQueue.indexOf(entry) + 1
    const status = currentBrowserAdmissionStatus(position > 0 ? position : undefined)
    entry.send({
        type: 'status',
        state: 'capacity_busy',
        sessionId: entry.sessionId,
        capacity: status,
        message: `All ${status.maxSessions} sandbox slots are busy. This run is queued at position ${status.queuePosition}.`,
    })
}

function broadcastBrowserQueuePositions() {
    for (const [index, entry] of browserSessionQueue.entries()) {
        if (entry.cancelled) continue
        const status = currentBrowserAdmissionStatus(index + 1)
        entry.send({
            type: 'status',
            state: 'capacity_queue_position',
            sessionId: entry.sessionId,
            capacity: status,
            message: `Queued for sandbox capacity. Position ${status.queuePosition} of ${status.queuedSessions}.`,
        })
    }
}
