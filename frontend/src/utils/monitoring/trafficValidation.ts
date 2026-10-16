import type { TrafficDomains, TrafficMetrics, TrafficRecords } from './types'

export function isTrafficDomains(value: unknown): value is TrafficDomains {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficDomains).domains))
}

export function isTrafficMetrics(value: unknown): value is TrafficMetrics {
    return Boolean(value && typeof value === 'object'
        && Array.isArray((value as TrafficMetrics).top_domains)
        && Array.isArray((value as TrafficMetrics).top_methods)
        && Array.isArray((value as TrafficMetrics).top_status_codes))
}

export function isTrafficRecords(value: unknown): value is TrafficRecords {
    return Boolean(value && typeof value === 'object' && Array.isArray((value as TrafficRecords).result))
}
