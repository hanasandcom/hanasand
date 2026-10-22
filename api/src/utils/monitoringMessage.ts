type MonitoringMessageContext = { monitorName?: string | null, targetUrl?: string | null }

function fieldLabel(path: string) {
    const known: Record<string, string> = {
        'current.alert': 'alert state',
        'summary.needsReportCount': 'incidents waiting for a first report',
        'collection.critical': 'collection status',
        'enrichment.critical': 'enrichment status',
        'host.cpuPercent': 'CPU use',
        'host.memoryPercent': 'RAM use',
        'host.gpus.*.usedPercent': 'GPU use',
        'host.storage.*.usedPercent': 'storage use',
        'host.temperatures.*.value': 'temperature',
        'host.temperatures.*.margin': 'temperature margin',
        'host.power.*.margin': 'power margin',
    }
    if (known[path]) return known[path]
    const leaf = path.split('.').filter(part => part !== '*').at(-1) || path
    return leaf.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()
}

function monitorName(context: MonitoringMessageContext) {
    return context.monitorName?.trim() || 'The health check'
}

function hostName(context: MonitoringMessageContext) {
    return /\bovh\b/i.test(context.monitorName || '') ? 'OVH host' : /\binspur\b/i.test(context.monitorName || '') ? 'Inspur host' : 'host'
}

function comparison(operator: string, observed: string, threshold: string, path: string, aggregate: string, context: MonitoringMessageContext) {
    const name = monitorName(context)
    if (context.targetUrl === 'system:ti-collection' && path === 'collection.critical') {
        return observed === 'true'
            ? 'TI source collection is overdue: no completed run is recorded within the five-minute freshness window. Check the scraper’s last run, source connectivity, and recent errors.'
            : 'TI source collection completed within its five-minute freshness window.'
    }
    if (context.targetUrl === 'system:ti-enrichment' && path === 'enrichment.critical') {
        return observed === 'true'
            ? 'TI evidence enrichment needs attention: the worker stopped or recorded an error. Check worker status, recent errors, and GPU availability.'
            : 'TI evidence enrichment is running without a recorded worker error.'
    }
    if (context.targetUrl === 'system:ti-delivery' && path === 'summary.needsReportCount') {
        return `TI delivery has ${observed} retained incidents waiting for a first report, above the alert limit of ${threshold}. Review the timeliness dashboard and report backlog.`
    }
    if (path === 'current.alert' && observed === 'true') {
        return `${name} reports an active alert. Review the latest check result and the affected component’s status.`
    }
    if (['collection.critical', 'enrichment.critical'].includes(path) && observed === 'true') {
        return `${name} reports a critical condition. Review the check’s latest details and the affected component’s recent activity.`
    }
    if (context.targetUrl === 'system:metrics') {
        const label = fieldLabel(path)
        const relation = operator === 'lt' || operator === 'lte' ? 'below' : operator === 'eq' ? 'at' : operator === 'ne' ? 'different from' : 'above'
        const reading = aggregateLabel(path, aggregate)
        const action = /storage|disk/i.test(label)
            ? 'Check disk growth and free space.'
            : /temperature|power/i.test(label)
                ? 'Check host cooling and device load.'
                : `Check ${hostName(context)} load and the processes using it.`
        return `${name}: ${reading} ${label} is ${observed}, ${relation} the alert limit of ${threshold}. ${action}`
    }
    const label = fieldLabel(path)
    if (typeof observed === 'boolean' && typeof threshold === 'boolean') {
        return `${name} reports ${label} ${observed ? 'active' : 'inactive'}; the configured alert value is ${threshold ? 'active' : 'inactive'}. Review the check’s source and expected state.`
    }
    const relation = operator === 'gt' ? 'above' : operator === 'gte' ? 'at or above' : operator === 'lt' ? 'below' : operator === 'lte' ? 'at or below' : operator === 'eq' ? 'equal to' : 'different from'
    const reading = aggregateLabel(path, aggregate)
    return `${name} reports ${reading} ${label} at ${observed}, ${relation} the configured alert value of ${threshold}. Check the monitor’s data source and target.`
}

function aggregateLabel(path: string, aggregate?: string) {
    if (aggregate === 'max') return 'maximum'
    if (aggregate === 'min') return 'minimum'
    if (aggregate === 'avg') return 'average'
    if (aggregate === 'first') return 'current'
    return path.includes('*') ? 'reported' : 'current'
}

function httpFailure(code: string, context: MonitoringMessageContext) {
    const name = monitorName(context)
    if (code === '401' || code === '403') return `${name} was rejected with HTTP ${code}. Check the monitor’s authentication and route permissions.`
    if (code === '404') return `${name} returned HTTP 404. Check the health-check URL and route.`
    if (code === '429') return `${name} was rate-limited with HTTP 429. Check the monitor interval and endpoint limits.`
    if (code === '503') return `${name} returned HTTP 503 in its health check. Check the endpoint and required dependencies.`
    return `${name} returned HTTP ${code}. Check the endpoint and its recent service logs.`
}

// Translate stored machine-generated output for cases, events, and Discord.
// Persisted evidence and user-authored comments remain unchanged.
export function readableMonitoringMessage(message: string, context: MonitoringMessageContext = {}): string {
    const http = /^JSON source returned HTTP (\d{3})\.$/.exec(message)
    if (http) return httpFailure(http[1], context)

    const json = /^JSON (check passed|threshold exceeded): ([\w*.-]+) = ([\s\S]*); alert (gt|gte|lt|lte|eq|ne) ([\s\S]*) \((first|max|min|avg)\)\.$/.exec(message)
    if (json) {
        const [, outcome, path, observed, operator, threshold, aggregate] = json
        if (path === 'ok' && aggregate === 'first' && ['true', 'false'].includes(observed)) {
            if (outcome === 'check passed' && observed === 'true') return 'The service reports that it is healthy.'
            return `The check ${outcome === 'check passed' ? 'passed' : 'failed'}. The service reports that it is ${observed === 'true' ? 'healthy' : 'unhealthy'}.`
        }
        if (outcome === 'check passed') {
            const label = fieldLabel(path)
            return `${monitorName(context)} is within its configured limit: ${aggregateLabel(path, aggregate)} ${label} is ${observed}.`
        }
        return comparison(operator, observed, threshold, path, aggregate, context)
    }

    const legacyHost = /^(RAM|CPU|GPU|Storage) usage is high: ([\d.]+)% used \(alert at ([\d.]+)%\)\.$/.exec(message)
    if (legacyHost) {
        const [, metric, observed, threshold] = legacyHost
        const label = context.monitorName?.trim() || `${hostName(context)} ${metric}`
        const action = metric === 'Storage' ? 'Find growing data and free space or expand the volume.'
            : metric === 'GPU' ? 'Check active GPU jobs and reduce sustained load.'
                : metric === 'RAM' ? 'Check memory-heavy processes and reduce sustained use.'
                    : 'Check the processes driving sustained CPU load.'
        return `${label} is high: ${observed}% used (alert limit ${threshold}%). ${action}`
    }

    const timeout = /^(?:Monitoring request timed out after (.+?)\.|Connection timed out after (.+?)\.) Failed after (\d+) attempts?\.$/.exec(message)
    if (timeout) {
        const duration = timeout[1] || timeout[2]
        return `${monitorName(context)} did not respond within ${duration} after ${timeout[3]} attempts. Check connectivity and target response time.`
    }
    if (/^Monitoring request timed out after (.+?)\.$/.test(message)) {
        const duration = /^Monitoring request timed out after (.+?)\.$/.exec(message)![1]
        return `${monitorName(context)} did not respond within ${duration}. Check connectivity and target response time.`
    }
    if (/^Connection failed: Connection refused/.test(message)) return `${monitorName(context)} could not connect to the target. Check that it is listening and reachable from the monitoring service.`
    if (/^TLS certificate validation failed for ([\w.-]+)\.$/.test(message)) {
        const hostname = /^TLS certificate validation failed for ([\w.-]+)\.$/.exec(message)![1]
        return `${monitorName(context)} could not verify the TLS certificate for ${hostname}. Check certificate validity and hostname configuration.`
    }
    return message
}
