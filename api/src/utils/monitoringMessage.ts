import { hostMetricsDataWarning } from './hostCheckMessage.ts'

type MonitoringMessageContext = { monitorName?: string | null, targetUrl?: string | null, timeoutSeconds?: number | null, jsonPayload?: unknown, formatUnknown?: boolean }

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
    if (path === 'current.alert' && observed === 'true') {
        const metrics = (context.jsonPayload as { current?: Record<string, unknown> } | undefined)?.current
        const thresholds = metrics?.thresholds as Record<string, unknown> | undefined
        if (thresholds && ['npps_below', 'eps_above', 'pps_below'].some(key => thresholds[key] === true)) {
            const conditions: string[] = []
            const add = (key: string, valueKey: string, label: string, relation: string, limit: string) => {
                if (thresholds[key] === true) conditions.push(`${label} ${String(metrics?.[valueKey] ?? 'unknown')} ${relation} ${limit}`)
            }
            add('npps_below', 'npps', 'NPPS (incoming load ÷ checked throughput)', 'below', '100×')
            add('eps_above', 'eps', 'incoming event rate', 'above', '100 events/s')
            add('pps_below', 'pps', 'processing rate', 'below', '200 logs/s')
            const remaining = typeof metrics?.remaining === 'number' ? ` Pending backlog: ${metrics.remaining}.` : ''
            return `Logs throughput is outside its configured limits: ${conditions.join('; ')}.${remaining} Check incoming traffic, processing workers, and the pending backlog.`
        }
        if (/log.*throughput/i.test(name)) {
            return 'Logs throughput has crossed a configured limit. This saved check contains only the alert flag, so the triggering rate and threshold are unavailable. Check Logs → Metrics for incoming rate, processing rate, and pending backlog.'
        }
    }
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
        return `${name} reports its current alert flag as active, but the saved result does not say what triggered it. Check the source’s detailed response and configured limits to identify the affected condition.`
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
    if (code === '401' || code === '403') return `${name} received HTTP ${code} from the target. Check access requirements for the health-check route.`
    if (code === '404') return `${name} received HTTP 404 from the target. Check the health-check route and deployment.`
    if (code === '429') return `${name} received HTTP 429 from the target. Check request limits and the monitor interval.`
    if (code === '503') return `${name} received HTTP 503 from the target. Check the endpoint and required dependencies.`
    if (Number(code) >= 500) return `${name} received HTTP ${code} from the target. Check the service and its recent logs.`
    return `${name} received HTTP ${code} from the target. Check the endpoint and its recent service logs.`
}

function monitoringError(message: string, context: MonitoringMessageContext) {
    const name = monitorName(context)
    const retries = / Failed after (\d+) attempts?\.$/i.exec(message)
    const attempts = retries ? ` after ${retries[1]} attempt${retries[1] === '1' ? '' : 's'}` : ''
    const detail = message.replace(/ Failed after \d+ attempts?\.$/i, '').trim()
    const retryNote = (sentence: string) => retries ? sentence.replace(/\.$/, `${attempts}.`) : sentence

    if (/^Monitoring is missing the URL to check\.$/.test(detail)) {
        return `${name} has no target URL configured. Add the health-check endpoint and check the monitor settings.`
    }
    if (/^Monitoring target URL is invalid\.$/.test(detail)) {
        return `${name} has an invalid target URL. Check the hostname, protocol, and port in the monitor settings.`
    }
    if (/^(?:JSON checks need a field and comparison\.|Use a dot-separated JSON field|Invalid JSON comparison\.|Invalid JSON aggregation\.|Invalid comparison value\.|This comparison needs a number\.|Monitoring URLs must use HTTP or HTTPS)/i.test(detail)) {
        return `${name} has an invalid health-check configuration. Check its JSON rule and target URL.`
    }
    if (/Monitoring destinations must resolve only to public IP addresses|could not resolve|no public IP/i.test(detail)) {
        return `${name} could not check the target because its address is not publicly reachable by the monitor. Check the hostname and DNS configuration.`
    }
    if (/^(?:JSON source returned invalid JSON\.|Invalid JSON response\.)$/i.test(detail)) {
        return `${name} returned a response that is not valid JSON. The target’s health state is unknown. Check the health endpoint response and recent service logs.`
    }
    if (/Monitoring source exceeds the (?:1 MiB|redirect|content-encoding)|Unsupported monitoring response encoding|Monitoring response ended before the body was complete/i.test(detail)) {
        return `${name} returned a response the monitor could not read completely. The target’s health state is unknown. Check the endpoint response size and encoding.`
    }
    const failedHttpCheck = /^(?:HTTP|FETCH|POST) check failed: \S+ returned HTTP (\d{3})\.$/.exec(detail)
    if (failedHttpCheck) return retryNote(httpFailure(failedHttpCheck[1], context))
    const sourceHttp = /^JSON source returned HTTP (\d{3})\.$/.exec(detail)
    if (sourceHttp) return retryNote(httpFailure(sourceHttp[1], context))

    if (/^SSH check failed: .+ did not return an SSH banner\.$/.test(detail)) {
        return retryNote(`${name} accepted a connection but did not return a valid SSH banner. Check the SSH service and port.`)
    }
    if (/\b(?:EAI_AGAIN|EAI_FAIL|ENOTFOUND)\b|name or service not known|temporary failure in name resolution/i.test(detail)) {
        return retryNote(`${name} could not resolve the target hostname. Check DNS and the monitoring service’s network.`)
    }
    if (/\b(?:ECONNREFUSED)\b|^Connection refused\.?$|Connection failed: Connection refused|connect ECONNREFUSED/i.test(detail)) {
        return retryNote(`${name} could not connect because the target refused the connection. Check that the service is listening and the port is reachable.`)
    }
    if (/\b(?:EHOSTUNREACH|ENETUNREACH)\b|network is unreachable|no route to host/i.test(detail)) {
        return retryNote(`${name} could not reach the target over the network. Check routing and firewall rules.`)
    }
    if (/\b(?:ECONNRESET|EPIPE)\b|socket hang up|response ended before the body was complete|Connection failed:/i.test(detail)) {
        return retryNote(`${name} lost its connection before the health check completed. The target’s health state is unknown. Check connectivity and recent service logs.`)
    }
    if (/\bETIMEDOUT\b|\btimeout\b|\btimed out\b/i.test(detail)) {
        const limit = typeof context.timeoutSeconds === 'number' && context.timeoutSeconds > 0
            ? ` within the configured ${context.timeoutSeconds}-second request limit`
            : ''
        if (context.targetUrl === 'system:ti-collection') {
            return retryNote(`${name} timed out${limit} before it could read source collection status. Collection freshness is unknown. Check the scraper’s last completed run and recent source errors.`)
        }
        if (/log.*throughput/i.test(name)) {
            return retryNote(`The Logs metrics check timed out${limit}. Current throughput and backlog are unknown because no fresh metrics were returned. Check the Logs metrics endpoint and processing workers.`)
        }
        return retryNote(`${name} timed out${limit} before it could return health data. Target status is unknown. Check the endpoint response time and the monitor timeout.`)
    }
    if (/^Monitoring (?:request )?failed\.$|^JSON source unavailable\.$|^Monitoring check failed\.$/i.test(detail)) {
        return `${name} failed before it could confirm the target’s health. The target’s status is unknown. Check the monitor’s latest result and target connectivity.`
    }

    if (!context.formatUnknown) return message
    const conciseDetail = detail.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').slice(0, 160)
    const explanation = conciseDetail ? `: ${conciseDetail}` : ''
    return `${name} could not complete its health check${explanation}. The target’s status is unknown. Check the monitor configuration and target response.`
}

// Translate stored machine-generated output for cases, events, and Discord.
// Persisted evidence and user-authored comments remain unchanged.
export function readableMonitoringMessage(message: string, context: MonitoringMessageContext = {}): string {
    // Older case summaries persisted this generic wrapper before their raw timeout
    // detail was recognized. Reformat the known wrapper so saved cases improve too.
    const name = monitorName(context).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const genericFailure = new RegExp(`^${name} could not complete its health check: ([\\s\\S]+?)\\. The target’s status is unknown\\. Check the monitor configuration and target response\\.$`).exec(message)
    if (genericFailure) return monitoringError(`${genericFailure[1]}.`, context)

    if (context.targetUrl === 'system:metrics' && /^JSON field (?:unavailable|is not numeric|type does not match the comparison): [\w*.-]+\.$/.test(message)) {
        return hostMetricsDataWarning(context.monitorName || 'the monitored host', new Error(message))
    }
    const jsonField = /^JSON field (unavailable|is not numeric|type does not match the comparison): ([\w*.-]+)\.$/.exec(message)
    if (jsonField) {
        return `${monitorName(context)} could not read the expected JSON field ${jsonField[2]} (${jsonField[1]}). The target’s status is unknown. Check the response schema and the monitor’s field path.`
    }

    const operationTimeout = /^(?:The operation timed out\.|(?:Monitoring request )?Timed out after (.+?)\.|Connection timed out after (.+?)\.|timeout exceeded when trying to connect)(?: Failed after (\d+) attempts?\.)?$/i.exec(message)
    if (operationTimeout) {
        const duration = operationTimeout[1] || operationTimeout[2]
        const count = operationTimeout[3]
        const timing = duration
            ? ` within ${duration}${count ? ` (${count} attempt${count === '1' ? '' : 's'})` : ''}`
            : count ? ` after ${count} attempt${count === '1' ? '' : 's'}` : ''
        if (context.targetUrl === 'system:ti-collection') {
            return `TI collection health check timed out${timing} before it could read collection status. The collection state is unknown. Check the scraper’s last completed run and recent source errors.`
        }
        return `${monitorName(context)} timed out${timing} before it returned a result. Target status is unknown. Check the monitor endpoint and its dependencies.`
    }

    const httpCheck = /^(?:HTTP|FETCH|POST) check failed: \S+ returned HTTP (\d{3})\.$/.exec(message)
    if (httpCheck) return httpFailure(httpCheck[1], context)
    const successfulHttpCheck = /^(HTTP|FETCH|POST) check passed: \S+ returned HTTP (\d{3})\.$/.exec(message)
    if (successfulHttpCheck) return `${monitorName(context)} passed its ${successfulHttpCheck[1]} health check (HTTP ${successfulHttpCheck[2]}).`
    const successfulSocketCheck = /^(TCP|SSH) check passed: \S+ (accepted a TCP connection on port (\d+)|returned an SSH banner)\.$/.exec(message)
    if (successfulSocketCheck) return successfulSocketCheck[1] === 'SSH'
        ? `${monitorName(context)} returned a valid SSH banner.`
        : `${monitorName(context)} accepted a TCP connection on port ${successfulSocketCheck[3]}.`
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
    if (/^(?:RAM|CPU|GPU|Storage) usage is normal: |^Temperature is normal: |^Power usage is normal: /.test(message)) return message

    const timeout = /^(?:Monitoring request timed out after (.+?)\.|Connection timed out after (.+?)\.) Failed after (\d+) attempts?\.$/.exec(message)
    if (timeout) {
        const duration = timeout[1] || timeout[2]
        return `${monitorName(context)} did not respond within ${duration} after ${timeout[3]} attempts. Check connectivity and target response time.`
    }
    if (/^Monitoring request timed out after (.+?)\.$/.test(message)) {
        const duration = /^Monitoring request timed out after (.+?)\.$/.exec(message)![1]
        return `${monitorName(context)} did not respond within ${duration}. Check connectivity and target response time.`
    }
    if (/^SSH check failed: .+ did not return an SSH banner\.$/.test(message)) {
        return `${monitorName(context)} accepted a connection but did not return a valid SSH banner. Check the SSH service and port.`
    }
    if (/^Connection failed: Connection refused/.test(message)) return `${monitorName(context)} could not connect because the target refused the connection. Check that it is listening and reachable from the monitoring service.`
    if (/^TLS certificate validation failed for ([\w.-]+)\.$/.test(message)) {
        const hostname = /^TLS certificate validation failed for ([\w.-]+)\.$/.exec(message)![1]
        return `${monitorName(context)} could not verify the TLS certificate for ${hostname}. Check certificate validity and hostname configuration.`
    }
    return monitoringError(message, context)
}

export function isMonitoringStateUnknown(message: string) {
    return /\b(?:status|state) is unknown\b/i.test(message)
}
