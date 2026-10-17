import { makeWebhookBlockerWithFields } from '../../webhookValueUtils.ts'
import { type DwmWebhookDestinationCrudBlockerCode } from './webhook-contract-types.ts'

export function validateWebhookEndpointForContract(rawEndpoint: string) {
    if (!rawEndpoint) return { normalizedUrl: null, error: 'endpointUrl is required.' }
    try {
        const url = new URL(rawEndpoint)
        if (url.protocol !== 'https:') {
            return { normalizedUrl: null, error: 'Webhook destinations must use HTTPS.' }
        }
        return { normalizedUrl: url.toString(), error: null }
    } catch {
        return { normalizedUrl: null, error: 'endpointUrl must be a valid URL.' }
    }
}

export function crudBlocker(
    code: DwmWebhookDestinationCrudBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false,
    blocking = true
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable, blocking })
}

export function destinationCrudRouteContract() {
    return {
        schemaVersion: 'dwm.webhook.destination_crud_routes.v1',
        list: {
            method: 'GET',
            route: '/api/dwm/webhook-destinations',
            requiredQuery: ['orgId'],
            noNetwork: true,
        },
        create: {
            method: 'POST',
            route: '/api/dwm/webhook-destinations',
            requiredBody: ['orgId', 'endpointUrl'],
            optionalBody: ['name', 'label', 'type', 'kind', 'channel', 'events', 'requestId'],
            secretBodyFields: ['endpointUrl', 'webhookUrl', 'url'],
            noNetwork: true,
        },
        update: {
            method: 'PUT',
            route: '/api/dwm/webhook-destinations/:id',
            requiredBody: ['orgId'],
            optionalBody: ['name', 'label', 'endpointUrl', 'webhookUrl', 'url', 'type', 'kind', 'channel', 'events', 'status', 'requestId'],
            secretBodyFields: ['endpointUrl', 'webhookUrl', 'url'],
            noNetwork: true,
        },
        disable: {
            method: 'DELETE',
            route: '/api/dwm/webhook-destinations/:id',
            requiredQuery: ['orgId'],
            noNetwork: true,
        },
        enable: {
            method: 'PUT',
            route: '/api/dwm/webhook-destinations/:id',
            requiredBody: ['orgId', 'status'],
            optionalBody: ['requestId'],
            noNetwork: true,
        },
        test: {
            method: 'POST',
            route: '/api/dwm/webhook-destinations/:id/test',
            requiredBody: ['orgId', 'dryRun'],
            optionalBody: ['alert', 'eventType', 'dedupeKey', 'casePath', 'requestId'],
            noNetworkDefault: true,
        },
    }
}
