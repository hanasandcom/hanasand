import type WebSocket from 'ws'
import { browserPaidExtensionAllowed } from '../browserSandboxRuns.ts'
import { browserViewportForMessage } from './browserProfile.ts'
import { fullscreenBrowserPage, resizeBrowserDisplay } from './networkEvidence.ts'
import { DEFAULT_TARGET, type BrokerMessage } from './protocol.ts'
import type { SessionState } from './sessionState.ts'

type SessionMessageHandlerDependencies = {
    state: SessionState
    connection: WebSocket
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    startBrowser: (message: BrokerMessage) => Promise<void>
    cleanup: () => Promise<void>
    extendRun: (extension: BrokerMessage['extension'], paidAuthorized: boolean) => void
    navigate: (value: string) => Promise<void>
    sendFrame: (force: boolean, reason?: string) => Promise<void>
    scheduleInteractionFrame: () => void
    handlePointer: (message: BrokerMessage) => Promise<void>
    handleWheel: (message: BrokerMessage) => Promise<void>
    handleKey: (message: BrokerMessage) => Promise<void>
    readRemoteClipboard: () => Promise<string>
}

export function createSessionMessageHandler({ state, connection, sessionId, send, startBrowser, cleanup, extendRun, navigate, sendFrame, scheduleInteractionFrame, handlePointer, handleWheel, handleKey, readRemoteClipboard }: SessionMessageHandlerDependencies) {
    async function handleMessage(message: BrokerMessage & { type: string }) {
        if (message.type === 'start') {
            await startBrowser(message)
            return
        }

        if (message.type === 'end') {
            send({ type: 'ended', sessionId })
            await cleanup()
            connection.close()
            return
        }

        if (message.type === 'extend') {
            extendRun(message.extension, process.env.BROWSER_SANDBOX_SKIP_RUN_DB === '1'
                ? message.paidAuthorized === true
                : Boolean(state.currentRunId && await browserPaidExtensionAllowed(state.currentRunId)))
            return
        }

        if (!state.page) {
            send({ type: 'status', state: 'waiting_for_start' })
            return
        }

        if (message.type === 'pointer' || message.type === 'click') {
            await handlePointer(message)
            if (message.type === 'click' || message.event !== 'pointermove' || message.buttons) scheduleInteractionFrame()
            return
        }

        if (message.type === 'wheel') {
            await handleWheel(message)
            scheduleInteractionFrame()
            return
        }

        if (message.type === 'key') {
            await handleKey(message)
            scheduleInteractionFrame()
            return
        }

        if (message.type === 'navigate') {
            await navigate(message.target || DEFAULT_TARGET)
            return
        }

        if (message.type === 'clipboard') {
            if (message.direction === 'remote-to-browser') {
                const text = await readRemoteClipboard()
                send({ type: 'clipboard', direction: 'remote-to-browser', ok: true, text })
            } else {
                state.remoteClipboard = String(message.text || '')
                await state.page.evaluate((text) => navigator.clipboard?.writeText?.(text).catch(() => undefined), state.remoteClipboard).catch(() => undefined)
                send({ type: 'clipboard', direction: 'browser-to-remote', ok: true })
            }
            return
        }

        if (message.type === 'resize') {
            const viewport = browserViewportForMessage(message)
            if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') {
                await resizeBrowserDisplay(viewport)
                await fullscreenBrowserPage(state.context!, state.page)
            } else {
                await state.page.setViewportSize(viewport)
            }
            await sendFrame(true)
        }
    }

    return handleMessage
}
