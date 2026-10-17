import { normalizeJsonRule } from './jsonMonitoring.ts'
import { computeNextRunAt } from './automationSchedule.ts'
import { monitoringUrl } from './publicMonitoringRequest.ts'
import type { AutomationInput, AutomationRow, NormalizedAutomationInput } from './automationTypes.ts'
import { clean, normalizeTargetUrl, parseActionType, parseBoolean, parseBoundedInteger, parseDestinations, parseIntervalMinutes, parseMonitoringType, parseNotifyOn, parseRunAt, parseScheduleKind, parseStatus, parseTimezone, SYSTEM_JSON_TARGETS } from './automationInputValues.ts'

export function normalizeAutomationInput(input: AutomationInput, existing?: AutomationRow): NormalizedAutomationInput {
    const name = clean(input.name) || existing?.name || ''
    const prompt = clean(input.prompt) || existing?.prompt || ''
    const monitoringType = parseMonitoringType(input.monitoringType ?? input.monitoring_type ?? existing?.monitoring_type)
    const rawTarget = clean(input.targetUrl ?? input.target_url ?? existing?.target_url)
    const targetUrl = monitoringType === 'push' || monitoringType === 'tcp' || monitoringType === 'ssh' || monitoringType === 'json' && SYSTEM_JSON_TARGETS.has(rawTarget) ? rawTarget : normalizeTargetUrl(rawTarget)
    const jsonRule = monitoringType === 'json' ? normalizeJsonRule(input.jsonRule ?? input.json_rule ?? existing?.json_rule) : null
    const followRedirects = parseBoolean(input.followRedirects ?? input.follow_redirects ?? existing?.follow_redirects, true)
    const userAgent = clean(input.userAgent ?? input.user_agent ?? existing?.user_agent) || null
    const expectedDown = parseBoolean(input.expectedDown ?? input.expected_down ?? existing?.expected_down, false)
    const upsideDown = parseBoolean(input.upsideDown ?? input.upside_down ?? existing?.upside_down, false)
    const timeoutSeconds = parseBoundedInteger(input.timeoutSeconds ?? input.timeout_seconds ?? existing?.timeout_seconds, 1, monitoringType === 'push' ? 86400 : 120, monitoringType === 'push' ? 180 : 5)
    const retryCount = parseBoundedInteger(input.retryCount ?? input.retry_count ?? existing?.retry_count, 0, 5, 4)
    const notifyWarnings = parseBoolean(input.notifyWarnings ?? input.notify_warnings ?? existing?.notify_warnings, false)
    const scheduleKind = parseScheduleKind(input.scheduleKind ?? input.schedule_kind ?? existing?.schedule_kind)
    const intervalMinutes = parseIntervalMinutes(input.intervalMinutes ?? input.interval_minutes ?? existing?.interval_minutes, scheduleKind)
    const runAt = parseRunAt(input.runAt ?? input.run_at ?? existing?.run_at, scheduleKind)
    const status = parseStatus(input.status ?? existing?.status)
    const actionType = parseActionType(input.actionType ?? input.action_type ?? existing?.action_type)
    const timezone = parseTimezone(input.timezone ?? existing?.timezone)
    const modelName = clean(input.modelName ?? input.model_name ?? existing?.model_name) || null
    const notificationDestinations = parseDestinations(input.notificationDestinations ?? input.notification_destinations ?? existing?.notification_destinations, modelName)
    const notifyOn = parseNotifyOn(input.notifyOn ?? input.notify_on ?? existing?.notify_on)
    const organizationId = clean(input.organizationId ?? input.organization_id ?? existing?.organization_id) || null
    const nextRunAt = status === 'active' ? computeNextRunAt({ scheduleKind, intervalMinutes, runAt, from: new Date() }) : null

    if (!name) {
        throw new Error('Name is required.')
    }
    if (!prompt) {
        throw new Error('Prompt is required.')
    }

    if (actionType === 'agent_prompt') {
        if (!targetUrl) throw new Error(monitoringType === 'push' ? 'Enter a source ID.' : 'Monitoring needs a URL to check.')
        if (monitoringType === 'push') {
            if (!/^[\w./:-]{1,128}$/.test(targetUrl) || targetUrl.startsWith('system:')) throw new Error('Use a source ID of 1–128 letters, numbers, dots, slashes, colons, hyphens or underscores. The system: prefix is reserved.')
            if (scheduleKind !== 'interval' || intervalMinutes !== 1) throw new Error('External checks must check for missing updates every minute.')
            if (expectedDown || upsideDown) throw new Error('External checks cannot invert sensor conditions.')
        } else if (monitoringType === 'tcp' || monitoringType === 'ssh') {
            if (!/^[^:/\s]+(?::\d+)?$/.test(targetUrl)) throw new Error(`${monitoringType.toUpperCase()} checks need a host and optional port.`)
        } else if (!(monitoringType === 'json' && SYSTEM_JSON_TARGETS.has(targetUrl!))) {
            let parsedUrl: URL
            try { parsedUrl = monitoringUrl(targetUrl) } catch { throw new Error('Monitoring URL must be a valid HTTP or HTTPS URL.') }
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Monitoring URL must use HTTP or HTTPS.')
        }
    }
    if (monitoringType === 'push' && actionType !== 'agent_prompt') throw new Error('External events require a monitoring check.')

    if (status === 'active' && actionType === 'system_alert' && !modelName) {
        throw new Error('System alerts need a delivery destination before activation.')
    }

    if (status === 'active' && actionType === 'mail_health_check' && notifyOn !== 'never' && !modelName) {
        throw new Error('Mail health alerts need a delivery destination before activation.')
    }

    if (actionType === 'organization_report' && !organizationId) {
        throw new Error('Organization reports need an organization scope.')
    }
    if (status === 'active' && actionType === 'organization_report' && !modelName) {
        throw new Error('Organization reports need a delivery destination before activation.')
    }

    return { name, prompt, targetUrl, monitoringType, jsonRule, followRedirects, userAgent, expectedDown, upsideDown, timeoutSeconds, retryCount, notifyWarnings, scheduleKind, intervalMinutes, runAt, status, actionType, timezone, modelName, notificationDestinations, notifyOn, organizationId, nextRunAt }
}
