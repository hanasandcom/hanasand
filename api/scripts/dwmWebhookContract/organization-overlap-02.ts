import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmAlertDeliveryPayload, buildDwmAlertWebhookNotificationInput, buildDwmAlertWebhookReadinessHandoff } = webhooks
const { overlappingOrgAReadiness, overlappingOrgAlertA, overlappingOrgAlertB, overlappingOrgAudits, overlappingOrgDeliveries, overlappingOrgDestinations, secret } = ctx

const overlappingOrgBReadiness = ctx.overlappingOrgBReadiness = buildDwmAlertWebhookReadinessHandoff({
    ownerId: 'owner_contract',
    input: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertB, { eventType: 'dwm.alert.replayed', dryRun: true, live: false }),
    destinations: overlappingOrgDestinations,
    deliveries: overlappingOrgDeliveries,
    auditEvents: overlappingOrgAudits,
    liveDeliveryEnabled: false,
})
const overlappingOrgAPayload = ctx.overlappingOrgAPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_overlap_org_a',
        kind: 'discord',
        name: 'Org A Discord',
        org_id: 'org_overlap_a',
    },
    eventType: 'dwm.alert.created',
    deliveryId: 'delivery_overlap_a_payload',
    alert: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertA).alert || {},
}) as Record<string, unknown>
const overlappingOrgBPayload = ctx.overlappingOrgBPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_overlap_org_b',
        kind: 'discord',
        name: 'Org B Discord',
        org_id: 'org_overlap_b',
    },
    eventType: 'dwm.alert.replayed',
    deliveryId: 'delivery_overlap_b_payload',
    alert: buildDwmAlertWebhookNotificationInput(overlappingOrgAlertB).alert || {},
}) as Record<string, unknown>
const overlappingOrgAAlertEventConsumer = ctx.overlappingOrgAAlertEventConsumer = overlappingOrgAReadiness.alertEventConsumer
const overlappingOrgBAlertEventConsumer = ctx.overlappingOrgBAlertEventConsumer = overlappingOrgBReadiness.alertEventConsumer
expect(overlappingOrgAReadiness.schemaVersion === 'dwm.webhook.alert_readiness_handoff.v1' && overlappingOrgAReadiness.orgId === 'org_overlap_a', 'Alert readiness handoff should expose org A readiness.', overlappingOrgAReadiness)
expect(overlappingOrgAReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_a', 'Alert readiness handoff should select only org A destination for overlapping term.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.destinationSelection.selectedDestinationIds.join(',') === 'destination_overlap_org_b', 'Alert readiness handoff should select only org B destination for overlapping term.', overlappingOrgBReadiness)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_a' && item.destinationId !== 'destination_overlap_org_b'), 'Alert readiness retry proof should not leak org B deliveries into org A.', overlappingOrgAReadiness.deliveryRetryPersistence)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.deliveryKeys.every(item => item.orgId === 'org_overlap_b' && item.destinationId !== 'destination_overlap_org_a'), 'Alert readiness retry proof should not leak org A deliveries into org B.', overlappingOrgBReadiness.deliveryRetryPersistence)
expect(overlappingOrgAReadiness.deliveryRetryPersistence.counts.retryable === 1 && overlappingOrgAReadiness.blockers.some(item => item.code === 'retry_scheduled' && item.blocking === false), 'Alert readiness should expose retry/backoff without blocking dry-run customer proof.', overlappingOrgAReadiness)
expect(overlappingOrgBReadiness.deliveryRetryPersistence.counts.replay === 1 && overlappingOrgBReadiness.deliveryRetryPersistence.counts.duplicateDedupe === 0, 'Alert readiness should expose replay attempts without inventing duplicate replay state.', overlappingOrgBReadiness)
expect(overlappingOrgAAlertEventConsumer.schemaVersion === 'dwm.webhook.alert_event_consumer.v1' && overlappingOrgAAlertEventConsumer.ready === true && overlappingOrgAAlertEventConsumer.noNetwork === true, 'Alert event consumer should prove alert-created webhook readiness without network delivery.', overlappingOrgAAlertEventConsumer)
expect(overlappingOrgAAlertEventConsumer.requiredFields.orgId === true && overlappingOrgAAlertEventConsumer.requiredFields.destinationId === true && overlappingOrgAAlertEventConsumer.requiredFields.provenance === true, 'Alert event consumer should expose required alert/org/watchlist/provenance fields.', overlappingOrgAAlertEventConsumer.requiredFields)
expect(overlappingOrgAAlertEventConsumer.persistenceTargets.deliveryAttempt === true && overlappingOrgAAlertEventConsumer.persistenceTargets.retryPersistence === true && overlappingOrgAAlertEventConsumer.persistenceTargets.idempotencyKey === 'dwm.alert.created:org_overlap_a:destination_overlap_org_a:dwm_overlap_org_a', 'Alert event consumer should expose delivery persistence and idempotency targets.', overlappingOrgAAlertEventConsumer.persistenceTargets)
expect(overlappingOrgAAlertEventConsumer.auditReadiness.expectedNextAction === 'delivery.created' && overlappingOrgAAlertEventConsumer.auditReadiness.failureAuditLinked === true && overlappingOrgAAlertEventConsumer.auditReadiness.linkedAuditEventIds.includes('audit_overlap_a_retry'), 'Alert event consumer should expose linked delivery audit readiness for failed created events.', overlappingOrgAAlertEventConsumer.auditReadiness)
expect(overlappingOrgAAlertEventConsumer.auditReadiness.redaction.webhookSecretExposed === false && !JSON.stringify(overlappingOrgAAlertEventConsumer.auditReadiness).includes(secret), 'Alert event consumer audit readiness should redact webhook secrets.', overlappingOrgAAlertEventConsumer.auditReadiness)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.discord.fieldNames.some(name => name.toLowerCase() === 'source family') && overlappingOrgAAlertEventConsumer.payloadPreview.context.watchlistId === 'watchlist_overlap_a', 'Alert event consumer should expose Discord-ready payload preview context.', overlappingOrgAAlertEventConsumer.payloadPreview)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.context.discordTemplate?.templateId === 'dwm.discord.alert_created.v1' && overlappingOrgAAlertEventConsumer.payloadPreview.context.discordTemplate.ready === true && overlappingOrgAAlertEventConsumer.payloadPreview.context.discordTemplate.noNetworkDefault === true, 'Alert event consumer should pass through the Discord payload template contract.', overlappingOrgAAlertEventConsumer.payloadPreview?.context.discordTemplate)
expect(overlappingOrgAAlertEventConsumer.payloadPreview?.redaction.webhookSecretExposed === false && overlappingOrgAAlertEventConsumer.payloadPreview.redaction.endpointExposed === false, 'Alert event consumer payload preview should redact destination secrets.', overlappingOrgAAlertEventConsumer.payloadPreview)
expect(overlappingOrgAAlertEventConsumer.payloadValidation.valid === true && overlappingOrgAAlertEventConsumer.payloadValidation.requiredDiscordFields.includes('Dedupe key') && overlappingOrgAAlertEventConsumer.payloadValidation.missingDiscordFields.length === 0, 'Alert event consumer should validate required Discord payload fields.', overlappingOrgAAlertEventConsumer.payloadValidation)
expect(Object.values(overlappingOrgAAlertEventConsumer.payloadValidation.limits).every(Boolean) && overlappingOrgAAlertEventConsumer.payloadValidation.redaction.mentionsDisabled === true && overlappingOrgAAlertEventConsumer.payloadValidation.redaction.noWebhookUrl === true, 'Alert event consumer payload validation should enforce Discord limits and redaction.', overlappingOrgAAlertEventConsumer.payloadValidation)
expect(overlappingOrgBAlertEventConsumer.payloadPreview?.context.replay === true && overlappingOrgBAlertEventConsumer.persistenceTargets.idempotencyKey === 'dwm.alert.replayed:org_overlap_b:destination_overlap_org_b:dwm_overlap_org_b', 'Alert event consumer should preserve replay event idempotency.', overlappingOrgBAlertEventConsumer)
expect(overlappingOrgBAlertEventConsumer.payloadValidation.valid === true && overlappingOrgBAlertEventConsumer.payloadValidation.context.provenance === true, 'Alert event consumer replay payload should keep validation and provenance proof.', overlappingOrgBAlertEventConsumer.payloadValidation)
expect(overlappingOrgBAlertEventConsumer.auditReadiness.expectedNextAction === 'delivery.replayed' && overlappingOrgBAlertEventConsumer.auditReadiness.linkedActions.includes('delivery.replayed'), 'Alert event consumer should expose replay audit linkage.', overlappingOrgBAlertEventConsumer.auditReadiness)
expect(JSON.stringify(overlappingOrgAPayload).includes('Org A Customer') && !JSON.stringify(overlappingOrgAPayload).includes('Org B Customer'), 'Org A Discord payload should not leak org B customer context.', overlappingOrgAPayload)
expect(JSON.stringify(overlappingOrgBPayload).includes('Org B Customer') && !JSON.stringify(overlappingOrgBPayload).includes('Org A Customer'), 'Org B Discord payload should not leak org A customer context.', overlappingOrgBPayload)
expect(!JSON.stringify([overlappingOrgAReadiness, overlappingOrgBReadiness, overlappingOrgAPayload, overlappingOrgBPayload]).includes(secret), 'Overlapping org readiness and payloads should redact webhook secrets.', { overlappingOrgAReadiness, overlappingOrgBReadiness })
