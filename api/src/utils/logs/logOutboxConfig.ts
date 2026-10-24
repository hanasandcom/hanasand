export function logsOutboxEnabled() {
    return process.env.LOGS_OUTBOX_ENABLED === '1'
}

export function logsOutboxRemoteOnly() {
    return process.env.LOGS_OUTBOX_REMOTE_ONLY === '1'
}

export function logsServiceDirect() {
    return process.env.LOGS_SERVICE_DIRECT === '1'
}

export function shouldRunLegacyLogProcessing() {
    return !logsOutboxRemoteOnly()
}

export function shouldRunLogsServiceBackgroundTasks() {
    return logsOutboxEnabled()
        && (process.env.API_HTTP_ONLY !== '1' || process.env.DEPLOYMENT_CANDIDATE_ONLY === '1')
}

export function assertRemoteLogsConfiguration() {
    if (logsServiceDirect() && !logsOutboxRemoteOnly()) {
        throw new Error('LOGS_SERVICE_DIRECT requires LOGS_OUTBOX_REMOTE_ONLY=1.')
    }
    if (!logsOutboxRemoteOnly()) return
    if (logsServiceDirect()) {
        const signingKey = process.env.LOGS_APPLICATION_LOG_HMAC_KEY
        if (!signingKey || Buffer.byteLength(signingKey) < 32) {
            throw new Error('Direct Logs delivery requires a valid LOGS_APPLICATION_LOG_HMAC_KEY.')
        }
    }
    if (!logsOutboxEnabled() && !logsServiceDirect()) {
        throw new Error('LOGS_OUTBOX_REMOTE_ONLY requires the durable outbox or LOGS_SERVICE_DIRECT=1.')
    }
    // Direct-only mode sends structured records to stdout; the independent host
    // collector owns durable queueing and authenticated Logs API delivery.
    if (!logsOutboxEnabled() && logsServiceDirect()) return
    const { url, ingestToken, syncToken } = logsServiceConfiguration()
    if (!url || !ingestToken || ingestToken.length < 32 || !syncToken || syncToken.length < 32) {
        throw new Error('Remote-only outbox delivery requires the Logs URL and valid ingest and sync tokens.')
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
