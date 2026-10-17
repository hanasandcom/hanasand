type PollOptions = {
    intervalMs: number
    maxRetryMs: number
    initialDelayMs?: number
    timeoutMs?: number
    allowTerminalRefresh?: boolean
}

export function startVMPolling(
    poll: (signal: AbortSignal) => Promise<boolean>,
    { intervalMs, maxRetryMs, initialDelayMs = 0, timeoutMs = 12_000, allowTerminalRefresh = false }: PollOptions,
) {
    let disposed = false
    let stopped = false
    let busy = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    const schedule = (delayMs: number) => {
        timer = setTimeout(() => void run(), delayMs)
    }

    async function run() {
        if (disposed || stopped || busy || document.visibilityState === 'hidden') return
        clearTimeout(timer)
        busy = true
        const requestController = new AbortController()
        controller = requestController
        const timeout = setTimeout(() => requestController.abort(), timeoutMs)
        let delay = intervalMs
        try {
            if (await poll(requestController.signal)) failures = 0
            else stopped = true
        } catch {
            delay = Math.min(maxRetryMs, 2_000 * 2 ** Math.min(failures++, 4))
        } finally {
            clearTimeout(timeout)
            busy = false
            if (!disposed && !stopped) schedule(delay)
        }
    }

    const refresh = () => {
        if (stopped && allowTerminalRefresh) stopped = false
        void run()
    }
    const dispose = () => {
        disposed = true
        clearTimeout(timer)
        controller?.abort()
        window.removeEventListener('focus', refresh)
        window.removeEventListener('online', refresh)
        document.removeEventListener('visibilitychange', refresh)
    }

    if (initialDelayMs) schedule(initialDelayMs)
    else refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)

    return { refresh, dispose }
}
