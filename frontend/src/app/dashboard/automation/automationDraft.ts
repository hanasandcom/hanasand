import type { AgentAutomation, AutomationPayload, JsonRule } from '@/utils/automations/client'

export const automationInputClass = 'h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'

export const defaultJsonRule: JsonRule = { path: '', operator: 'gt', value: 80, aggregate: 'max' }

export function defaultAutomationDraft(): AutomationPayload {
    return {
        name: 'Website health check',
        prompt: 'Monitor the website and API endpoint for availability and response errors.',
        targetUrl: '',
        monitoringType: 'fetch',
        followRedirects: true,
        userAgent: '',
        expectedDown: false,
        upsideDown: false,
        timeoutSeconds: 5,
        retryCount: 4,
        scheduleKind: 'interval',
        intervalMinutes: 15,
        runAt: '',
        status: 'active',
        actionType: 'agent_prompt',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        modelName: null,
        notificationDestinations: [],
        notifyOn: 'failure',
        notifyWarnings: false,
    }
}

export function newAutomationDraft(mode: 'health' | 'cron'): AutomationPayload {
    return mode === 'cron'
        ? { ...defaultAutomationDraft(), name: 'Scheduled reminder', prompt: '', actionType: 'system_alert', notifyOn: 'always' }
        : defaultAutomationDraft()
}

export function toAutomationDraft(automation: AgentAutomation): AutomationPayload {
    return {
        name: automation.name,
        prompt: automation.prompt,
        targetUrl: automation.monitoringType === 'fetch' || automation.monitoringType === 'post'
            ? normalizeMonitoringUrl(automation.targetUrl || '')
            : automation.targetUrl,
        monitoringType: automation.monitoringType,
        jsonRule: automation.jsonRule,
        followRedirects: automation.followRedirects,
        userAgent: automation.userAgent || '',
        expectedDown: automation.expectedDown,
        upsideDown: automation.upsideDown,
        timeoutSeconds: automation.timeoutSeconds || 1,
        retryCount: automation.retryCount ?? 1,
        scheduleKind: automation.scheduleKind,
        intervalMinutes: automation.intervalMinutes || 15,
        runAt: automation.runAt || '',
        status: automation.status === 'paused' ? 'paused' : 'active',
        actionType: automation.actionType,
        organizationId: automation.organizationId,
        timezone: automation.timezone,
        modelName: automation.modelName,
        notificationDestinations: automation.notificationDestinations || (automation.modelName ? [automation.modelName] : []),
        notifyOn: automation.notifyOn || 'failure',
        notifyWarnings: automation.notifyWarnings,
    }
}

export function normalizeMonitoringUrl(value: string) {
    const trimmed = value.trim()
    if (trimmed === 'system:metrics') return trimmed
    return trimmed && !/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed
}

export function hasUrlScheme(value: string) {
    return /^https?:\/\//i.test(value.trim())
}

export function validateAutomationDraft(draft: AutomationPayload) {
    if (!draft.name.trim()) return { field: 'name' as const, message: 'Name is required.' }
    if (draft.actionType === 'agent_prompt' && draft.monitoringType !== 'push') {
        const targetUrl = draft.monitoringType === 'tcp' || draft.monitoringType === 'ssh'
            ? (draft.targetUrl || '').trim()
            : normalizeMonitoringUrl(draft.targetUrl || '')
        if (!targetUrl) return { field: 'url' as const, message: 'URL is required.' }
        if (draft.monitoringType === 'tcp' || draft.monitoringType === 'ssh') {
            if (!/^[^:/\s]+(?::\d+)?$/.test(targetUrl)) {
                return { field: 'url' as const, message: 'Enter a host with an optional port.' }
            }
        } else if (!(draft.monitoringType === 'json' && targetUrl === 'system:metrics')) {
            try {
                const parsed = new URL(targetUrl)
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
            } catch {
                return { field: 'url' as const, message: 'Enter a valid HTTP or HTTPS URL.' }
            }
        }
    }
    if (draft.monitoringType === 'push' && (!/^[\w./:-]{1,128}$/.test(draft.targetUrl || '') || draft.targetUrl?.startsWith('system:'))) {
        return { field: 'url' as const, message: 'Enter a source ID using letters, numbers, dots, slashes, colons, hyphens or underscores. The system: prefix is reserved.' }
    }
    if (draft.monitoringType === 'json') {
        const rule = draft.jsonRule || defaultJsonRule
        if (!/^[\w*-]+(?:\.[\w*-]+)*$/.test(rule.path)) {
            return { field: 'json' as const, message: 'Enter a dot-separated JSON field.' }
        }
        if (!['eq', 'ne'].includes(rule.operator) && typeof rule.value !== 'number') {
            return { field: 'json' as const, message: 'The comparison needs a number.' }
        }
    }
    if (draft.scheduleKind === 'once' && (!draft.runAt || !Number.isFinite(Date.parse(draft.runAt)) || Date.parse(draft.runAt) <= Date.now())) {
        return { field: 'schedule' as const, message: 'Choose a future run time.' }
    }
    if (draft.scheduleKind === 'interval' && (!draft.intervalMinutes || draft.intervalMinutes < 1 || draft.intervalMinutes > 43200)) {
        return { field: 'schedule' as const, message: 'Choose an interval between 1 and 43200 minutes.' }
    }
    if (!draft.prompt.trim()) return { field: 'prompt' as const, message: 'Description is required.' }
    return null
}

export function formatAutomationDate(value?: string | null) {
    if (!value) return 'Not yet'
    return new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

export function formatAutomationInterval(value?: number | null) {
    const minutes = Number(value || 1)
    return `Every ${minutes} minute${minutes === 1 ? '' : 's'}`
}
