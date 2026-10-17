export type VerificationJob = Record<string, any>

export const state = {
    jobs: new Map<string, VerificationJob>(),
    calls: [] as Array<{ sql: string, params: unknown[] }>,
    usageEvents: [] as Array<Record<string, any>>,
    fetchCalls: [] as Array<{
        url: string
        signal?: AbortSignal
        userAgent?: string
        accept?: string
        followRedirects?: boolean
        readBody?: boolean
        timeoutMs?: number
    }>,
    terminalAttempts: [] as string[],
    chromiumKillSignals: [] as string[],
    chromiumSpawnCount: 0,
    failChromiumStartup: true,
    onChromiumSpawn: null as (() => void) | null,
    nextFetchError: null as Error | null,
    nextFetchStatus: 200,
    cancelOnWorkerRead: false,
    loseTerminalTransition: false,
    existingErrorOnClaim: null as string | null,
    holdFetch: false,
    onFetchStarted: null as (() => void) | null,
    releaseFetch: null as ((response: { status: number, statusText: string, ok: boolean, url: string, body: string }) => void) | null,
    rejectFetch: null as ((error: Error) => void) | null,
    workerStatusReads: [] as string[],
}

export function resetVerificationJobState() {
    state.jobs.clear()
    state.calls.length = 0
    state.usageEvents.length = 0
    state.fetchCalls.length = 0
    state.terminalAttempts.length = 0
    state.chromiumKillSignals.length = 0
    state.chromiumSpawnCount = 0
    state.failChromiumStartup = true
    state.onChromiumSpawn = null
    state.workerStatusReads.length = 0
    state.nextFetchError = null
    state.nextFetchStatus = 200
    state.cancelOnWorkerRead = false
    state.loseTerminalTransition = false
    state.existingErrorOnClaim = null
    state.holdFetch = false
    state.onFetchStarted = null
    state.releaseFetch = null
    state.rejectFetch = null
}
