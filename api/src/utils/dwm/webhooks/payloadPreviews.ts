import crypto from 'node:crypto'
import type { DwmWebhookDestinationRow } from '../webhookDestinationTypes.ts'
import type { DwmAlertEventType } from '../webhookDestinationTypes.ts'
import type { toDwmWebhookDelivery } from '../webhookDestinationModels.ts'
import { clean, cleanList, recordOrEmpty } from '../webhookValueUtils.ts'
import { dedupeFromIdempotencyKey, parseCount, redactDeliveryEvidenceText, truncate } from '../webhookDeliveryUtilities.ts'
import { DISCORD_CONTENT_LIMIT, DISCORD_EMBED_DESCRIPTION_LIMIT, DISCORD_EMBED_FIELD_LIMIT, DISCORD_EMBED_TITLE_LIMIT } from './discordPayloadLimits.ts'

export function buildDwmWebhookTestAlert(destination: Pick<DwmWebhookDestinationRow, 'org_id'>, testId: string = crypto.randomUUID()) {
    return {
        id: testId ? `webhook_test_${testId}` : 'webhook_test',
        orgName: destination.org_id,
        title: 'Hanasand delivery test',
        severity: 'medium',
        claimSummary: 'This is an example message from Hanasand to test your delivery destination.',
        recommendedAction: 'No action is needed.',
        matchedTerm: { value: 'example.com', kind: 'domain' },
        domain: 'example.com',
        sourceFamily: 'dark_web',
        artifactType: 'test_notification',
        route: 'test_delivery',
        casePath: '/dwm',
        watchlist: {
            id: 'test-watchlist',
            name: 'Webhook test watchlist',
            terms: ['example.com'],
        },
    }
}

type DwmWebhookDeliveryPublic = ReturnType<typeof toDwmWebhookDelivery>

export function buildSanitizedDwmWebhookPayloadPreview(
    delivery: DwmWebhookDeliveryPublic,
    context: Record<string, unknown>,
    embeds: unknown
) {
    const payload = recordOrEmpty(delivery.payload)
    const alert = recordOrEmpty(context.alert)
    const watchlist = recordOrEmpty(context.watchlist)
    const deliveryContext = recordOrEmpty(context.delivery)
    const org = recordOrEmpty(context.org)
    const discordTemplate = sanitizeDiscordTemplateProof(context.discordTemplate)
    const firstEmbed = Array.isArray(embeds) ? recordOrEmpty(embeds[0]) : {}
    const fields = Array.isArray(firstEmbed.fields) ? firstEmbed.fields.map(recordOrEmpty) : []
    const content = redactDeliveryEvidenceText(truncate(clean(payload.content), DISCORD_CONTENT_LIMIT))
    const description = redactDeliveryEvidenceText(truncate(clean(firstEmbed.description), DISCORD_EMBED_DESCRIPTION_LIMIT))
    const fieldSummaries = fields.slice(0, DISCORD_EMBED_FIELD_LIMIT).map(field => ({
        name: truncate(redactDeliveryEvidenceText(clean(field.name) || 'Field'), 80),
        valuePreview: truncate(redactDeliveryEvidenceText(clean(field.value)), 180),
        inline: field.inline === true,
    }))
    const linkCandidates = [
        clean(deliveryContext.alertUrl),
        clean(alert.alertUrl),
        clean(deliveryContext.casePath),
        clean(alert.casePath),
        clean(deliveryContext.caseActionPath),
        clean(alert.caseActionPath),
        delivery.casePath,
    ].filter((link): link is string => Boolean(link))

    return {
        schemaVersion: 'dwm.webhook.sanitized_payload_preview.v1',
        requestId: delivery.id,
        payloadHash: delivery.payloadHash,
        idempotencyKey: delivery.idempotencyKey,
        status: delivery.status,
        dryRun: delivery.dryRun,
        live: !delivery.dryRun && delivery.status !== 'skipped',
        eventType: delivery.eventType,
        title: redactDeliveryEvidenceText(truncate(clean(firstEmbed.title) || clean(alert.title) || delivery.alertId, DISCORD_EMBED_TITLE_LIMIT)),
        contentPreview: content || null,
        descriptionPreview: description || null,
        fieldNames: fieldSummaries.map(field => field.name),
        fields: fieldSummaries,
        discordTemplate,
        context: {
            orgId: clean(org.id) || delivery.orgId,
            orgName: redactDeliveryEvidenceText(truncate(clean(org.name) || delivery.orgId, 120)),
            alertId: clean(alert.id) || delivery.alertId,
            alertTitle: redactDeliveryEvidenceText(truncate(clean(alert.title), 160)),
            severity: clean(alert.severity),
            matchReason: redactDeliveryEvidenceText(truncate(clean(alert.matchReason), 180)) || null,
            deliveryState: clean(alert.deliveryState) || clean(deliveryContext.deliveryState),
            sourceFamily: clean(alert.sourceFamily),
            evidenceTimestamp: clean(alert.evidenceTimestamp),
            eventTimestamp: clean(alert.eventTimestamp) || clean(deliveryContext.eventTimestamp) || clean(context.occurredAt),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id) || delivery.watchlistId,
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name) || delivery.watchlistName || '', 120)) || null,
            route: clean(deliveryContext.route) || delivery.route,
            casePath: clean(deliveryContext.casePath) || clean(alert.casePath) || delivery.casePath,
            caseActionId: clean(deliveryContext.caseActionId) || clean(alert.caseActionId) || null,
            caseActionPath: clean(deliveryContext.caseActionPath) || clean(alert.caseActionPath) || null,
            alertUrl: clean(deliveryContext.alertUrl) || clean(alert.alertUrl),
            dedupeKey: clean(deliveryContext.dedupeKey) || clean(alert.dedupeKey) || dedupeFromIdempotencyKey(delivery.idempotencyKey),
            replay: delivery.eventType === 'dwm.alert.replayed' || deliveryContext.replay === true,
        },
        links: [...new Set(linkCandidates)].map(link => redactDeliveryEvidenceText(truncate(link, 300))),
        redaction: {
            endpointExposed: false,
            secretFields: [],
            safeForCustomerDisplay: true,
        },
    }
}

export function buildDwmWebhookDestinationTestPayloadPreview(payload: unknown) {
    const record = recordOrEmpty(payload)
    const context = recordOrEmpty(record._hanasand)
    const alert = recordOrEmpty(context.alert)
    const watchlist = recordOrEmpty(context.watchlist)
    const delivery = recordOrEmpty(context.delivery)
    const org = recordOrEmpty(context.org)
    const source = recordOrEmpty(context.source)
    const discordTemplate = sanitizeDiscordTemplateProof(context.discordTemplate)
    const embeds = Array.isArray(record.embeds) ? record.embeds.map(recordOrEmpty).slice(0, 1) : []
    const firstEmbed = embeds[0] || {}
    const fields = Array.isArray(firstEmbed.fields) ? firstEmbed.fields.map(recordOrEmpty).slice(0, DISCORD_EMBED_FIELD_LIMIT) : []

    return {
        schemaVersion: 'dwm.webhook.destination_test_payload_preview.v1',
        noNetwork: true,
        eventType: 'dwm.alert.test' as DwmAlertEventType,
        payloadType: Array.isArray(record.embeds) ? 'discord' : 'webhook',
        discord: {
            content: redactDeliveryEvidenceText(truncate(clean(record.content), DISCORD_CONTENT_LIMIT)) || null,
            allowedMentions: record.allowed_mentions || null,
            embedCount: embeds.length,
            title: redactDeliveryEvidenceText(truncate(clean(firstEmbed.title), DISCORD_EMBED_TITLE_LIMIT)) || null,
            description: redactDeliveryEvidenceText(truncate(clean(firstEmbed.description), DISCORD_EMBED_DESCRIPTION_LIMIT)) || null,
            fieldNames: fields.map(field => redactDeliveryEvidenceText(truncate(clean(field.name), 80))).filter(Boolean),
            fields: fields.map(field => ({
                name: redactDeliveryEvidenceText(truncate(clean(field.name), 80)),
                valuePreview: redactDeliveryEvidenceText(truncate(clean(field.value), 180)),
                inline: field.inline === true,
            })),
        },
        context: {
            orgId: clean(org.id),
            orgName: redactDeliveryEvidenceText(truncate(clean(org.name), 120)) || null,
            destinationId: clean(recordOrEmpty(context.destination).id),
            alertId: clean(alert.id),
            title: redactDeliveryEvidenceText(truncate(clean(alert.title), 160)),
            severity: clean(alert.severity),
            matchReason: redactDeliveryEvidenceText(truncate(clean(alert.matchReason), 180)) || null,
            deliveryState: clean(alert.deliveryState) || clean(delivery.deliveryState),
            sourceFamily: clean(alert.sourceFamily) || clean(source.family),
            evidenceTimestamp: clean(alert.evidenceTimestamp),
            evidenceCount: parseCount(alert.evidenceCount),
            watchlistId: clean(watchlist.id),
            watchlistName: redactDeliveryEvidenceText(truncate(clean(watchlist.name), 120)) || null,
            route: clean(delivery.route),
            casePath: clean(delivery.casePath),
            caseActionId: clean(delivery.caseActionId) || clean(alert.caseActionId) || null,
            caseActionPath: clean(delivery.caseActionPath) || clean(alert.caseActionPath) || null,
            analystLink: clean(delivery.analystLink),
            dedupeKey: clean(delivery.dedupeKey) || clean(context.idempotencyKey),
            replay: delivery.replay === true,
            occurredAt: clean(context.occurredAt),
            discordTemplate,
        },
        redaction: {
            endpointExposed: false,
            secretFields: [],
            safeForCustomerDisplay: true,
        },
    }
}

export function sanitizeDiscordTemplateProof(template: unknown) {
    const record = recordOrEmpty(template)
    const templateId = clean(record.templateId)
    if (!templateId) return null
    const redaction = recordOrEmpty(record.redaction)
    return {
        schemaVersion: 'dwm.webhook.discord_payload_template_summary.v1',
        templateId,
        ready: record.ready === true,
        missing: cleanList(record.missing).slice(0, 12),
        requiredFields: cleanList(record.requiredFields).slice(0, DISCORD_EMBED_FIELD_LIMIT),
        fieldOrder: cleanList(record.fieldOrder).slice(0, DISCORD_EMBED_FIELD_LIMIT),
        noNetworkDefault: record.noNetworkDefault === true,
        redaction: {
            safeForCustomerDisplay: redaction.safeForCustomerDisplay !== false,
            endpointExposed: redaction.endpointExposed === true,
            webhookSecretExposed: redaction.webhookSecretExposed === true,
            mentionsDisabled: redaction.mentionsDisabled === true,
        },
    }
}
