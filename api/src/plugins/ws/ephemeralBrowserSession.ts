import { sessionNetwork } from '../../utils/auth/sessionNetwork.ts'
import { browserLeaseHeartbeat } from '../../utils/ws/browserLease.ts'
import { socketMessageText } from '../../utils/ws/socketMessageText.ts'
import { currentBrowserAdmissionStatus, type trackBrowserAdmissionRelease } from '../../utils/ws/browserAdmission.ts'
import { persistBrowserRunEvidence, browserPaidExtensionAllowed, finishBrowserRun, refreshBrowserRunLease } from '../../handlers/browserSandboxRuns.ts'
import WebSocket, { type RawData } from 'ws'
import { randomUUID } from 'node:crypto'
import { removeRuntimeContainer } from '#utils/docker/engine.ts'
import { browserStreams } from './state.ts'
import { parseSocketMessage, rawMessageBytes, closeMessage, sendStatus, sendErrorThenClose, recordWebsocketFailure } from './protocol.ts'
import { browserStreamResolution } from './browserStreamRuntime.ts'
import { launchBrowserWorker, handleBrowserWorkerStartFailure } from './browserWorkerLaunch.ts'
import { prepareProxiedBrowserRun, persistBrowserProviderResult, finishProxiedBrowserRun } from './browserRunEvents.ts'
import { logBrowserRunFailure, logBrowserRunClosure, logBrowserClientClosure } from './browserRunLogging.ts'
import { recordBrowserWorkerLogs } from './browserRunContext.ts'
import { MAX_QUEUED_BROWSER_MESSAGES, MAX_QUEUED_BROWSER_MESSAGE_BYTES } from './state.ts'
export function proxyEphemeralBrowserSocket(connection: WebSocket, id: string, route: 'browser' | 'browser-sandbox' | 'onion-session') {
    const startup = new AbortController()
    const pending: RawData[] = []
    let pendingBytes = 0
    let upstream: WebSocket | null = null
    let containerId = ''
    let closed = false
    let runPrepared = false
    let queuedIngressMessages = 0
    let queuedIngressBytes = 0
    let leaseTimer: NodeJS.Timeout | null = null
    let messages = Promise.resolve()
    let evidenceWrites = Promise.resolve()
    let sawReady = false
    let deliveredFrame = false
    let sawTerminalMessage = false
    let streamMetricsTimer: NodeJS.Timeout | null = null
    const workerResumeToken = randomUUID()
    const streamToken = randomUUID().replaceAll('-', '')
    let cancelAdmission: (() => void) | null = null
    let admissionRelease: ReturnType<typeof trackBrowserAdmissionRelease> | null = null
    const closeBoth = (errorMessage?: string, closeCode = 1000, closeReason = '') => {
        if (closed) return
        closed = true
        startup.abort()
        pending.length = 0
        pendingBytes = 0
        if (connection.readyState === WebSocket.OPEN) {
            if (errorMessage) sendErrorThenClose(connection, errorMessage, closeCode, closeReason)
            else connection.close(closeCode, closeReason)
        }
        if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) upstream.close()
        if (streamMetricsTimer) clearInterval(streamMetricsTimer)
        if (leaseTimer) clearInterval(leaseTimer)
        cancelAdmission?.()
        cancelAdmission = null
        admissionRelease?.release()
        admissionRelease = null
        browserStreams.delete(id)
        if (containerId) void (!sawReady || !deliveredFrame ? recordBrowserWorkerLogs(containerId, route, id) : Promise.resolve())
            .finally(() => removeRuntimeContainer(containerId))
            .catch(error => recordWebsocketFailure(`browser-session-remove-${route}`, id, error))
    }
    const forwardMessage = async (message: RawData) => {
        if (closed) return
        let payload = parseSocketMessage(message)
        if (!payload) return
        if (!runPrepared) {
            if (payload.type !== 'start') return
            const start = await prepareProxiedBrowserRun(id, message, connection)
            if (!start) { closeBoth(); return }
            if (closed) { await finishBrowserRun(id, 'ended'); return }
            payload = start
            runPrepared = true
            leaseTimer = setInterval(browserLeaseHeartbeat(() => refreshBrowserRunLease(id), () => {
                if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, 'Browser session tracking is unavailable. Please try again.')
                closeBoth()
            }), 30_000)
            leaseTimer.unref()
            launchBrowserWorker({
                id, route, connection, startup, workerResumeToken, streamToken,
                resolution: browserStreamResolution(payload), regular: payload.network !== 'tor' && route !== 'onion-session',
                isClosed: () => closed,
                setContainerId: value => { containerId = value },
                setStreamMetricsTimer: timer => { streamMetricsTimer = timer },
                setAdmissionCleanup: (cancel, release) => { cancelAdmission = cancel; admissionRelease = release },
                onConnected: attachUpstream,
                onFailure: error => handleBrowserWorkerStartFailure(error, { connection, route, id, closeBoth, runPrepared }),
            })
        } else if (payload.type === 'start') return
        // Authorization flags are supplied by this authenticated broker only.
        payload = { ...payload, paidAuthorized: false, ...(payload.type === 'start' ? { resumeToken: workerResumeToken } : {}) }
        if (payload.type === 'extend' && payload.extension === 'paid') {
            const allowed = await browserPaidExtensionAllowed(id)
            if (!allowed) {
                if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({
                    type: 'status', state: 'payment_required',
                    message: 'Upgrade Browser for another five minutes.',
                }))
                return
            }
            payload.paidAuthorized = true
        }
        const forwarded = Buffer.from(JSON.stringify(payload))
        if (upstream?.readyState === WebSocket.OPEN) upstream.send(forwarded)
        else {
            if (pending.length >= MAX_QUEUED_BROWSER_MESSAGES
                || pendingBytes + forwarded.byteLength > MAX_QUEUED_BROWSER_MESSAGE_BYTES) {
                closeBoth('Too many browser commands are waiting. The session is closing.', 1013, 'Too many queued browser commands.')
                return
            }
            pending.push(forwarded)
            pendingBytes += forwarded.byteLength
        }
    }
    connection.on('message', message => {
        if (closed) return
        const messageBytes = rawMessageBytes(message)
        if (queuedIngressMessages >= MAX_QUEUED_BROWSER_MESSAGES
            || queuedIngressBytes + messageBytes > MAX_QUEUED_BROWSER_MESSAGE_BYTES) {
            closeBoth('Too many browser commands are waiting. The session is closing.', 1013, 'Too many queued browser commands.')
            return
        }
        queuedIngressMessages++
        queuedIngressBytes += messageBytes
        messages = messages.then(() => forwardMessage(message)).catch(error => {
            void recordWebsocketFailure(`browser-session-prepare-${route}`, id, error)
            if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, 'Unable to start or update this browser session. Please try again.')
            closeBoth()
        }).finally(() => {
            queuedIngressMessages--
            queuedIngressBytes -= messageBytes
        })
    })
    connection.on('close', (code, reason) => {
        if (runPrepared && !sawTerminalMessage) {
            void logBrowserClientClosure(id, code, reason, sawReady, deliveredFrame)
            void finishBrowserRun(id, 'ended')
        }
        closeBoth()
    })
    connection.on('error', error => {
        void recordWebsocketFailure(`browser-session-client-${route}`, id, error)
        closeBoth()
    })

    function attachUpstream(nextUpstream: WebSocket) {
        if (closed) { nextUpstream.close(); return }
        upstream = nextUpstream
        sendStatus(connection, 'worker_connected', 'Isolated browser worker connected.')
        while (pending.length && upstream.readyState === WebSocket.OPEN) {
            const message = pending.shift()!
            pendingBytes -= rawMessageBytes(message)
            upstream.send(message)
        }
        upstream.on('message', message => {
            const payload = parseSocketMessage(message)
            if (payload?.type === 'ready') sawReady = true
            if (payload?.type === 'frame') deliveredFrame = true
            if (payload?.type === 'ended') {
                sawTerminalMessage = true
                if (leaseTimer) clearInterval(leaseTimer)
            }
            evidenceWrites = evidenceWrites.then(async () => {
                const site = payload?.networkSummary?.site
                if (site?.ip && site?.url && payload.type === 'frame') {
                    const location = await sessionNetwork(site.ip).catch(() => null)
                    payload.networkSummary.site = { ...site, ...location?.network }
                    if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'site_network', site: payload.networkSummary.site }))
                }
                await persistBrowserRunEvidence(id, payload)
            }).catch(error => recordWebsocketFailure('browser-evidence-save', id, error))
            void persistBrowserProviderResult(id, message)
            void evidenceWrites.then(() => finishProxiedBrowserRun(id, message)).catch(error => recordWebsocketFailure('browser-run-finish', id, error))
            if (connection.readyState === WebSocket.OPEN) connection.send(payload?.capacity
                ? JSON.stringify({ ...payload, capacity: currentBrowserAdmissionStatus() })
                : socketMessageText(message))
        })
        upstream.on('close', (code, reason) => {
            if (connection.readyState === WebSocket.OPEN) {
                if (!sawReady || !deliveredFrame) void recordBrowserWorkerLogs(containerId, route, id)
                void logBrowserRunClosure(id, sawReady, deliveredFrame, sawTerminalMessage, code, reason)
                if (sawReady) {
                    void finishBrowserRun(id, 'ended')
                    connection.close()
                } else {
                    void logBrowserRunFailure(id, 'worker_closed_before_ready', closeMessage(code, reason))
                    void finishBrowserRun(id, 'failed')
                    sendErrorThenClose(connection, 'Isolated browser worker closed before completing the run.')
                }
            } else closeBoth()
        })
        upstream.on('error', error => {
            void recordWebsocketFailure(`browser-session-upstream-${route}`, id, error)
            void logBrowserRunFailure(id, 'worker_connection_error', error instanceof Error ? error.message : String(error))
            void finishBrowserRun(id, 'failed')
            if (connection.readyState === WebSocket.OPEN) sendErrorThenClose(connection, `Isolated browser worker connection failed: ${error instanceof Error ? error.message : String(error)}`)
            else closeBoth()
        })
    }
}
