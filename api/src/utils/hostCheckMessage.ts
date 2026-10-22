import type { JsonRule } from './jsonMonitoring.ts'

const usageNames: Record<string, string> = {
    'host.memoryPercent': 'RAM',
    'host.cpuPercent': 'CPU',
    'host.gpus.*.usedPercent': 'GPU',
    'host.storage.*.usedPercent': 'Storage',
}

const hostMetricNames: Record<string, string> = {
    'host.memoryPercent': 'RAM',
    'host.cpuPercent': 'CPU',
    'host.gpus.*.usedPercent': 'GPU',
    'host.storage.*.usedPercent': 'storage',
    'host.temperatures.*.value': 'temperature',
    'host.temperatures.*.margin': 'temperature',
    'host.power.*.margin': 'power',
}

export function isHostMetricsDataWarning(message: string): boolean {
    return message.startsWith('Host metrics unavailable for ')
        || /^JSON field (?:unavailable|is not numeric|type does not match the comparison): hosts?\.?(?:ovhcloud\.)?[\w*.-]+\.$/.test(message)
}

export function hostMetricsDataWarning(monitorName: string, error: unknown): string {
    const detail = error instanceof Error ? error.message : 'Host metrics could not be read.'
    const field = /^JSON field (?:unavailable|is not numeric|type does not match the comparison): ([\w*.-]+)\./.exec(detail)?.[1]
        ?.replace(/^hosts\.ovhcloud\./, 'host.')
    const metric = field ? hostMetricNames[field] || field.split('.').filter(part => part !== '*').at(-1)?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'metric' : null
    const reason = field
        ? `the ${metric} reading (${field}) is missing or invalid in the latest snapshot`
        : /stale|unavailable/i.test(detail)
            ? 'the latest host metrics snapshot is stale or unavailable'
            : `the host metrics source could not be read (${detail})`
    return `Host metrics unavailable for ${monitorName || 'the monitored host'}: ${reason}. Host status is unknown. Check the metrics collector and its latest snapshot.`
}

export function hostCheckMessage(rule: JsonRule, observed: unknown, failed: boolean, inverted = false): string | null {
    if (inverted || typeof observed !== 'number' || !Number.isFinite(observed)) return null
    const path = rule.path.replace(/^hosts\.ovhcloud\./, 'host.')
    const name = usageNames[path]
    if (name && rule.operator === 'gt' && rule.aggregate === 'max' && typeof rule.value === 'number') {
        if (!failed) return `${name} usage is normal: ${observed}% used (alert at ${rule.value}%).`
        const action = name === 'Storage'
            ? 'Find growing data and free space or expand the volume.'
            : name === 'GPU'
                ? 'Check active GPU jobs and reduce sustained load.'
                : name === 'RAM'
                    ? 'Check memory-heavy processes and reduce sustained use.'
                    : 'Check the processes driving sustained CPU load.'
        return `${name} usage is high: ${observed}% used (alert limit ${rule.value}%). ${action}`
    }
    if (path === 'host.temperatures.*.value' && rule.operator === 'gt' && rule.aggregate === 'max' && typeof rule.value === 'number') {
        return `Temperature is ${failed ? 'high' : 'normal'}: ${observed}°C (alert above ${rule.value}°C).${failed ? ' Check cooling and sustained CPU/GPU load.' : ''}`
    }
    const sensor = path === 'host.temperatures.*.margin' ? ['Temperature', '°C'] : path === 'host.power.*.margin' ? ['Power usage', ' W'] : null
    if (sensor && rule.operator === 'lt' && rule.aggregate === 'min' && rule.value === 0) {
        if (observed === 0) return `${sensor[0]} is normal: at the alert limit.`
        return `${sensor[0]} is ${failed ? 'high' : 'normal'}: ${Math.abs(observed)}${sensor[1]} ${observed < 0 ? 'above' : 'below'} the alert limit.${failed ? ' Check the device and its workload.' : ''}`
    }
    return null
}

export function isHostThresholdMessage(message: string): boolean {
    return /^(?:(?:RAM|CPU|GPU|Storage) usage|Temperature|Power usage) is high: /.test(message)
}
