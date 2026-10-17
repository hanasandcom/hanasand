import WebSocket from 'ws'
import { removeRuntimeContainer } from '#utils/docker/engine.ts'
import { connectResumableWorker } from '#utils/ws/resumableWorker.ts'
import { requestBrowserAdmission, trackBrowserAdmissionRelease } from '../../utils/ws/browserAdmission.ts'
import { finishBrowserRun } from '../../handlers/browserSandboxRuns.ts'
import { logBrowserRunFailure } from './browserRunLogging.ts'
import { recordWebsocketFailure, sendErrorThenClose, sendStatus } from './protocol.ts'
import { browserWarmPool, assertBrowserWorkerEgress, startEphemeralBrowserWorker } from './browserWarmPool.ts'
import { announceBrowserStream } from './browserStreamRuntime.ts'
import { browserStreams } from './state.ts'

type WorkerRoute = 'browser' | 'browser-sandbox' | 'onion-session'

type LaunchContext = {
    id: string
    route: WorkerRoute
    connection: WebSocket
    startup: AbortController
    workerResumeToken: string
    streamToken: string
    resolution: string
    regular: boolean
    isClosed(): boolean
    setContainerId(id: string): void
    setStreamMetricsTimer(timer: NodeJS.Timeout | null): void
    setAdmissionCleanup(cancel: () => void, release: ReturnType<typeof trackBrowserAdmissionRelease>): void
    onConnected(upstream: WebSocket): void
    onFailure(error: unknown): void
}

export function launchBrowserWorker(context: LaunchContext) {
    const { id, route, connection } = context
    if (context.isClosed()) return
    const admission = requestBrowserAdmission(id, payload => {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify(payload))
    })
    context.setAdmissionCleanup(admission.cancel, trackBrowserAdmissionRelease(admission.promise, context.isClosed))

    void admission.promise.then(async slot => {
        if (context.isClosed()) {
            slot.release()
            return null
        }
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({
            type: 'status', state: 'capacity_admitted', capacity: slot.status,
            message: 'Sandbox capacity is available. Starting this browser.',
        }))
        assertBrowserWorkerEgress()
        const warm = context.regular ? await browserWarmPool.take(id).catch(error => {
            console.error('Browser pool claim failed; starting a fresh worker:', error instanceof Error ? error.message : String(error))
            return null
        }) : null
        if (warm) {
            sendStatus(connection, 'worker_prestarted', 'Reserved a ready browser.')
            return warm
        }
        sendStatus(connection, 'launching_worker', 'Starting isolated browser worker.')
        return startEphemeralBrowserWorker(id, context.resolution)
    }).then(worker => {
        if (!worker) return null
        if (context.isClosed()) {
            void removeRuntimeContainer(worker.containerId).catch(() => undefined)
            return null
        }
        context.setContainerId(worker.containerId)
        browserStreams.set(id, {
            token: context.streamToken,
            ip: worker.streamIp,
            containerId: worker.containerId,
            expiresAt: Date.now() + 65 * 60_000,
        })
        void announceBrowserStream(connection, id, context.streamToken, worker.streamIp).then(timer => {
            if (context.isClosed() && timer) clearInterval(timer)
            else context.setStreamMetricsTimer(timer)
        })
        return connectResumableWorker(
            `${worker.wsUrl.replace(/\/$/, '')}/${route}/${encodeURIComponent(id)}`,
            context.startup.signal,
            context.workerResumeToken,
        )
    }).then(upstream => {
        if (!upstream) return
        if (context.isClosed()) {
            upstream.close()
            return
        }
        context.onConnected(upstream)
    }).catch(context.onFailure)
}

export function handleBrowserWorkerStartFailure(error: unknown, session: { connection: WebSocket; route: string; id: string; closeBoth(): void; runPrepared: boolean }) {
    const message = error instanceof Error ? error.message : String(error)
    if (session.connection.readyState === WebSocket.OPEN) sendErrorThenClose(session.connection, `Failed to start isolated browser worker: ${message}`)
    else session.closeBoth()
    void recordWebsocketFailure(`browser-session-create-${session.route}`, session.id, error)
    void logBrowserRunFailure(session.id, 'worker_start_failed', message)
    if (session.runPrepared) void finishBrowserRun(session.id, 'failed')
}
