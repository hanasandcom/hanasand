import run from '#db'
import { getRuntimeContainerLogs } from '#utils/docker/engine.ts'
import recordLog from '#utils/logs/recordLog.ts'
import type { BrowserProviderRunResult } from '../../handlers/browserSandboxRuns.ts'
import { browserRunLogContexts, type BrowserRunLogContext } from './state.ts'

export function providerRunResultValue(analysis: any, error = ''): BrowserProviderRunResult | null {
    if (analysis?.toolKind === 'virustotal') {
        const total = Number(analysis.vendorTotal)
        if (!Number.isFinite(total) || total <= 0) return null
        const flagged = Number.isFinite(Number(analysis.vendorFlagged)) ? Number(analysis.vendorFlagged) : 0
        return { status: flagged > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: `${flagged}/${total} VT` }
    }
    if (analysis?.toolKind === 'urlquery') {
        const alerts = Number(analysis.alertCount)
        if (!Number.isFinite(alerts)) return null
        return { status: alerts > 0 ? 'suspicious' : error ? 'blocked' : 'clean', label: alerts > 0 ? `${alerts}` : 'urlquery' }
    }
    return null
}

export async function recordBrowserWorkerLogs(containerId: string, route: string, id: string) {
    const logs = await getRuntimeContainerLogs(containerId).catch(error => `Could not read browser worker logs: ${error instanceof Error ? error.message : String(error)}`)
    if (!logs) return
    const context = await browserRunLogContext(id)
    const tail = logs.slice(-4000)
    await recordLog({
        level: 'warn',
        message: `Browser worker emitted logs before ${route} session ${context.target || id} closed.`,
        metadata: {
            category: 'browser_sandbox_worker',
            route,
            sessionId: id,
            containerId,
            logTail: tail,
            ...context,
        },
    }).catch(() => {})
}

export async function browserRunLogContext(id: string) {
    if (!id) return {}
    const result = await run('SELECT target, network, status FROM browser_runs WHERE id = $1 LIMIT 1', [id]).catch(() => null)
    const row = result?.rows?.[0]
    const cached = browserRunLogContexts.get(id) || {}
    return {
        ...cached,
        ...(row ? { target: row.target || cached.target || '', network: row.network || cached.network || '', runStatus: row.status || cached.runStatus || '' } : {}),
    }
}

export function rememberBrowserRunPayload(id: string, payload: any) {
    if (!payload || typeof payload !== 'object') return
    if (payload.type === 'frame') {
        const current = browserRunLogContexts.get(id)
        rememberBrowserRunLogContext(id, {
            lastUrl: typeof payload.url === 'string' ? payload.url : current?.lastUrl,
            framesDelivered: (current?.framesDelivered || 0) + 1,
        })
        return
    }
    if (typeof payload.url === 'string') rememberBrowserRunLogContext(id, { lastUrl: payload.url })
    if (typeof payload.target === 'string') rememberBrowserRunLogContext(id, { target: payload.target })
}

export function rememberBrowserRunLogContext(id: string, context: BrowserRunLogContext) {
    if (!id) return
    const current = browserRunLogContexts.get(id) || {}
    browserRunLogContexts.set(id, { ...current, ...context })
    trimBrowserLogMap(browserRunLogContexts)
}

export function trimBrowserLogMap(map: Map<string, unknown>) {
    while (map.size > 1000) {
        const oldestKey = map.keys().next().value
        if (!oldestKey) return
        map.delete(oldestKey)
    }
}
