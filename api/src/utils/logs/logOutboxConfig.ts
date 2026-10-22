export function logsOutboxEnabled() {
    return process.env.LOGS_OUTBOX_ENABLED === '1'
}

export function logsOutboxRemoteOnly() {
    return process.env.LOGS_OUTBOX_REMOTE_ONLY === '1'
}

export function shouldRunLegacyLogProcessing() {
    return !logsOutboxRemoteOnly()
}

export function assertRemoteLogsConfiguration() {
    if (!logsOutboxRemoteOnly()) return
    if (!logsOutboxEnabled()) {
        throw new Error('LOGS_OUTBOX_REMOTE_ONLY requires LOGS_OUTBOX_ENABLED=1.')
    }
    const { url, ingestToken, syncToken } = logsServiceConfiguration()
    if (!url || !ingestToken || ingestToken.length < 32 || !syncToken || syncToken.length < 32) {
        throw new Error('Remote-only log processing requires the Logs URL and valid ingest and sync tokens.')
    }
    try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error()
    } catch {
        throw new Error('Remote-only log processing requires a valid Logs service URL.')
    }
}

export function logsServiceConfiguration() {
    return {
        url: process.env.LOGS_SERVICE_URL?.replace(/\/$/, ''),
        ingestToken: process.env.LOGS_SERVICE_INGEST_TOKEN,
        syncToken: process.env.LOGS_SERVICE_SYNC_TOKEN,
    }
}
