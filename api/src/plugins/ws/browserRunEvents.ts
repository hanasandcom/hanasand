import type { RawData } from 'ws'
import { browserStartOptions } from '#utils/ws/browserAccess.ts'
import { prepareBrowserRun, finishBrowserRun, updateBrowserRunProviderResult } from '../../handlers/browserSandboxRuns.ts'
import WebSocket from 'ws'
import { parseSocketMessage } from './protocol.ts'
import { rememberBrowserRunPayload, rememberBrowserRunLogContext, providerRunResultValue } from './browserRunContext.ts'
import { logBrowserRunWarning, logBrowserRunFailure, logBrowserRunUnreachable } from './browserRunLogging.ts'

export async function prepareProxiedBrowserRun(id: string, message: RawData, connection: WebSocket) {
    const payload = parseSocketMessage(message)
    if (payload?.type !== 'start') return null
    const target = typeof payload.target === 'string' ? payload.target : ''
    const network = payload.network === 'tor' ? 'tor' : 'regular'
    rememberBrowserRunLogContext(id, { target, network })
    const result = await prepareBrowserRun({
        id,
        target,
        network,
        clientId: typeof payload.clientId === 'string' ? payload.clientId : undefined,
        userId: typeof payload.userId === 'string' ? payload.userId : undefined,
        sessionToken: typeof payload.sessionToken === 'string' ? payload.sessionToken : undefined,
    })
    if (result.allowed) {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'status', state: 'access_ready', quota: result.quota }))
        return browserStartOptions(payload, result.quota)
    }
    if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({
            type: 'status',
            state: result.reason,
            sessionId: id,
            network,
            quota: result.quota,
            message: result.reason === 'concurrency_limit' ? `You already have ${result.quota?.concurrentLimit} active browser${result.quota?.concurrentLimit === 1 ? '' : 's'}. Close a run${result.quota?.paid ? '' : ' or upgrade for three at once'}.` : 'Reload the browser page to start a new session.',
        }))
        connection.send(JSON.stringify({ type: 'ended', reason: result.reason, sessionId: id }))
        connection.close()
    }
    return null
}

export function persistBrowserProviderResult(id: string, message: RawData) {
    const payload = parseSocketMessage(message)
    if (payload?.type !== 'tool_capture') return
    const result = providerRunResultValue(payload.toolAnalysis, String(payload.error || ''))
    if (!result) return
    void updateBrowserRunProviderResult(id, String(payload.toolAnalysis.toolKind), result).catch(() => undefined)
}

export async function finishProxiedBrowserRun(id: string, message: RawData) {
    const payload = parseSocketMessage(message)
    rememberBrowserRunPayload(id, payload)
    if (payload?.type === 'status') {
        if (payload.state === 'frame_capture_failed') {
            await logBrowserRunWarning(id, 'frame_capture_failed', payload.message || payload.reason)
            return
        }
        const failureStates = new Set(['failed', 'unsafe_target_blocked', 'quota_exhausted'])
        if (failureStates.has(String(payload.state))) {
            await logBrowserRunFailure(id, `status_${String(payload.state)}`, payload.message || payload.url || payload.reason)
            if (payload.state === 'failed' || payload.state === 'unsafe_target_blocked' || payload.state === 'quota_exhausted') await finishBrowserRun(id, 'failed')
            return
        }
    }
    if (payload?.type === 'navigation_error') {
        await finishBrowserRun(id, 'unreachable')
        await logBrowserRunUnreachable(id, 'navigation_error', payload.message || payload.target)
        return
    }
    if (payload?.type === 'ended') {
        const failed = payload.reason === 'launch_failed' || payload.reason === 'quota_exhausted'
        if (failed) await logBrowserRunFailure(id, String(payload.reason), payload.message)
        await finishBrowserRun(id, failed ? 'failed' : 'ended')
    }
    if (payload?.type === 'error') {
        await logBrowserRunFailure(id, 'error', payload.message)
        await finishBrowserRun(id, 'failed')
    }
}
