import { buildDwmWebhookDeliveryPreview } from '../deliveryPreview.ts'
import { clean, cleanList } from '../../webhookValueUtils.ts'
import { provenanceSummary } from '../../webhookAlertNormalization.ts'
import { parseCount } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookDeliveryLedgerFromEvidence } from '../../webhookDeliveryLedger.ts'
import { buildDwmWebhookAuditEventContractsFromLedger } from '../../webhookAuditContracts.ts'
import { buildDwmWebhookDeliveryOperationsFromProjection } from '../../webhookDeliveryOperations.ts'
import { buildDwmWebhookDeliveryRetryPersistenceFromProjection } from '../../webhookDeliveryRetryPersistence.ts'
import { prepareDwmWebhookDeliveryProjectionContext, type DwmWebhookDeliveryProjectionContext } from './webhook-visibility-decision.ts'
import { type DwmWebhookDeliveryEvidenceOptions } from './webhook-contract-types.ts'
import { deliveryProvenanceIds } from './retry-queue-blocker.ts'

export function buildDwmWebhookDeliveryHistoryWithRetryPersistence({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    now,
    context = prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters, now }),
}: DwmWebhookDeliveryEvidenceOptions & {
    now: Date
    context?: DwmWebhookDeliveryProjectionContext
}) {
    const { projection, now: planningTime } = context
    const ledger = buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now: planningTime })
    const auditContracts = buildDwmWebhookAuditEventContractsFromLedger({ auditEvents, deliveries, destinations, ledger })
    const operations = buildDwmWebhookDeliveryOperationsFromProjection({ destinations, filters, liveDeliveryEnabled, ledger, auditContracts })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistenceFromProjection({ destinations, filters, liveDeliveryEnabled, ledger, auditContracts })
    const deliveryById = projection.deliveriesById
    const auditByDelivery = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const retryByIdempotencyKey = new Map(retryPersistence.deliveryKeys.map(key => [key.idempotencyKey, key]))
    const entries = operations.recentDeliveries.map((operation) => {
        const delivery = deliveryById.get(operation.deliveryId) || null
        const preview = delivery ? buildDwmWebhookDeliveryPreview(delivery) : null
        const discordEmbeds = Array.isArray(preview?.discord.embeds)
            ? preview.discord.embeds as Array<Record<string, unknown>>
            : []
        const firstDiscordEmbed = discordEmbeds[0]
        const retryKey = operation.idempotencyKey ? retryByIdempotencyKey.get(operation.idempotencyKey) || null : null
        const audit = auditByDelivery.get(operation.deliveryId) || null
        const alert = preview?.context.alert || null
        const watchlist = preview?.context.watchlist || null
        const provenance = alert?.provenance || null

        return {
            schemaVersion: 'dwm.webhook.delivery_history_entry.v1',
            requestId: operation.requestId,
            deliveryId: operation.deliveryId,
            orgId: operation.orgId,
            destinationId: operation.destinationId,
            eventType: operation.eventType,
            status: operation.status,
            rawStatus: operation.rawStatus,
            dryRun: operation.dryRun,
            live: operation.live,
            liveRequested: operation.liveRequested,
            replay: operation.replay,
            route: operation.route,
            alert: {
                id: operation.alertId,
                title: clean(alert?.title),
                severity: clean(alert?.severity),
                sourceFamily: clean(alert?.sourceFamily),
                evidenceCount: parseCount(alert?.evidenceCount),
                dedupeKey: operation.dedupeKey || clean(alert?.dedupeKey),
                casePath: operation.casePath || clean(alert?.casePath),
                alertUrl: clean(alert?.alertUrl),
                caseId: clean(alert?.caseId),
                caseActionId: operation.caseActionId || clean(alert?.caseActionId),
                caseActionPath: operation.caseActionPath || clean(alert?.caseActionPath),
                provenance,
                provenanceIds: deliveryProvenanceIds(provenance),
                provenanceSummary: provenanceSummary(provenance),
            },
            watchlist: {
                id: operation.watchlistId || clean(watchlist?.id),
                name: operation.watchlistName || clean(watchlist?.name),
                terms: cleanList(watchlist?.terms),
            },
            destination: operation.destination,
            deliveryProof: {
                idempotencyKey: operation.idempotencyKey,
                payloadHash: operation.payloadHash,
                auditEventId: audit?.auditEventId || operation.auditEventId,
                auditAction: audit?.action || operation.auditAction,
                attemptedAt: operation.attemptedAt,
                createdAt: operation.createdAt,
                updatedAt: operation.updatedAt,
                response: operation.response,
                error: operation.error,
            },
            retry: {
                retryable: operation.attempts.retryable,
                nextRetryAt: operation.attempts.nextRetryAt,
                attemptCount: operation.attempts.count,
                lastErrorCategory: operation.attempts.lastErrorCategory,
                terminalFailure: retryKey?.retry.terminalFailure || false,
            },
            dedupe: {
                alreadyDelivered: retryKey?.dedupe.alreadyDelivered || false,
                duplicateAttemptCount: retryKey?.dedupe.duplicateAttemptCount || 0,
            },
            discordPreview: preview
                ? {
                    content: preview.discord.content,
                    embedCount: discordEmbeds.length,
                    title: clean(firstDiscordEmbed?.title),
                    fieldNames: Array.isArray(firstDiscordEmbed?.fields)
                        ? (firstDiscordEmbed.fields as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                        : [],
                    allowedMentions: preview.discord.allowedMentions,
                }
                : null,
            sanitizedPayloadPreview: preview?.sanitizedPayloadPreview || null,
            operationLinks: preview?.operationLinks || null,
        }
    })

    return {
        history: {
            schemaVersion: 'dwm.webhook.delivery_history.v1',
            liveDeliveryEnabled,
            filters: operations.filters,
            total: entries.length,
            counts: operations.counts,
            entries,
        },
        retryPersistence,
    }
}
