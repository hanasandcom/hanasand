import { capacityValue, quotaValue, stringValue } from '../browserValues'
import { cleanConsoleEvent, isDegradedNavigationError } from '../browserRunData'
import type { BrowserSocketMessageContext } from './browserSocketMessageTypes'

export function handleBrowserStatusMessage(context: BrowserSocketMessageContext) {
    const { payload, socket, runState, override, replaceSandbox, pushEvent, pushConsoleEvent, setStartupStage, setActiveUrl, setCapacity, setQuota, setSessionState, setRunBlocker } = context

    if (payload.type === 'status') {
        const statusState = stringValue(payload.state)
        const stage = ['launching_worker', 'worker_connected', 'launching'].includes(statusState) ? 1
            : ['navigating', 'navigated'].includes(statusState) ? 2
                : ['domcontentloaded', 'loaded'].includes(statusState) ? 3 : 0
        setStartupStage(current => Math.max(current, stage))
        const nextCapacity = capacityValue(payload.capacity)
        if (nextCapacity) setCapacity(nextCapacity)
        const nextQuota = quotaValue(payload.quota)
        if (nextQuota) setQuota(nextQuota)
        if (statusState === 'capacity_busy' || statusState === 'capacity_queue_position') {
            setSessionState('queued')
        } else if (statusState === 'capacity_admitted' || statusState === 'launching') {
            setSessionState('connecting')
        } else if (['quota_exhausted', 'concurrency_limit', 'identity_required', 'run_exists', 'unsafe_target_blocked'].includes(statusState)) {
            setSessionState('failed')
            if (override?.recovery && statusState === 'concurrency_limit') { replaceSandbox(); return }
            runState.receivedEnd = true
            socket.close()
            setRunBlocker(String(payload.message || 'Browser run limit reached.'))
        } else if (statusState === 'failed') {
            replaceSandbox()
            return
        }
        if (payload.url && payload.source !== 'provider') setActiveUrl(String(payload.url))
        pushEvent(String(payload.message || payload.state || 'Browser status updated.'))
        return
    }
    if (payload.type === 'console' || payload.type === 'pageerror') {
        const text = stringValue(payload.text) || stringValue(payload.message)
        const provider = payload.source === 'provider' || (payload.source !== 'target' && /^\[(?:VirusTotal|urlquery|WebCrack)\]/i.test(text))
        const level = stringValue(payload.level) || (payload.type === 'pageerror' ? 'error' : 'log')
        const location = stringValue(payload.url)
        const name = provider && payload.name ? `[${stringValue(payload.name)}] ` : ''
        pushConsoleEvent(`${name}[${level}] ${cleanConsoleEvent(text)}${location ? ` (${location}${payload.line ? `:${payload.line}` : ''})` : ''}`, provider)
        return
    }
    if (payload.type === 'navigation_error' || payload.type === 'error') {
        if (payload.type === 'error') {
            runState.receivedEnd = true
            socket.close(false)
            setSessionState('failed')
            setRunBlocker(String(payload.message || 'The isolated browser could not start.'))
            pushEvent(String(payload.message || 'The isolated browser could not start.'))
            return
        }
        if (payload.type === 'navigation_error' && runState.receivedPageFrame) {
            pushEvent('Navigation timed out after the target page had already loaded.')
            return
        }
        if (payload.type === 'navigation_error' && isDegradedNavigationError(stringValue(payload.message))) {
            runState.receivedEnd = true
            runState.navigationFailed = true
            setSessionState('unreachable')
            setRunBlocker(String(payload.message || 'Target navigation did not complete; showing captured browser/provider evidence.'))
            pushEvent(String(payload.message || 'Target navigation did not complete; showing captured browser/provider evidence.'))
            return
        }
        runState.receivedEnd = true
        socket.close()
        setSessionState('failed')
        setRunBlocker(String(payload.message || 'Sandbox navigation failed.'))
        pushEvent(String(payload.message || 'Sandbox navigation failed.'))
    }
}
