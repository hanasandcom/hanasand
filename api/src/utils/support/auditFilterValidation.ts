import { supportError } from './adminSupportInput.ts'

type AuditFilterValues = {
    severity: string
    outcome: string
    from: string
    to: string
    limit: number
}

type AuditFilterValidationPolicy = {
    supportedFilters: Set<string>
    unsupportedCode: string
    unsupportedLabel: string
    invalidCode: string
    dateLabel: string
    limitMessage: string
}

export function auditFilterValidationError(rawQuery: object, filter: AuditFilterValues, policy: AuditFilterValidationPolicy) {
    const query = rawQuery as Record<string, unknown>
    const unsupported = Object.keys(query).filter(key => !policy.supportedFilters.has(key))
    if (unsupported.length) {
        return supportError(policy.unsupportedCode, `Unsupported ${policy.unsupportedLabel} filter: ${unsupported[0]}.`, {
            unavailableFilters: unsupported,
            supportedFilters: Array.from(policy.supportedFilters),
        })
    }
    if (query.severity && !filter.severity) {
        return supportError(policy.invalidCode, 'Unsupported audit severity filter.', {
            filter: 'severity',
            supportedValues: ['info', 'notice', 'warning', 'critical'],
        })
    }
    if (query.outcome && !filter.outcome) {
        return supportError(policy.invalidCode, 'Unsupported audit outcome filter.', {
            filter: 'outcome',
            supportedValues: ['success', 'denied', 'failed'],
        })
    }
    if (filter.from && Number.isNaN(Date.parse(filter.from))) {
        return supportError(policy.invalidCode, `Invalid ${policy.dateLabel} start time.`, { filter: 'from' })
    }
    if (filter.to && Number.isNaN(Date.parse(filter.to))) {
        return supportError(policy.invalidCode, `Invalid ${policy.dateLabel} end time.`, { filter: 'to' })
    }
    if (query.limit !== undefined && (!Number.isFinite(Number(query.limit)) || Number(query.limit) < 1)) {
        return supportError(policy.invalidCode, policy.limitMessage, { filter: 'limit' })
    }
    return null
}
