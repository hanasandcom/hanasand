import { simpleStatusText } from './incidentCopy'

export function publicStatusLabel(value: string) {
    const replacements: Record<string, string> = {
        agent3: 'Automation', auth: 'Account access', core: 'Core platform', content: 'Content delivery',
        frontend: 'Website', internal: 'Service', prod_rate_limit: 'Rate limits', 'prod-rate-limit': 'Rate limits',
        realtime: 'Realtime delivery', security: 'Security checks', terminal: 'Workspace sessions',
        user_creation: 'Account creation', vm: 'Workspace runtime', websocket: 'Realtime delivery',
    }
    const exact = replacements[value.toLowerCase()]
    if (exact) return exact

    return value
        .replace(/api[-_\s]*index/gi, 'API')
        .replace(/\bapi\b/gi, 'API')
        .replace(/share[-_\s]*page/gi, 'workspace links')
        .replace(/delete[-_\s]*account/gi, 'account deletion')
        .replace(/user[-_\s]*creation/gi, 'account creation')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase())
        .replace(/\bApi\b/g, 'API')
}

export function publicStatusMessage(message: string | null) {
    if (!message) return null

    const simple = simpleStatusText(message)
    if (simple !== message) return simple

    if (/No share page (?:4xx\/5xx|availability) responses in the recent log window\./i.test(message)) {
        return 'Normal workspace link traffic baseline.'
    }
    if (/No (?:websocket|realtime delivery) failures in the recent log window\./i.test(message)) {
        return 'Normal realtime delivery traffic baseline.'
    }
    if (/No (?:terminal failures|workspace session issues) in the recent log window\./i.test(message)) {
        return 'Normal workspace session traffic baseline.'
    }
    if (/No (?:VM provisioning errors|workspace runtime errors) in the recent log window\./i.test(message)) {
        return 'Normal workspace runtime traffic baseline.'
    }

    return message
        .replace(/VM provisioning/gi, 'workspace runtime')
        .replace(/terminal failures/gi, 'workspace session issues')
        .replace(/websocket/gi, 'realtime delivery')
        .replace(/4xx\/5xx/gi, 'availability')
}
