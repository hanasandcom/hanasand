import type WebSocket from 'ws'
import { createHash } from 'node:crypto'
import type { Page } from 'playwright'
import { withTimeout } from './asyncOperations.ts'
import { collectPageEvidence, emptyPageEvidence } from './pageEvidence.ts'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from './browserRuntime.ts'
import type { SessionState } from './sessionState.ts'
import type { SandboxDeobfuscationTask } from './providerTypes.ts'
import recordLog from '#utils/logs/recordLog.ts'

type FrameCaptureDependencies = {
    state: SessionState
    connection: WebSocket
    sessionId: string
    send: (payload: Record<string, unknown>) => void
    networkSummary: () => Record<string, unknown>
    trace: (event: string, detail?: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    scheduleInteractionFrame: (generation?: number) => void
    maybeExtendSuspiciousRun: (evidence?: { verdict?: string } | null, analysis?: import('./providerTypes.ts').SandboxToolAnalysis | null, generation?: number) => void
    rememberDeobfuscationTasks: (evidence: { deobfuscationTasks?: SandboxDeobfuscationTask[] } | null) => void
}

export function createFrameCaptureService({ state, connection, sessionId, send, networkSummary, trace, isCurrentRun, scheduleInteractionFrame, maybeExtendSuspiciousRun, rememberDeobfuscationTasks }: FrameCaptureDependencies) {
    async function sendFrame(force: boolean, reason = 'interval', generation = state.runGeneration) {
        const framePage = state.page
        if (!framePage || !isCurrentRun(generation) || connection.readyState !== connection.OPEN) return
        if (!force && state.fastFrameInFlight) {
            if (reason === 'interaction') scheduleInteractionFrame(generation)
            return
        }
        state.fastFrameInFlight = !force
        if (!state.lastFrame && !state.firstFrameAttemptedAt) state.firstFrameAttemptedAt = Date.now()
        try {
            const buffer = await withTimeout(framePage.screenshot({ type: 'jpeg', quality: 68, animations: 'disabled', timeout: 2_000 }), 2_200, null)
            if (!isCurrentRun(generation) || state.page !== framePage) return
            if (!buffer) {
                trace('frame_capture_timeout', { reason })
                if (state.lastFrame || Date.now() - state.firstFrameAttemptedAt < 15_000) return
                send({ type: 'status', state: 'frame_capture_failed', sessionId, reason, message: 'Browser frame capture timed out.' })
                return
            }
            const image = buffer.toString('base64')
            if (!force && reason !== 'interaction' && image === state.lastFrame) return
            state.lastFrame = image
            const viewport = framePage.viewportSize()
            const heavyFrame = reason !== 'interaction' && (force || !state.cachedPageEvidence || Date.now() - state.lastHeavyFrameAt > 5_000)
            let frameQuality = state.cachedFrameQuality
            let evidence = state.cachedPageEvidence
            if (heavyFrame) {
                frameQuality = await withTimeout(collectFrameQuality(framePage, viewport?.width || DEFAULT_WIDTH, viewport?.height || DEFAULT_HEIGHT), 1_200, state.cachedFrameQuality || {
                    looksBlank: false,
                    visibleTextLength: 0,
                    elementCount: 0,
                    visibleMedia: 0,
                    bodyHeight: 0,
                    viewportWidth: viewport?.width || DEFAULT_WIDTH,
                    viewportHeight: viewport?.height || DEFAULT_HEIGHT,
                })
                evidence = await withTimeout(collectPageEvidence(framePage), 1_800, state.cachedPageEvidence || emptyPageEvidence())
                if (!isCurrentRun(generation) || state.page !== framePage) return
                if (!evidence.deobfuscationTasks.length && state.cachedDeobfuscationTasks.length) {
                    evidence.deobfuscationTasks = state.cachedDeobfuscationTasks
                    evidence.obfuscatedScripts = state.cachedDeobfuscationTasks.map(task => ({
                        id: task.scriptId || 'cached_script',
                        src: task.source || 'inline',
                        inlineBytes: Buffer.byteLength(task.sample || task.decodedPreview || ''),
                        obfuscationScore: 3,
                        reasons: ['cached from document HTML'],
                        sample: task.sample || task.decodedPreview || '',
                        sha256: task.sha256 || createHash('sha256').update(task.source || task.sample || task.decodedPreview || '').digest('hex'),
                    }))
                }
                if (state.cachedThreatAssociations.length && !evidence.threatAssociations.length) evidence.threatAssociations = state.cachedThreatAssociations
                if (state.cachedIndicators) {
                    evidence.indicators = {
                        domains: Array.from(new Set([...evidence.indicators.domains, ...state.cachedIndicators.domains])).slice(0, 80),
                        ips: Array.from(new Set([...evidence.indicators.ips, ...state.cachedIndicators.ips])).slice(0, 80),
                        urls: Array.from(new Set([...evidence.indicators.urls, ...state.cachedIndicators.urls])).slice(0, 80),
                    }
                }
                rememberDeobfuscationTasks(evidence)
                maybeExtendSuspiciousRun(evidence)
                state.cachedFrameQuality = frameQuality
                state.cachedPageEvidence = evidence
                state.lastHeavyFrameAt = Date.now()
            }
            const title = await framePage.title().catch(() => '')
            if (!isCurrentRun(generation) || state.page !== framePage) return
            send({
                type: 'frame',
                encoding: 'jpeg',
                image,
                width: viewport?.width || DEFAULT_WIDTH,
                height: viewport?.height || DEFAULT_HEIGHT,
                sessionId,
                url: framePage.url(),
                title,
                capturedAt: new Date().toISOString(),
                reason,
                frameQuality,
                evidence,
                networkSummary: networkSummary(),
            })
            trace('frame_sent', { reason, url: framePage.url(), bytes: buffer.length })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!isCurrentRun(generation)) return
            if (state.lastFrame || Date.now() - state.firstFrameAttemptedAt < 15_000) {
                trace('frame_capture_error', { reason, message })
                return
            }
            send({ type: 'status', state: 'frame_capture_failed', sessionId, reason, message })
            void recordLog({
                level: 'warn',
                service: 'hanasand-api',
                message: `Browser frame capture failed for ${sessionId}: ${message}`,
                metadata: { category: 'browser_sandbox_frame', sessionId, reason },
            }).catch(() => undefined)
        } finally {
            if (isCurrentRun(generation)) state.fastFrameInFlight = false
        }
    }

    async function collectFrameQuality(targetPage: Page, viewportWidth: number, viewportHeight: number) {
        return await targetPage.evaluate(({ viewportWidth, viewportHeight }) => {
            const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
            const elementCount = document.body ? document.body.querySelectorAll('*').length : 0
            const bodyHeight = Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0,
            )
            const visibleMedia = document.querySelectorAll('img, video, canvas, svg, picture').length
            const looksBlank = text.length < 20 && elementCount < 5 && visibleMedia === 0
            return {
                looksBlank,
                visibleTextLength: text.length,
                elementCount,
                visibleMedia,
                bodyHeight,
                viewportWidth,
                viewportHeight,
            }
        }, { viewportWidth, viewportHeight }).catch(() => ({
            looksBlank: true,
            visibleTextLength: 0,
            elementCount: 0,
            visibleMedia: 0,
            bodyHeight: 0,
            viewportWidth,
            viewportHeight,
        }))
    }

    return { sendFrame, collectFrameQuality }
}
