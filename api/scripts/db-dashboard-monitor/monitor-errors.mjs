export class MonitorFailure extends Error {
    constructor(reason, message, metrics) {
        super(message)
        this.reason = reason
        this.metrics = metrics
    }
}

export function normalizeFailure(error) {
    if (error instanceof MonitorFailure) {
        return { reason: error.reason, detail: error.message, metrics: error.metrics }
    }
    return {
        reason: 'db_dashboard_failed',
        detail: error instanceof Error ? error.message : String(error),
        metrics: {},
    }
}
