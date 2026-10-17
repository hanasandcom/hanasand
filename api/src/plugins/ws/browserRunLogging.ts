import recordLog from '#utils/logs/recordLog.ts'
import { browserRunFailureLogTimes, browserRunUnreachableLogTimes, browserRunWarningLogTimes } from './state.ts'
import { browserRunLogContext, trimBrowserLogMap } from './browserRunContext.ts'
import { closeMessage } from './protocol.ts'

export async function logBrowserRunWarning(id: string, reason: string, message: unknown) {
    const key = `${id}:${reason}`
    const now = Date.now()
    const last = browserRunWarningLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunWarningLogTimes.set(key, now)
    if (browserRunWarningLogTimes.size > 1000) {
        const oldestKey = browserRunWarningLogTimes.keys().next().value
        if (oldestKey) browserRunWarningLogTimes.delete(oldestKey)
    }
    const text = typeof message === 'string' && message ? message : reason
    const context = await browserRunLogContext(id)
    console.warn(JSON.stringify({ level: 'warn', category: 'browser_run_warning', sessionId: id, reason, message: text, ...context }))
    await recordLog({
        level: 'warn',
        message: `Browser run warning for ${context.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_warning',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...context,
        },
    }).catch(() => undefined)
}

export async function logBrowserRunFailure(id: string, reason: string, message: unknown) {
    const text = typeof message === 'string' && message ? message : reason
    const key = `${id}:${text}`
    const now = Date.now()
    const last = browserRunFailureLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunFailureLogTimes.set(key, now)
    trimBrowserLogMap(browserRunFailureLogTimes)
    const context = await browserRunLogContext(id)
    console.warn(JSON.stringify({ level: 'warn', category: 'browser_run_failed', sessionId: id, reason, message: text, ...context }))
    await recordLog({
        level: 'warn',
        message: `Browser run failed for ${context.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_failed',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...context,
        },
    }).catch(() => undefined)
}

export async function logBrowserRunUnreachable(id: string, reason: string, message: unknown) {
    const text = typeof message === 'string' && message ? message : reason
    const key = `${id}:${text}`
    const now = Date.now()
    const last = browserRunUnreachableLogTimes.get(key) || 0
    if (now - last < 60_000) return
    browserRunUnreachableLogTimes.set(key, now)
    trimBrowserLogMap(browserRunUnreachableLogTimes)
    const context = await browserRunLogContext(id)
    const unreachableContext = { ...context, runStatus: 'unreachable' }
    console.info(JSON.stringify({ level: 'info', category: 'browser_run_unreachable', sessionId: id, reason, message: text, ...unreachableContext }))
    await recordLog({
        level: 'info',
        message: `Browser target unreachable for ${unreachableContext.target || id}: ${text}`,
        metadata: {
            category: 'browser_run_unreachable',
            sessionId: id,
            reason,
            workerMessage: typeof message === 'string' ? message : '',
            ...unreachableContext,
        },
    }).catch(() => undefined)
}

export async function logBrowserRunClosure(id: string, sawReady: boolean, deliveredFrame: boolean, sawTerminalMessage: boolean, code: number, reason: Buffer) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: deliveredFrame ? 'info' : 'warn',
        message: `Browser worker closed for ${context.target || id}${deliveredFrame ? '' : ' before a frame was delivered'}: ${reasonText}.`,
        metadata: {
            category: 'browser_run_closed',
            sessionId: id,
            sawReady,
            deliveredFrame,
            sawTerminalMessage,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}

export async function logBrowserClientClosure(id: string, code: number, reason: Buffer, sawReady: boolean, deliveredFrame: boolean) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: 'warn',
        message: `Browser client disconnected before the worker completed ${context.target || id}: ${reasonText}.`,
        metadata: {
            category: 'browser_run_client_closed',
            sessionId: id,
            sawReady,
            deliveredFrame,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}

export async function logBrowserStreamClosure(id: string, code: number, reason: Buffer) {
    const reasonText = closeMessage(code, reason)
    const context = await browserRunLogContext(id)
    await recordLog({
        level: 'warn',
        message: `Browser WebRTC signalling disconnected unexpectedly for ${context.target || id}: ${reasonText}.`,
        metadata: {
            category: 'browser_stream_disconnected',
            sessionId: id,
            closeCode: code,
            closeReason: reasonText,
            ...context,
        },
    }).catch(() => undefined)
}
