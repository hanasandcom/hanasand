import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { readinessCase } from './readinessCaseFactory'
import { webhookActions, deliveryLedgerHref } from './readinessCaseLinks'

export function buildDeliveryRouteCase(context: ReadinessCaseContext): WorkbenchCase {
    const { input, now, organization, orgWebhooks, webhookWatchlists, hasWebhookDestination, latestDelivery, deliveryFailures, orgWebhookFailures, path } = context
    return readinessCase({
        id: 'delivery_route',
        kind: 'webhook_readiness',
        queue: 'Delivery route',
        title: orgWebhooks.length ? 'Organization webhook destination active' : webhookWatchlists.length ? 'Watchlist webhook destination configured' : 'Configure webhook destination',
        severity: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 'medium' : 'high',
        status: hasWebhookDestination ? 'destination_ready' : 'missing_webhook',
        priority: hasWebhookDestination && !deliveryFailures && !orgWebhookFailures ? 250 : 370,
        confidence: input.backendConfigured ? 90 : 64,
        subtitle: orgWebhooks.length
            ? `${orgWebhooks.length} active org webhook destination${orgWebhooks.length === 1 ? '' : 's'}. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'no delivery yet'}.`
            : webhookWatchlists.length
                ? `${webhookWatchlists.length} watchlist destination${webhookWatchlists.length === 1 ? '' : 's'} configured. Latest delivery: ${latestDelivery ? `${latestDelivery.status} (${latestDelivery.id})` : 'no delivery yet'}.`
                : 'Webhook destination lane is checking organization and watchlist routing.',
        recommendedAction: hasWebhookDestination ? 'Test the destination, then send ready alerts and inspect delivery failures.' : 'Create an organization webhook destination or save a valid HTTPS webhook URL on a watchlist before sending alerts.',
        evidence: [{
            id: 'ev_webhook_delivery',
            sourceName: orgWebhooks.length ? 'Organization webhook destinations' : 'DWM delivery ledger',
            sourceFamily: 'delivery workflow',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: orgWebhooks[0]?.id || latestDelivery?.payloadHash || '/api/organizations/:id/webhooks',
            excerpt: orgWebhooks.length ? orgWebhooks.map(item => `${item.id}: ${item.name} (${item.kind}) ${item.status}${item.lastTestStatus ? `, last test ${item.lastTestStatus}` : ''}`).join(' | ') : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status} ${latestDelivery.deliveryKind || 'webhook'} delivery to ${latestDelivery.endpointHash} at ${latestDelivery.attemptedAt}.` : 'Delivery destinations are ready to test once an organization or watchlist webhook is configured.',
            observedAt: orgWebhooks[0]?.updatedAt || latestDelivery?.attemptedAt || now,
            provenance: orgWebhooks.length ? 'Organization webhook destinations' : 'DWM delivery ledger',
            confidence: input.backendConfigured ? 90 : 64,
        }],
        timeline: [{ id: 'webhook_route_at', at: orgWebhooks[0]?.lastTestedAt || latestDelivery?.attemptedAt || now, title: hasWebhookDestination ? 'Webhook lane active' : 'Webhook lane checking', body: orgWebhooks[0]?.lastTestStatus ? `${orgWebhooks[0].id} last test ${orgWebhooks[0].lastTestStatus}.` : latestDelivery ? `${latestDelivery.id}: ${latestDelivery.status}${latestDelivery.error ? `: ${latestDelivery.error}` : ''}` : 'Delivery destination is syncing for organization or watchlist routing.' }],
        nextTasks: hasWebhookDestination ? [`Owner: operator. Destination IDs: ${orgWebhooks.map(item => item.id).join(', ') || webhookWatchlists.map(item => item.webhookDestinationId || item.id).join(', ')}.`, 'Run a webhook test.', 'Send queued alerts and inspect delivery failures.'] : ['Owner: operator. Create a Discord or generic organization webhook destination.', 'Run webhook test.', 'Send queued alerts and inspect delivery failures.'],
        relatedLinks: organization ? [{ href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Org webhooks' }, { href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/findings', label: 'Configure watchlist webhook' }, { href: '/automation?setup=dwm', label: 'Delivery routes' }] : [{ href: deliveryLedgerHref(input.scope, latestDelivery), label: 'Delivery history' }, { href: '/findings', label: 'Configure webhook' }, { href: '/automation?setup=dwm', label: 'Delivery routes' }],
        workflowPath: path,
        deliveryEvidence: input.deliveries.map(delivery => ({
            id: delivery.id,
            alertId: delivery.alertId,
            status: delivery.status,
            deliveryKind: delivery.deliveryKind,
            attemptedAt: delivery.attemptedAt,
            webhookDestinationId: delivery.webhookDestinationId,
            endpointHash: delivery.endpointHash,
            payloadHash: delivery.payloadHash,
            httpStatus: delivery.httpStatus,
            error: delivery.error,
        })),
        missingDependency: input.deliveries.length ? undefined : 'Webhook delivery rows are syncing. Run Test org webhook or Send queued alerts to create delivery evidence.',
        actions: webhookActions(input.scope, organization, orgWebhooks, hasWebhookDestination, latestDelivery),
    })
}
