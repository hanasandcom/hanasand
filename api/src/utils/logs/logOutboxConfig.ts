export function logsOutboxEnabled() {
    return process.env.LOGS_OUTBOX_ENABLED === '1'
}

export function logsServiceConfiguration() {
    return {
        url: process.env.LOGS_SERVICE_URL?.replace(/\/$/, ''),
        ingestToken: process.env.LOGS_SERVICE_INGEST_TOKEN,
        syncToken: process.env.LOGS_SERVICE_SYNC_TOKEN,
    }
}
