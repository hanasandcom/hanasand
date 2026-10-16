import crypto from 'node:crypto'
import type {
    DwmAlertEventType,
    DwmWebhookDestinationInput,
    DwmWebhookDestinationRow,
    DwmWebhookKind,
    DwmWebhookStatus,
} from './webhookDestinationTypes.ts'
import { clean, firstClean } from './webhookValueUtils.ts'
import { normalizeWebhookUrl, hashValue as hashWebhookValue } from './webhookTransport.ts'
import { encryptWebhookTarget } from './webhookDestinationSecrets.ts'

const DEFAULT_EVENTS: DwmAlertEventType[] = ['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed']
const EVENT_TYPES = new Set<DwmAlertEventType>(['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed', 'dwm.alert.test'])
const DESTINATION_STATUSES = new Set<DwmWebhookStatus>(['active', 'paused', 'archived'])
export const WEBHOOK_KINDS = new Set<DwmWebhookKind>(['webhook', 'discord'])

export type NormalizedDestinationInput = {
    orgId: string
    name: string
    kind: DwmWebhookKind
    endpointUrl: string | null
    endpointEncrypted: string | null
    endpointHint: string | null
    endpointHash: string | null
    signingSecret: string | null
    status: DwmWebhookStatus
    events: DwmAlertEventType[]
}

export function normalizeDwmWebhookDestinationInput(
    input: DwmWebhookDestinationInput,
    ownerId: string,
    existing?: DwmWebhookDestinationRow
): NormalizedDestinationInput {
    const rawEndpoint = firstClean(input.endpointUrl, input.endpoint_url, input.webhookUrl, input.webhook_url, input.url)
    const endpointUrl = rawEndpoint ? normalizeWebhookUrl(rawEndpoint) : null
    const signingSecret = endpointUrl
        ? firstClean(input.signingSecret, input.signing_secret) || crypto.randomBytes(32).toString('hex')
        : null
    const kind = parseKind(input.kind ?? input.type, endpointUrl, existing?.kind)
    const channelName = firstClean(input.channelName, input.channel_name, input.channel)
    const name = firstClean(input.name, input.label, channelName) || existing?.name || (kind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
    const orgId = clean(input.orgId) || existing?.org_id || ownerId
    const status = parseStatus(input.status ?? existing?.status)
    const events = parseEvents(input.events ?? existing?.events)

    const normalized: NormalizedDestinationInput = {
        orgId,
        name: name.slice(0, 120),
        kind,
        endpointUrl,
        endpointEncrypted: endpointUrl && signingSecret ? encryptWebhookTarget(endpointUrl, signingSecret) : null,
        endpointHint: endpointUrl ? redactWebhookEndpoint(endpointUrl) : null,
        endpointHash: endpointUrl ? hashWebhookValue('endpoint', endpointUrl) : null,
        signingSecret,
        status,
        events,
    }
    // Internal callers need the raw target and key; serialized values must not expose them.
    Object.defineProperties(normalized, {
        endpointUrl: { enumerable: false, writable: true, configurable: true },
        signingSecret: { enumerable: false, writable: true, configurable: true },
    })
    return normalized
}

export function parseKind(value: unknown, endpointUrl?: string | null, fallback?: DwmWebhookKind): DwmWebhookKind {
    const raw = clean(value)
    if (WEBHOOK_KINDS.has(raw as DwmWebhookKind)) return raw as DwmWebhookKind
    if (endpointUrl) {
        try {
            return isDiscordWebhookUrl(new URL(endpointUrl)) ? 'discord' : 'webhook'
        } catch {
            return 'webhook'
        }
    }
    return fallback || 'webhook'
}

export function parseStatus(value: unknown): DwmWebhookStatus {
    const status = clean(value)
    return DESTINATION_STATUSES.has(status as DwmWebhookStatus) ? status as DwmWebhookStatus : 'active'
}

export function parseEvents(value: unknown): DwmAlertEventType[] {
    if (!Array.isArray(value)) return DEFAULT_EVENTS
    const events = [...new Set(value.map(clean).filter(event => EVENT_TYPES.has(event as DwmAlertEventType)))] as DwmAlertEventType[]
    return events.length ? events : DEFAULT_EVENTS
}

export function parseEventType(value: unknown, fallback: DwmAlertEventType): DwmAlertEventType {
    const event = clean(value)
    return EVENT_TYPES.has(event as DwmAlertEventType) ? event as DwmAlertEventType : fallback
}

export function parseBoolean(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
        if (['true', '1', 'yes'].includes(value.toLowerCase())) return true
        if (['false', '0', 'no'].includes(value.toLowerCase())) return false
    }
    return fallback
}

export function redactWebhookEndpoint(endpointUrl: string) {
    try {
        const url = new URL(endpointUrl)
        url.username = ''
        url.password = ''
        if (isDiscordWebhookUrl(url)) {
            const parts = url.pathname.split('/').filter(Boolean)
            const webhookId = parts[2] || 'unknown'
            return `${url.origin}/api/webhooks/${webhookId}/...`
        }
        const suffix = url.pathname.length > 1 ? `${url.pathname.slice(0, 24)}${url.pathname.length > 24 ? '...' : ''}` : ''
        return `${url.origin}${suffix}`
    } catch {
        return 'redacted-webhook'
    }
}

function isDiscordWebhookUrl(url: URL) {
    return /(^|\.)discord(?:app)?\.com$/i.test(url.hostname) && url.pathname.startsWith('/api/webhooks/')
}
