export function createQueuedRefresh(refreshTask: () => Promise<void>, isAborted: () => boolean) {
    let requestInFlight = false, refreshRequested = false
    const refresh = async () => {
        if (requestInFlight) { refreshRequested = true; return }
        requestInFlight = true
        try { await refreshTask() } catch { /* Keep the last known navigation state when refresh fails. */ }
        finally {
            requestInFlight = false
            if (refreshRequested && !isAborted()) { refreshRequested = false; void refresh() }
        }
    }
    return refresh
}
