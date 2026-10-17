import type WebSocket from 'ws'
import { OnionSessionMessageQueue } from './messageQueue.ts'
import { parseMessage, type BrokerMessage } from './protocol.ts'
import type { SessionState } from './sessionState.ts'
import recordLog from '#utils/logs/recordLog.ts'

type SessionTransportDependencies = {
    state: SessionState
    connection: WebSocket
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    trace: (event: string, detail?: Record<string, unknown>) => void
    cleanup: () => Promise<void>
    handleMessage: (message: BrokerMessage & { type: string }) => Promise<void>
}

export function attachSessionTransport({ state, connection, sessionId, send, trace, cleanup, handleMessage }: SessionTransportDependencies) {
    const reportMessageError = (error: unknown) => {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    const messageQueue = new OnionSessionMessageQueue<BrokerMessage & { type: string }>(
        async message => {
            if (state.sessionEnding && message.type !== 'end') return
            await handleMessage(message)
        },
        reportMessageError,
    )

    connection.on('message', message => {
        if (state.sessionEnding) return
        const payload = parseMessage(message)
        if (!payload) return
        if (payload.type === 'end') state.sessionEnding = true
        if (state.cancelAdmissionWait && payload.type === 'end') {
            void handleMessage(payload).catch(reportMessageError)
            return
        }
        if (!messageQueue.enqueue(payload)) {
            state.sessionEnding = true
            send({ type: 'error', message: 'Too many browser commands are waiting. The session is closing.' })
            connection.close(1013, 'Too many queued browser commands.')
        }
    })
    connection.on('close', () => {
        state.sessionEnding = true
        trace('connection_close')
        void cleanup()
    })
    connection.on('error', error => {
        void recordLog({
            level: 'warn',
            service: 'hanasand-api',
            message: `Onion session websocket failed for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
            metadata: { category: 'websocket_failure', kind: 'onion-session', sessionId },
        }).catch(() => undefined)
    })
}
