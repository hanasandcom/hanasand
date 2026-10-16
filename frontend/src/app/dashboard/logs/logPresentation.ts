import type { LogEvent } from '@/utils/logs/search'

export const logFieldClass = 'rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text'

export const logSeverityClasses: Record<string, string> = {
    low: 'text-ui-muted bg-ui-raised',
    medium: 'text-ui-warning bg-ui-warning/10',
    high: 'text-ui-text bg-ui-raised/10',
    critical: 'text-ui-text bg-ui-raised/20 ring-1 ring-ui-danger',
}

export const logFieldNames: Record<string, string> = {
    TimeGenerated: 'timestamp',
    Severity: 'severity',
    Level: 'level',
    Service: 'service',
    Host: 'host',
    Message: 'message',
    LogType: 'log_type',
    CommandLine: 'process.command_line',
    Executable: 'process.executable',
    UserId: 'user.id',
    RuleId: 'detections',
}

export function projectedLogFields(event: LogEvent, fields: string[]) {
    return Object.fromEntries(fields.map(field => [
        field,
        field === 'TimeGenerated'
            ? event.event_timestamp
            : field === 'RuleId'
                ? event.normalized.detections?.map(rule => rule.rule_id)
                : logFieldNames[field]?.split('.').reduce<unknown>((value, key) => (
                    value && typeof value === 'object'
                        ? (value as Record<string, unknown>)[key]
                        : undefined
                ), event.normalized),
    ]))
}
