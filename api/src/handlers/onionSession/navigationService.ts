import { createHash } from 'node:crypto'
import { finishBrowserRun } from '../browserSandboxRuns.ts'
import { sandboxRequestSafety } from './sandboxSafety.ts'
import type { SessionState } from './sessionState.ts'
import recordLog from '#utils/logs/recordLog.ts'
import { normalizeTarget } from './protocol.ts'

type NavigationServiceDependencies = {
    state: SessionState
    sessionId: string
    defaultNetwork: 'tor' | 'regular'
    send: (payload: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    sendFrame: (force: boolean, reason?: string, generation?: number) => Promise<void>
    queueDocumentEvidence: (body: Promise<string>, generation: number) => Promise<void>
}

export function createNavigationService({ state, sessionId, defaultNetwork, send, isCurrentRun, sendFrame, queueDocumentEvidence }: NavigationServiceDependencies) {
    function markTargetUnreachable(target: string, message: string) {
        state.terminalRunStatus = 'unreachable'
        if (state.currentRunId) void finishBrowserRun(state.currentRunId, 'unreachable').catch(() => undefined)
        void recordLog({
            level: 'info',
            service: 'hanasand-api',
            message: `Browser target unreachable for ${target}: ${message}`,
            metadata: {
                category: 'browser_run_unreachable',
                sessionId,
                target,
                network: state.network || defaultNetwork,
                runId: state.currentRunId,
                workerMessage: message,
                runStatus: 'unreachable',
            },
        }).catch(() => undefined)
    }

    async function navigate(value: string, generation = state.runGeneration) {
        if (!state.page) return
        const target = normalizeTarget(value)
        const safety = await sandboxRequestSafety(target, state.network || defaultNetwork)
        if (!isCurrentRun(generation)) return
        if (!safety.ok) {
            send({ type: 'navigation_error', target, message: `Blocked unsafe sandbox target: ${safety.reason}.` })
            send({ type: 'status', state: 'unsafe_target_blocked', url: target, message: `Blocked unsafe sandbox target: ${safety.reason}.` })
            return
        }
        send({ type: 'status', state: 'navigating', target })
        const heartbeat = setInterval(() => {
            if (isCurrentRun(generation)) send({ type: 'status', state: 'navigating', target, message: 'Navigation is still pending.' })
        }, 5_000)
        // Tor sites often render useful content without firing DOMContentLoaded.
        // Treat the response commit as navigation success and let frames/evidence
        // continue arriving while the page finishes rendering.
        const response = await state.page.goto(target, { waitUntil: 'commit', timeout: 25_000 })
            .catch((error) => {
                if (!isCurrentRun(generation)) return null
                const message = error instanceof Error ? error.message : String(error)
                const targetHash = createHash('sha256').update(target).digest('hex')
                if (/Download is starting/i.test(message) || state.downloadTargets.has(targetHash)) return null
                markTargetUnreachable(target, message)
                send({ type: 'navigation_error', target, message })
                return null
            })
            .finally(() => clearInterval(heartbeat))
        if (!isCurrentRun(generation)) return
        if (response && /html/i.test(response.headers()['content-type'] || '')) {
            await queueDocumentEvidence(response.text(), generation)
        }
        void sendFrame(true, 'interval', generation)
    }
    return { navigate }
}
