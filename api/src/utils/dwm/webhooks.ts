import crypto from 'node:crypto'
import { DISCORD_CONTENT_LIMIT, DISCORD_EMBED_DESCRIPTION_LIMIT, DISCORD_EMBED_FIELD_LIMIT, DISCORD_EMBED_FIELD_NAME_LIMIT, DISCORD_EMBED_FIELD_VALUE_LIMIT, DISCORD_EMBED_TITLE_LIMIT } from './webhooks/discordPayloadLimits.ts'
import {
    buildDwmAlertWebhookDispatchPlan,
    buildDwmAlertWebhookDispatchPlanForAlert,
    buildDwmWebhookDispatchPlanForDestinations,
    dispatchOrganizationId,
    normalizeDispatchAlertInput,
} from './webhooks/dispatchPlanning.ts'
import type {
    DwmAlertWebhookDispatchPlan,
    DwmAlertWebhookMissingDeliveryIntent,
    DwmAlertWebhookSkippedDeliveryIntent,
    DwmAlertWebhookTriggerOptions,
    DwmWebhookDispatchDestination,
} from './webhooks/dispatchPlanning.ts'
import { buildDwmAlertWebhookMissingDeliveryIntent, buildDwmAlertWebhookSkippedDeliveryIntents } from './webhooks/dispatchIntents.ts'
export { buildDwmAlertWebhookDispatchPlan } from './webhooks/dispatchPlanning.ts'
export { buildDwmAlertWebhookMissingDeliveryIntent, buildDwmAlertWebhookSkippedDeliveryIntents } from './webhooks/dispatchIntents.ts'
export type { DwmAlertWebhookDispatchPlan, DwmAlertWebhookMissingDeliveryIntent, DwmAlertWebhookSkippedDeliveryIntent, DwmAlertWebhookTriggerOptions, DwmWebhookDispatchDestination } from './webhooks/dispatchPlanning.ts'
import { buildDwmAlertWebhookNotificationInput, buildDwmWebhookDeliveryRequestInput } from './webhooks/notificationInput.ts'
export { buildDwmAlertWebhookNotificationInput, buildDwmWebhookDeliveryRequestInput } from './webhooks/notificationInput.ts'
import { buildDwmWebhookDeliveryPreview, buildDwmWebhookDeliveryOperationLinks } from './webhooks/deliveryPreview.ts'
import { buildDwmAlertDeliveryPayload } from './webhooks/alertDeliveryPayload.ts'
import { workflowSummary } from './webhooks/discordTemplate.ts'
export { buildDwmAlertDeliveryPayload } from './webhooks/alertDeliveryPayload.ts'
import { buildDwmWebhookTestAlert, buildDwmWebhookDestinationTestPayloadPreview } from './webhooks/payloadPreviews.ts'
import { buildDwmWebhookDeliveryTimelineFromReceipts } from './webhooks/deliveryTimeline.ts'
import { buildDwmWebhookDeliveryPersistenceProofFromHistory } from './webhooks/deliveryPersistenceProof.ts'
import { buildDwmWebhookDeliveryReplayApiProjection } from './webhooks/deliveryReplayApiProjection.ts'
import { buildDwmWebhookDeliveryHistoryConsumerProjection } from './webhooks/deliveryHistoryConsumer.ts'
import { buildDwmWebhookDeliveryReadinessConsumerProjection } from './webhooks/deliveryReadinessConsumer.ts'
import { buildDwmWebhookDestinationTestEvidence } from './webhooks/destinationTestEvidence.ts'
import { buildDwmWebhookDeliveryRetryWorkOrdersProjection } from './webhooks/deliveryRetryWorkOrders.ts'
import { buildDwmWebhookDestinationDeliveryMatrixProjection } from './webhooks/destinationDeliveryMatrix.ts'
export { buildDwmWebhookTestAlert } from './webhooks/payloadPreviews.ts'
export { buildDwmWebhookDeliveryPreview } from './webhooks/deliveryPreview.ts'
import type {
    DwmAlertEventType,
    DwmAlertNotificationInput,
    DwmWebhookDeliveryRow,
    DwmWebhookDestinationInput,
    DwmWebhookDestinationRow,
    DwmWebhookKind,
    DwmWebhookStatus,
} from './webhookDestinationTypes.ts'
export type * from './webhookDestinationTypes.ts'
import { clean, cleanList, firstClean, makeWebhookBlocker, makeWebhookBlockerWithFields, recordOrEmpty, uniqueWebhookBlockers } from './webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist, provenanceSummary } from './webhookAlertNormalization.ts'
import { bindDwmWebhookReceiverReceipt } from './webhookReceiverReceipts.ts'
export { clean } from './webhookValueUtils.ts'
export { constantTimeEqual, validateDwmWebhookReceiverEnvelope } from './webhookReceiverValidation.ts'
export { listDwmWebhookReceiverReceipts, recordDwmWebhookReceiverReceipt } from './webhookReceiverReceipts.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery, toDwmWebhookDestination } from './webhookDestinationModels.ts'
export { toDwmWebhookAuditEvent, toDwmWebhookDelivery, toDwmWebhookDestination } from './webhookDestinationModels.ts'
import { decryptWebhookTarget } from './webhookDestinationSecrets.ts'
import { parseBoolean, parseEventType, parseEvents, parseKind, parseStatus, redactWebhookEndpoint, WEBHOOK_KINDS } from './webhookDestinationInput.ts'
export { normalizeDwmWebhookDestinationInput, redactWebhookEndpoint } from './webhookDestinationInput.ts'
import { loadDestinationsForOrg, loadDwmWebhookDestination } from './webhookDestinationReads.ts'
export { archiveDwmWebhookDestination, updateDwmWebhookDestination } from './webhookDestinationMutations.ts'
export { createDwmWebhookDestination } from './webhookDestinationCreate.ts'
export { listDwmWebhookDestinations } from './webhookDestinationReads.ts'
export { listDwmWebhookAuditEvents, listDwmWebhookDeliveries } from './webhookDeliveryReads.ts'
import { recordDwmWebhookAudit } from './webhookAuditStore.ts'
import {
    buildIdempotencyKey,
    dedupeFromIdempotencyKey,
    idempotencyCoverage,
    parseCount,
    redactDeliveryEvidenceText,
    redactNullableDeliveryText,
    sanitizeDwmWebhookDeliveryDiagnostic,
    truncate,
} from './webhookDeliveryUtilities.ts'
export { sanitizeDwmWebhookDeliveryDiagnostic } from './webhookDeliveryUtilities.ts'
import {
    buildDwmWebhookDeliveryEvidence,
    buildDwmWebhookDeliveryEvidenceProjection,
    normalizeWebhookEvidenceFilters,
} from './webhookDeliveryEvidence.ts'
export { buildDwmWebhookDeliveryEvidence } from './webhookDeliveryEvidence.ts'
import {
    buildDwmWebhookDeliveryLedger,
    buildDwmWebhookDeliveryLedgerFromEvidence,
} from './webhookDeliveryLedger.ts'
export { buildDwmWebhookDeliveryEvidenceAndLedger, buildDwmWebhookDeliveryLedger } from './webhookDeliveryLedger.ts'
import {
    classifyDeliveryError,
    MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS,
    planDwmWebhookDeliveryRetry,
} from './webhookDeliveryRetryPolicy.ts'
export { planDwmWebhookDeliveryRetry } from './webhookDeliveryRetryPolicy.ts'
import {
    buildDwmWebhookAuditEventContracts,
    buildDwmWebhookAuditEventContractsFromLedger,
    deliveryAuditActionForEvent,
} from './webhookAuditContracts.ts'
export { buildDwmWebhookAuditEventContracts } from './webhookAuditContracts.ts'
import {
    buildDwmWebhookDeliveryOperations,
    buildDwmWebhookDeliveryOperationsFromProjection,
    buildDwmWebhookDeliveryProjectionBundle,
} from './webhookDeliveryOperations.ts'
export { buildDwmWebhookDeliveryOperations } from './webhookDeliveryOperations.ts'
import { buildDwmWebhookDeliveryRetryPersistenceFromProjection } from './webhookDeliveryRetryPersistence.ts'
import { canonicalJson } from './customerOutputSafety.ts'
import { validateOutboundThirdPartyReport } from './thirdPartyReport.ts'
export { computeOutboundThirdPartyReportChecksum, validateOutboundThirdPartyReport } from './thirdPartyReport.ts'
import {
    controlledReceiverEndpointHashes,
    postPublicWebhook,
    hashValue as hashWebhookValue,
} from './webhookTransport.ts'
export { assertPublicWebhookTarget, pinnedWebhookLookup, signDwmWebhookDeliveryBody } from './webhookTransport.ts'
import run, { withDatabaseAdvisoryLock, withTransaction } from '#db'
import { organizationVisibilityDecision, type OrganizationRole, type OrganizationVisibilityDecisionInput } from '#utils/organizations.ts'
import { buildWebhookDestinationReadinessBridge } from '../webhookDestinationReadinessBridge.ts'
import { buildOrganizationSupportHistoryBridge } from '../organizationSupportHistoryBridge.ts'

function outboundReportAuditMetadata(alert: Record<string, unknown>) {
    if (alert.report === undefined) return {}
    const validation = validateOutboundThirdPartyReport(alert.report)
    if (!validation.valid || !validation.report) return { reportValidation: 'invalid' }
    const policy = recordOrEmpty(validation.report.reportPolicy)
    return {
        reportDirection: clean(policy.direction),
        reportFormat: clean(policy.format),
        reportCaseId: clean(policy.caseId),
        reportAlertId: clean(policy.alertId),
        reportEvidenceCount: Number(policy.evidenceCount),
        reportExportChecksum: clean(validation.report.exportChecksum),
        reportValidation: 'valid'
    }
}

export type DwmWebhookDeliveryEvidenceFilters = {
    orgId?: unknown
    destinationId?: unknown
    alertId?: unknown
    casePath?: unknown
    caseActionId?: unknown
    caseActionPath?: unknown
    dedupeKey?: unknown
    requestId?: unknown
    deliveryId?: unknown
    idempotencyKey?: unknown
    action?: unknown
    status?: unknown
    timeFrom?: unknown
    timeTo?: unknown
    retryState?: unknown
    actorId?: unknown
    reportCaseId?: unknown
    reportExportChecksum?: unknown
}

type DwmWebhookDeliveryEvidenceOptions = {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
}

type DwmWebhookDeliveryEvidenceAccessOptions = DwmWebhookDeliveryEvidenceOptions & {
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

type DwmWebhookDestinationDeliveryAccessOptions = {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

type DwmWebhookDestinationVisibilityOptions = {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}

type DwmWebhookDestinationLifecycleOptions = Pick<
    DwmWebhookDestinationVisibilityOptions,
    'destinations' | 'deliveries' | 'auditEvents' | 'liveDeliveryEnabled' | 'viewerRole' | 'canManage'
>

export type DwmWebhookDeliveryAttemptState = 'queued' | 'sent' | 'failed' | 'skipped'
export type DwmWebhookDeliveryOperationBlockerCode =
    | 'missing_org'
    | 'missing_alert_context'
    | 'destination_unavailable'
    | 'destination_disabled'
    | 'destination_unhealthy'
    | 'missing_webhook_url'
    | 'dedupe_already_delivered'
    | 'retry_not_eligible'
    | 'live_delivery_disabled'
    | 'not_found'
export type DwmWebhookDestinationAdminProofBlockerCode =
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'no_live_endpoint'
    | 'destination_unhealthy'
    | 'missing_org_alert_context'
    | 'permission_denied'
    | 'dedupe_already_delivered'
    | 'audit_missing'
    | 'retry_not_eligible'
export type DwmWebhookDestinationCrudAction = 'create' | 'update' | 'disable' | 'delete' | 'enable' | 'test'
export type DwmWebhookDestinationCrudBlockerCode =
    | 'invalid_url'
    | 'unsupported_destination_type'
    | 'duplicate_destination'
    | 'destination_disabled'
    | 'no_verified_dry_run'
    | 'unhealthy_destination'
    | 'entitlement_plan_denied'
    | 'permission_denied'
    | 'org_scope_mismatch'
    | 'audit_missing'
    | 'idempotency_duplicate'
    | 'retry_not_eligible'

export type DwmWebhookEvidenceVisibilityInput = OrganizationVisibilityDecisionInput

type DwmWebhookDeliveryPublic = ReturnType<typeof toDwmWebhookDelivery>
type DwmWebhookAuditPublic = ReturnType<typeof toDwmWebhookAuditEvent>
export type DwmWebhookDestinationPublic = ReturnType<typeof toDwmWebhookDestination>

function isLiveDeliveredProof(test: { status?: string | null, dryRun?: boolean | null, live?: boolean | null } | null | undefined) {
    return test?.status === 'delivered' && test.dryRun === false && test.live !== false
}

function webhookVisibilityDecision(visibility: DwmWebhookEvidenceVisibilityInput | null) {
    return visibility
        ? organizationVisibilityDecision(visibility)
        : {
            allowed: true,
            reason: null,
            alertVisibilityPolicy: 'members' as const,
            allowedRoles: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'] as OrganizationRole[],
        }
}

type DwmWebhookAccessCapability = 'canManage' | 'canReplay' | 'canTest' | 'canRetry' | 'canCreate' | 'canUpdate' | 'canDelete' | 'canDeliver'
type DwmWebhookAccess<Capabilities extends readonly DwmWebhookAccessCapability[]> = {
    role: string | null
    canRead: boolean
    memberSafe: boolean
} & Record<Capabilities[number], boolean>

function webhookAccess<Capabilities extends readonly DwmWebhookAccessCapability[]>(
    decision: ReturnType<typeof webhookVisibilityDecision>,
    viewerRole: string | null,
    canManage: boolean,
    capabilities: Capabilities,
): DwmWebhookAccess<Capabilities> {
    const canManageResource = decision.allowed && canManage
    return {
        role: clean(viewerRole) || null,
        canRead: decision.allowed,
        ...Object.fromEntries(capabilities.map(capability => [capability, canManageResource])),
        memberSafe: decision.allowed && !canManage,
    } as DwmWebhookAccess<Capabilities>
}

function webhookDeliveryVisibilityAccess(
    visibility: DwmWebhookEvidenceVisibilityInput | null,
    viewerRole: string | null,
    canManage: boolean,
) {
    const decision = webhookVisibilityDecision(visibility)
    return {
        decision,
        access: webhookAccess(decision, viewerRole, canManage, ['canManage', 'canRetry'] as const),
    }
}

export function buildDwmWebhookDeliveryHistory({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    return buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now: new Date(),
    }).history
}

type DwmWebhookDeliveryProjectionContext = {
    projection: ReturnType<typeof buildDwmWebhookDeliveryEvidenceProjection>
    now: Date
}

function prepareDwmWebhookDeliveryProjectionContext({
    deliveries,
    auditEvents,
    filters,
    now = new Date(),
}: Pick<DwmWebhookDeliveryEvidenceOptions, 'deliveries' | 'auditEvents' | 'filters'> & { now?: Date }): DwmWebhookDeliveryProjectionContext {
    return {
        projection: buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents, filters }),
        now,
    }
}

function buildDwmWebhookDeliveryHistoryWithRetryPersistence({
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

export function buildDwmWebhookDeliveryHistoryConsumerProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const now = new Date()
    const context = prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters, now })
    const { history } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now,
        context,
    })
    const attempts = buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        context,
    })
    return buildDwmWebhookDeliveryHistoryConsumerProjection(history, attempts, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryReadinessConsumerProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery readiness is not visible for this organization membership.', normalizedFilters.destinationId, true)

    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_readiness_consumer.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            routeContract: {
                list: {
                    method: 'GET' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredQuery: ['orgId'],
                    optionalQuery: ['destinationId', 'alertId', 'casePath', 'dedupeKey', 'deliveryId'],
                    noNetwork: true,
                },
                retryDryRun: {
                    method: 'POST' as const,
                    route: '/api/dwm/webhook-deliveries',
                    requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                    noNetworkDefault: true,
                },
            },
            counts: {
                total: 0,
                success: 0,
                retryableFailure: 0,
                nonRetryableFailure: 0,
                idempotentReplay: 0,
                redactedDryRun: 0,
                crossOrgDenied: 1,
                auditLinked: 0,
            },
            rows: [],
            blockers: [permissionBlocker],
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                responseBodyExposed: false,
                webhookSecretExposed: false,
            },
        }
    }

    const history = buildDwmWebhookDeliveryHistoryConsumerProof({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    return buildDwmWebhookDeliveryReadinessConsumerProjection(history, decision, access, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryPersistenceProof({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const history = buildDwmWebhookDeliveryHistory({ deliveries, auditEvents, destinations, filters, liveDeliveryEnabled })
    return buildDwmWebhookDeliveryPersistenceProofFromHistory(history, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryHistoryAndPersistenceReadModels({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    const now = new Date()
    const context = prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters, now })
    const { history, retryPersistence } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now,
        context,
    })

    return {
        history,
        persistenceProof: buildDwmWebhookDeliveryPersistenceProofFromHistory(history, liveDeliveryEnabled),
        retryPersistence,
    }
}

export function buildDwmWebhookDeliveryReceipts({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const permissionBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery receipts are not visible for this organization membership.', normalizedFilters.destinationId, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_receipts.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                sent: 0,
                failed: 0,
                skipped: 0,
                dryRun: 0,
                live: 0,
                replay: 0,
                retryable: 0,
                auditLinked: 0,
                blocked: 1,
            },
            blockers: [permissionBlocker],
            historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
                receipts: [],
                filters: normalizedFilters,
                access,
                liveDeliveryEnabled,
                blockers: [permissionBlocker],
            }),
            receipts: [],
        }
    }

    const { history, retryPersistence } = buildDwmWebhookDeliveryHistoryWithRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        now: new Date(),
    })
    const retryByIdempotencyKey = new Map(retryPersistence.deliveryKeys.map(key => [key.idempotencyKey, key]))
    const receipts = history.entries.map((entry) => {
        const retryKey = entry.deliveryProof.idempotencyKey
            ? retryByIdempotencyKey.get(entry.deliveryProof.idempotencyKey) || null
            : null
        const destinationUnavailable = !entry.destinationId
        const blockers = []
        if (entry.destinationId && entry.destination.status && entry.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled.', entry.destinationId, true))
        if (destinationUnavailable) blockers.push(retryQueueBlocker('destination_unavailable', entry.destination.availability.message, null, true))
        if (entry.liveRequested && !liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, false))
        if (entry.status === 'skipped') blockers.push(retryQueueBlocker('delivery_skipped', 'Delivery attempt was skipped before external send.', entry.destinationId, true))
        if (entry.dedupe.alreadyDelivered && entry.status === 'skipped') blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', entry.destinationId, true))
        if (entry.retry.retryable) blockers.push(retryQueueBlocker('retry_scheduled', 'Delivery is retryable and has retry/backoff metadata.', entry.destinationId, false))
        if (!destinationUnavailable && entry.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', entry.destinationId, true))
        if (!entry.deliveryProof.auditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Delivery receipt has no linked audit event yet.', entry.destinationId, false))
        const uniqueBlockers = uniqueWebhookBlockers(blockers)
        const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)

        return {
            schemaVersion: 'dwm.webhook.delivery_receipt.v1',
            requestId: entry.requestId,
            deliveryId: entry.deliveryId,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alert.id,
            eventType: entry.eventType,
            status: entry.status,
            rawStatus: entry.rawStatus,
            dryRun: entry.dryRun,
            live: entry.live,
            liveRequested: entry.liveRequested,
            replay: entry.replay,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey: entry.alert.dedupeKey,
            route: retryKey?.route || null,
            casePath: entry.alert.casePath,
            caseActionId: entry.alert.caseActionId,
            caseActionPath: entry.alert.caseActionPath,
            alertUrl: entry.alert.alertUrl,
            watchlist: entry.watchlist,
            destination: entry.destination,
            proof: {
                payloadHash: entry.deliveryProof.payloadHash,
                auditEventId: entry.deliveryProof.auditEventId,
                auditAction: entry.deliveryProof.auditAction,
                attemptedAt: entry.deliveryProof.attemptedAt,
                createdAt: entry.deliveryProof.createdAt,
                updatedAt: entry.deliveryProof.updatedAt,
                response: entry.deliveryProof.response,
                error: entry.deliveryProof.error,
                noNetwork: entry.dryRun || !entry.live,
                externalSendEnabled: entry.live && liveDeliveryEnabled,
            },
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: destinationUnavailable ? false : entry.retry.terminalFailure,
            },
            dedupe: {
                alreadyDelivered: entry.dedupe.alreadyDelivered,
                duplicateAttemptCount: entry.dedupe.duplicateAttemptCount,
                latestDedupeKey: retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey,
            },
            discordPreview: entry.discordPreview,
            sanitizedPayloadPreview: entry.sanitizedPayloadPreview,
            operationLinks: entry.operationLinks,
            blockers: uniqueBlockers,
            blockingCodes,
            transitionReceipt: buildDwmWebhookDeliveryTransitionReceipt({
                entry,
                retryKey,
                blockers: uniqueBlockers,
                access,
                liveDeliveryEnabled,
            }),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_receipts.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: receipts.some(receipt => receipt.proof.externalSendEnabled),
        visibility: decision,
        access,
        filters: history.filters,
        counts: {
            total: receipts.length,
            sent: receipts.filter(receipt => receipt.status === 'sent').length,
            failed: receipts.filter(receipt => receipt.status === 'failed').length,
            skipped: receipts.filter(receipt => receipt.status === 'skipped').length,
            dryRun: receipts.filter(receipt => receipt.dryRun).length,
            live: receipts.filter(receipt => receipt.live).length,
            replay: receipts.filter(receipt => receipt.replay).length,
            retryable: receipts.filter(receipt => receipt.retry.retryable).length,
            auditLinked: receipts.filter(receipt => Boolean(receipt.proof.auditEventId)).length,
            blocked: receipts.filter(receipt => receipt.blockingCodes.length > 0).length,
        },
        blockers: uniqueWebhookBlockers(receipts.flatMap(receipt => receipt.blockers)),
        historyReplayFilters: buildDwmWebhookReceiptHistoryFilters({
            receipts,
            filters: history.filters,
            access,
            liveDeliveryEnabled,
            blockers: uniqueWebhookBlockers(receipts.flatMap(receipt => receipt.blockers)),
        }),
        receipts,
    }
}

export function buildDwmWebhookDeliveryTimeline({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryTimelineFromReceipts(receipts, liveDeliveryEnabled)
}

export function buildDwmWebhookDeliveryActionPlan({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const timeline = buildDwmWebhookDeliveryTimeline({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const retryByIdempotencyKey = new Map(retryRequest.entries.map(entry => [entry.idempotencyKey, entry]))
    const destinationTestsById = new Map(destinations.map(destination => {
        const test = buildDwmWebhookDestinationTestContract({
            destination,
            deliveries,
            auditEvents,
            liveDeliveryEnabled,
            viewerRole,
            canManage,
        })
        return [destination.id, test]
    }))
    const actions = timeline.timelines.map((item) => {
        const latest = item.latestReceipt
        const retryEntry = latest.idempotencyKey ? retryByIdempotencyKey.get(latest.idempotencyKey) || null : null
        const destinationDisabled = latest.destinationId && latest.destination.status && latest.destination.status !== 'active'
        const destinationUnavailable = latest.destination.availability.code === 'destination_unavailable'
        const terminalFailure = item.retry.terminalFailure
        const retryable = item.retry.retryable && retryEntry?.dryRunRequest.canSend === true
        const liveRetryable = item.retry.retryable && retryEntry?.liveRequest.canSend === true
        const delivered = item.status === 'delivered'
        const primaryAction = !timeline.access.canManage
            ? 'review_status'
            : retryable
                ? 'retry_dry_run'
                : liveRetryable
                    ? 'retry_live'
                    : destinationDisabled
                        ? 'enable_destination'
                        : destinationUnavailable
                            ? 'configure_destination'
                            : terminalFailure
                                ? 'rotate_or_disable_destination'
                                : delivered
                                    ? 'monitor'
                                    : 'test_destination'
        const blockers = uniqueWebhookBlockers([
            ...item.blockers,
            ...(!timeline.access.canManage ? [retryQueueBlocker('permission_denied', 'Only organization owners, admins, and editors can act on webhook deliveries.', latest.destinationId, true)] : []),
        ])
        const dryRunRequest = retryEntry?.dryRunRequest || null
        const liveRequest = retryEntry?.liveRequest || null
        const testDestinationRequest = latest.destinationId
            ? {
                canSend: timeline.access.canManage && !destinationUnavailable,
                noNetwork: true,
                externalSendEnabled: false,
                route: `POST /api/dwm/webhook-destinations/${latest.destinationId}/test`,
                body: {
                    orgId: item.orgId,
                    destinationId: latest.destinationId,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    alertId: item.alertId,
                    dedupeKey: item.dedupeKey,
                    casePath: item.casePath,
                },
                payloadPreview: destinationTestsById.get(latest.destinationId)?.dryRunPayloadPreview || null,
                blockers: blockers.filter(blocker => ['permission_denied', 'destination_unavailable'].includes(blocker.code)),
            }
            : null
        const remediation = deliveryActionRemediation({
            action: primaryAction,
            orgId: item.orgId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            alertId: item.alertId,
            casePath: item.casePath,
            dedupeKey: item.dedupeKey,
            retryable: item.retry.retryable,
            terminalFailure,
            delivered,
            destinationUnavailable,
            destinationDisabled: Boolean(destinationDisabled),
            blockers,
            liveDeliveryEnabled,
        })

        return {
            schemaVersion: 'dwm.webhook.delivery_action.v1',
            action: primaryAction,
            orgId: item.orgId,
            alertId: item.alertId,
            destinationId: latest.destinationId,
            deliveryId: latest.deliveryId,
            requestId: latest.requestId,
            idempotencyKey: latest.idempotencyKey,
            dedupeKey: item.dedupeKey,
            casePath: item.casePath,
            alertUrl: item.alertUrl,
            watchlist: item.watchlist,
            status: item.status,
            destination: latest.destination,
            retry: item.retry,
            audit: {
                latestAuditEventId: item.latestAuditEventId,
                auditEventIds: item.auditEventIds,
                nextAction: primaryAction === 'retry_dry_run' || primaryAction === 'retry_live'
                    ? 'delivery.retry_requested'
                    : primaryAction === 'rotate_or_disable_destination'
                        ? 'destination.update_requested'
                        : primaryAction === 'enable_destination'
                            ? 'destination.enable_requested'
                            : primaryAction === 'test_destination'
                                ? 'delivery.test_requested'
                                : null,
            },
            routes: {
                deliveryList: 'GET /api/dwm/webhook-deliveries',
                retry: 'POST /api/dwm/webhook-deliveries',
                testDestination: latest.destinationId ? `POST /api/dwm/webhook-destinations/${latest.destinationId}/test` : null,
                updateDestination: latest.destinationId ? `PUT /api/dwm/webhook-destinations/${latest.destinationId}` : null,
            },
            operationLinks: latest.operationLinks,
            remediation,
            requests: {
                dryRunRetry: dryRunRequest
                    ? {
                        canSend: dryRunRequest.canSend,
                        noNetwork: true,
                        externalSendEnabled: false,
                        body: dryRunRequest.body,
                        blockers: dryRunRequest.blockers,
                    }
                    : null,
                liveRetry: liveRequest
                    ? {
                        canSend: liveRequest.canSend,
                        noNetwork: false,
                        externalSendEnabled: liveRequest.externalSendEnabled,
                        body: liveRequest.canSend ? liveRequest.body : null,
                        blockers: liveRequest.blockers,
                    }
                    : null,
                testDestination: testDestinationRequest,
            },
            blockers,
            blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
            noNetwork: true,
            externalSendEnabled: liveRequest?.externalSendEnabled === true,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_action_plan.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: actions.some(action => action.externalSendEnabled),
        visibility: timeline.visibility,
        access: timeline.access,
        filters: timeline.filters,
        counts: {
            total: actions.length,
            retryDryRun: actions.filter(action => action.action === 'retry_dry_run').length,
            retryLive: actions.filter(action => action.action === 'retry_live').length,
            rotateOrDisable: actions.filter(action => action.action === 'rotate_or_disable_destination').length,
            enableDestination: actions.filter(action => action.action === 'enable_destination').length,
            monitor: actions.filter(action => action.action === 'monitor').length,
            blocked: actions.filter(action => action.blockingCodes.length > 0).length,
            permissionDenied: timeline.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: timeline.blockers,
        actions,
    }
}

function deliveryActionRemediation({
    action,
    orgId,
    destinationId,
    deliveryId,
    alertId,
    casePath,
    dedupeKey,
    retryable,
    terminalFailure,
    delivered,
    destinationUnavailable,
    destinationDisabled,
    blockers,
    liveDeliveryEnabled,
}: {
    action: string
    orgId: string
    destinationId: string | null
    deliveryId: string | null
    alertId: string | null
    casePath: string | null
    dedupeKey: string | null
    retryable: boolean
    terminalFailure: boolean
    delivered: boolean
    destinationUnavailable: boolean
    destinationDisabled: boolean
    blockers: ReturnType<typeof retryQueueBlocker>[]
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const code = blockingCodes.includes('permission_denied')
        ? 'permission_denied'
        : destinationUnavailable
            ? 'configure_destination'
            : destinationDisabled
                ? 'enable_destination'
                : terminalFailure
                    ? 'rotate_or_disable_destination'
                    : retryable
                        ? 'retry_dry_run'
                        : delivered
                            ? 'monitor_delivery'
                            : 'test_destination'
    const nextSafeStep = code === 'retry_dry_run'
        ? 'Run a dry-run retry and inspect the recorded delivery receipt before enabling live delivery.'
        : code === 'configure_destination'
            ? 'Create or select an enabled org webhook destination, then run a dry-run test.'
            : code === 'enable_destination'
                ? 'Enable the destination and run a dry-run test before replaying alert delivery.'
                : code === 'rotate_or_disable_destination'
                    ? 'Rotate the webhook URL or disable the destination, then run a dry-run test to clear the terminal failure.'
                    : code === 'permission_denied'
                        ? 'Ask an organization owner or admin to review the destination and delivery history.'
                        : code === 'monitor_delivery'
                            ? 'No resend is needed; keep the delivery receipt and audit event for inspection.'
                            : 'Run a destination dry-run test to verify the Discord payload and destination health.'

    return {
        schemaVersion: 'dwm.webhook.delivery_remediation.v1',
        code,
        action,
        status: delivered ? 'resolved' : blockingCodes.length > 0 ? 'blocked' : 'ready',
        priority: terminalFailure || destinationUnavailable || destinationDisabled ? 'high' : retryable ? 'normal' : 'low',
        nextSafeStep,
        liveDeliveryEnabled,
        noNetworkDefault: true,
        externalSendEnabled: false,
        context: {
            orgId,
            destinationId,
            deliveryId,
            alertId,
            casePath,
            dedupeKey,
        },
        blockers: blockers.map(blocker => ({
            code: blocker.code,
            destinationId: blocker.destinationId,
            blocking: blocker.blocking,
        })),
        routeHints: {
            deliveryHistory: 'GET /api/dwm/webhook-deliveries',
            destinationTest: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : null,
            destinationUpdate: destinationId ? `PUT /api/dwm/webhook-destinations/${destinationId}` : null,
            dryRunReplay: 'POST /api/dwm/webhook-deliveries',
        },
        readiness: {
            dryRunReplayReady: code === 'retry_dry_run',
            liveReplayBlocked: !liveDeliveryEnabled,
            terminalFailure,
            destinationUnavailable,
            destinationDisabled,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
    }
}

export function buildDwmWebhookDeliveryReplayGuard({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canReplay'] as const)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                replayKeys: 0,
                dryRunAllowed: 0,
                liveBlocked: 0,
                duplicateDelivered: 0,
                retryable: 0,
                terminalFailure: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook delivery replay guard is not visible for this organization membership.', normalizedFilters.destinationId, true)],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const receipts = buildDwmWebhookDeliveryReceipts({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const receiptByIdempotencyKey = new Map<string, typeof receipts.receipts[number]>()
    for (const receipt of receipts.receipts) {
        if (!receipt.idempotencyKey) continue
        const current = receiptByIdempotencyKey.get(receipt.idempotencyKey)
        if (!current || String(receipt.proof.attemptedAt || receipt.proof.createdAt).localeCompare(String(current.proof.attemptedAt || current.proof.createdAt)) > 0) {
            receiptByIdempotencyKey.set(receipt.idempotencyKey, receipt)
        }
    }

    const entries = persistence.deliveryKeys
        .map((key) => {
            const latestReceipt = receiptByIdempotencyKey.get(key.idempotencyKey) || null
            const blockers = []
            if (!access.canReplay) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can replay webhook deliveries.', key.destinationId, true))
            if (key.destination.status && key.destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot receive replay deliveries.', key.destinationId, true))
            const alreadyDelivered = key.dedupe.alreadyDelivered || key.status === 'delivered'
            if (alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'A live delivery already exists for this destination and idempotency key.', key.destinationId, true))
            if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and should be remediated before replay.', key.destinationId, true))
            if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; replay proof is dry-run only.', key.destinationId, false))
            if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Replay guard has no linked audit event yet.', key.destinationId, false))
            const uniqueBlockers = uniqueWebhookBlockers(blockers)
            const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
            const dryRunAllowed = access.canReplay && !blockingCodes.includes('permission_denied')
            const liveAllowed = dryRunAllowed && liveDeliveryEnabled && !alreadyDelivered && !key.retry.terminalFailure && blockingCodes.length === 0

            return {
                schemaVersion: 'dwm.webhook.delivery_replay_guard_entry.v1',
                idempotencyKey: key.idempotencyKey,
                orgId: key.orgId,
                destinationId: key.destinationId,
                alertId: key.alertId,
                eventType: key.eventType,
                dedupeKey: key.dedupe.latestDedupeKey || key.dedupeKey || dedupeFromIdempotencyKey(key.idempotencyKey) || null,
                watchlistId: key.watchlistId,
                watchlistName: key.watchlistName,
                route: key.route,
                casePath: key.casePath,
                replay: key.replay,
                status: key.status,
                destination: key.destination,
                guard: {
                    dryRunAllowed,
                    liveAllowed,
                    liveBlocked: !liveAllowed,
                    duplicateLiveBlocked: alreadyDelivered,
                    duplicateDryRunAllowed: dryRunAllowed,
                    noNetworkDefault: true,
                    externalSendEnabled: liveAllowed,
                },
                dedupe: key.dedupe,
                retry: key.retry,
                latestAttempt: key.latestAttempt,
                latestReceipt,
                audit: key.audit,
                blockers: uniqueBlockers,
                blockingCodes,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.delivery_replay_guard.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.guard.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            replayKeys: entries.filter(entry => entry.replay || entry.eventType === 'dwm.alert.replayed').length,
            dryRunAllowed: entries.filter(entry => entry.guard.dryRunAllowed).length,
            liveBlocked: entries.filter(entry => entry.guard.liveBlocked).length,
            duplicateDelivered: entries.filter(entry => entry.guard.duplicateLiveBlocked).length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
        },
        blockers: uniqueWebhookBlockers(entries.flatMap(entry => entry.blockers)),
        entries,
    }
}

export function buildDwmWebhookDeliveryRetryPersistence({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    now = new Date(),
}: {
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    now?: Date
}) {
    const { ledger, auditContracts } = buildDwmWebhookDeliveryProjectionBundle({ deliveries, auditEvents, destinations, filters, now })
    return buildDwmWebhookDeliveryRetryPersistenceFromProjection({ destinations, filters, liveDeliveryEnabled, ledger, auditContracts })
}

export function buildDwmWebhookDeliveryRetryQueue({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const { decision, access } = webhookDeliveryVisibilityAccess(visibility, viewerRole, canManage)
    const deniedBlocker = retryQueueBlocker('permission_denied', 'Webhook delivery retry queue is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            filters: {
                orgId: clean(filters.orgId) || null,
                destinationId: clean(filters.destinationId) || null,
                alertId: clean(filters.alertId) || null,
                casePath: clean(filters.casePath) || null,
                dedupeKey: clean(filters.dedupeKey) || null,
                requestId: clean(filters.requestId) || clean(filters.deliveryId) || null,
            },
            counts: {
                total: 0,
                retryable: 0,
                dryRunReady: 0,
                liveReady: 0,
                blocked: 0,
                delivered: 0,
                terminalFailure: 0,
                auditLinked: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const persistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
    })
    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))
    const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))
    const entries = persistence.deliveryKeys.map((key) => {
        const destinationId = key.destinationId || null
        const destination = destinationId ? destinationsById.get(destinationId) || null : null
        const health = destinationId ? healthByDestination.get(destinationId) || null : null
        const blockers = []
        if (!access.canRetry) blockers.push(retryQueueBlocker('permission_denied', 'Only organization owners and admins can retry webhook deliveries.', key.destinationId, true))
        if (destination && destination.status !== 'active') blockers.push(retryQueueBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', key.destinationId, true))
        if (!key.destination.redactedEndpoint.endpointHash && !key.destination.redactedEndpoint.endpointHint) blockers.push(retryQueueBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', key.destinationId, true))
        if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; dry-run retry proof is still available.', key.destinationId, false))
        if (key.dedupe.alreadyDelivered) blockers.push(retryQueueBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the idempotency key.', key.destinationId, true))
        if (key.retry.terminalFailure) blockers.push(retryQueueBlocker('terminal_failure', 'Latest delivery failure is terminal and not eligible for retry.', key.destinationId, true))
        if (!key.retry.retryable && !key.dedupe.alreadyDelivered && !key.retry.terminalFailure) blockers.push(retryQueueBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', key.destinationId, true))
        if (!key.audit.latestAuditEventId) blockers.push(retryQueueBlocker('audit_missing', 'Retry queue entry has no linked audit event yet.', key.destinationId, false))
        const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const dryRunReady = access.canRetry && key.retry.retryable && blockingCodes.length === 0
        const liveReady = dryRunReady && liveDeliveryEnabled

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_queue_entry.v1',
            idempotencyKey: key.idempotencyKey,
            orgId: key.orgId,
            destinationId: key.destinationId,
            alertId: key.alertId,
            eventType: key.eventType,
            watchlistId: key.watchlistId,
            watchlistName: key.watchlistName,
            route: key.route,
            casePath: key.casePath,
            replay: key.replay,
            status: key.status,
            destination: key.destination,
            health: {
                status: health?.health || null,
                ready: health?.ready || false,
                blockers: health?.blockers || [],
                latestAuditEventId: health?.latestAuditEventId || null,
            },
            retry: {
                ...key.retry,
                dryRunReady,
                liveReady,
                mode: liveReady ? 'live' : dryRunReady ? 'dry_run' : 'blocked',
            },
            dedupe: key.dedupe,
            latestAttempt: key.latestAttempt,
            attempts: key.attempts,
            audit: key.audit,
            blockers: uniqueWebhookBlockers(blockers),
            blockingCodes,
            noNetwork: true,
            externalSendEnabled: liveReady,
        }
    })
    const blockers = uniqueWebhookBlockers(entries.flatMap(entry => entry.blockers))

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_queue.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: decision,
        access,
        filters: persistence.filters,
        counts: {
            total: entries.length,
            retryable: entries.filter(entry => entry.retry.retryable).length,
            dryRunReady: entries.filter(entry => entry.retry.dryRunReady).length,
            liveReady: entries.filter(entry => entry.retry.liveReady).length,
            blocked: entries.filter(entry => entry.blockingCodes.length > 0).length,
            delivered: entries.filter(entry => entry.dedupe.alreadyDelivered).length,
            terminalFailure: entries.filter(entry => entry.retry.terminalFailure).length,
            auditLinked: entries.filter(entry => Boolean(entry.audit.latestAuditEventId)).length,
        },
        blockers,
        entries,
    }
}

export function buildDwmWebhookDeliveryRetryRequestContract({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const entries = retryQueue.entries.map((entry) => {
        const dedupeKey = entry.dedupe.latestDedupeKey || dedupeFromIdempotencyKey(entry.idempotencyKey) || entry.alertId
        const requestAlert = {
            id: entry.alertId,
            dedupeKey,
            casePath: entry.casePath,
            watchlist: {
                id: entry.watchlistId,
                name: entry.watchlistName,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.idempotencyKey,
            },
        }
        const baseBody = {
            orgId: entry.orgId,
            organizationId: entry.orgId,
            destinationId: entry.destinationId,
            eventType: entry.eventType,
            alertId: entry.alertId,
            dedupeKey,
            route: entry.route,
            casePath: entry.casePath,
            watchlistItemId: entry.watchlistId,
            watchlistId: entry.watchlistId,
            watchlistName: entry.watchlistName,
            alert: requestAlert,
        }
        const dryRunBlockers = uniqueWebhookBlockers(entry.blockers.filter(blocker => blocker.blocking))
        const liveBlockers = uniqueWebhookBlockers(
            liveDeliveryEnabled
                ? entry.blockers.filter(blocker => blocker.blocking)
                : [
                    ...entry.blockers,
                    retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; retry request is dry-run only.', entry.destinationId, true),
                ]
        )
        const canDryRun = retryQueue.access.canRetry && entry.retry.dryRunReady
        const canLive = retryQueue.access.canRetry && entry.retry.liveReady

        return {
            schemaVersion: 'dwm.webhook.delivery_retry_request_entry.v1',
            idempotencyKey: entry.idempotencyKey,
            orgId: entry.orgId,
            destinationId: entry.destinationId,
            alertId: entry.alertId,
            eventType: entry.eventType,
            requestId: entry.latestAttempt.requestId,
            deliveryId: entry.latestAttempt.deliveryId,
            casePath: entry.casePath,
            replay: entry.replay,
            status: entry.status,
            destination: entry.destination,
            retry: entry.retry,
            dedupe: entry.dedupe,
            audit: entry.audit,
            blockers: entry.blockers,
            canRetry: canDryRun,
            noNetwork: true,
            externalSendEnabled: canLive,
            routes: {
                dryRun: 'POST /api/dwm/webhook-deliveries',
                live: 'POST /api/dwm/webhook-deliveries',
            },
            dryRunRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRun,
                blockers: canDryRun ? [] : dryRunBlockers,
                body: {
                    ...baseBody,
                    dryRun: true,
                    live: false,
                },
            },
            liveRequest: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: false,
                externalSendEnabled: canLive,
                canSend: canLive,
                blockers: canLive ? [] : liveBlockers,
                body: {
                    ...baseBody,
                    dryRun: false,
                    live: true,
                },
            },
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_retry_request.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: entries.some(entry => entry.externalSendEnabled),
        visibility: retryQueue.visibility,
        access: retryQueue.access,
        filters: retryQueue.filters,
        routes: {
            retry: 'POST /api/dwm/webhook-deliveries',
            deliveryList: 'GET /api/dwm/webhook-deliveries',
        },
        counts: {
            total: entries.length,
            dryRunReady: entries.filter(entry => entry.dryRunRequest.canSend).length,
            liveReady: entries.filter(entry => entry.liveRequest.canSend).length,
            blocked: entries.filter(entry => !entry.dryRunRequest.canSend).length,
            permissionDenied: retryQueue.blockers.some(blocker => blocker.code === 'permission_denied'),
        },
        blockers: retryQueue.blockers,
        entries,
    }
}

export function buildDwmWebhookDeliveryRetryWorkOrders({
    destinations,
    deliveries = [],
    auditEvents = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationDeliveryAccessOptions) {
    const retryRequest = buildDwmWebhookDeliveryRetryRequestContract({
        destinations,
        deliveries,
        auditEvents,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryRetryWorkOrdersProjection(retryRequest, liveDeliveryEnabled)
}

export function buildDwmWebhookDestinationDeliveryMatrix({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canTest', 'canRetry'] as const)
    if (!decision.allowed) {
        const blocker = destinationMatrixBlocker('permission_denied', 'Webhook destination delivery matrix is not visible for this organization membership.', null, true)
        return {
            schemaVersion: 'dwm.webhook.destination_delivery_matrix.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                deliveryConfiguredCount: 0,
                retryReadyCount: 0,
                blockedCount: 0,
                latestDeliveryAt: null,
            },
            blockers: [blocker],
            destinations: [],
            routes: {
                destinationList: 'GET /api/dwm/webhooks?orgId=<org_id>',
                deliveryList: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
                testDestination: 'POST /api/dwm/webhook-destinations/:id/test',
                triggerDelivery: 'POST /api/dwm/webhook-deliveries',
            },
        }
    }

    const healthRows = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const operations = buildDwmWebhookDeliveryOperations({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const retryQueue = buildDwmWebhookDeliveryRetryQueue({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const auditContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    return buildDwmWebhookDestinationDeliveryMatrixProjection({
        destinations,
        healthRows,
        operations,
        retryQueue,
        auditContracts,
        liveDeliveryEnabled,
        decision,
        access,
        healthStates: destinationHealthStates,
    })
}

export function buildDwmWebhookDestinationLookupContract({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const matrix = buildDwmWebhookDestinationDeliveryMatrix({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: matrix.destinations.length ? destinations : [],
        deliveries: matrix.destinations.length ? deliveries : [],
        auditEvents: matrix.destinations.length ? auditEvents : [],
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    const adminByDestination = new Map(adminProof.destinations.map(destination => [destination.destinationId, destination]))
    const rows = matrix.destinations.map((destination) => {
        const proof = adminByDestination.get(destination.destinationId) || null
        return {
            schemaVersion: 'dwm.webhook.destination_lookup_row.v1',
            orgId: destination.orgId,
            destinationId: destination.destinationId,
            label: destination.label,
            type: destination.type,
            status: destination.status,
            enabled: destination.enabled,
            redactedDestination: {
                id: destination.destinationId,
                label: destination.label,
                type: destination.type,
                endpointHint: destination.redactedEndpoint.endpointHint,
                endpointHash: destination.redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            subscribedEvents: destination.subscribedEvents,
            delivery: {
                latestDeliveryAt: destination.deliveryProof.latestDeliveryAt,
                lastTestId: destination.deliveryProof.lastTest?.deliveryId || null,
                lastOrgAlertId: destination.deliveryProof.lastOrgAlert?.deliveryId || null,
                lastReplayId: destination.deliveryProof.lastReplayed?.deliveryId || null,
                latestAuditEventId: destination.health.latestAuditEventId || destination.audit.latestAuditEventId,
            },
            retry: {
                ready: destination.retry.ready,
                nextRetryAt: destination.retry.nextRetryAt,
                lastErrorCategory: destination.retry.lastErrorCategory,
                idempotencyKey: destination.retry.idempotencyKey,
            },
            replay: destination.replay,
            health: {
                status: destination.health.status,
                ready: destination.health.ready,
                states: destination.health.states,
                blockers: destination.health.blockers,
                productProgressStatus: adminProof.productProgress.status,
            },
            idempotency: {
                duplicateKeyCount: proof?.dedupe.duplicateKeyCount || 0,
                alreadyDelivered: proof?.dedupe.alreadyDelivered || false,
                latestDedupeKey: proof?.dedupe.latestDedupeKey || destination.replay.latestDedupeKey || null,
            },
            audit: {
                latestAuditEventId: destination.audit.latestAuditEventId || proof?.audit.latestAuditEventId || null,
                auditEventIds: destination.audit.auditEventIds,
                contracts: canManage ? destination.audit.auditEventContracts : [],
            },
            routes: {
                destinationDetail: `GET /api/dwm/webhooks?orgId=${encodeURIComponent(destination.orgId)}&destinationId=${encodeURIComponent(destination.destinationId)}`,
                deliveryHistory: destination.routes.detail,
                test: destination.routes.test,
                update: `PUT /api/dwm/webhook-destinations/${encodeURIComponent(destination.destinationId)}`,
                disable: destination.routes.delete,
                delete: destination.routes.delete,
                retryDryRun: matrix.routes.triggerDelivery,
            },
            blockers: destination.blockers,
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.destination_lookup.v1',
        noNetwork: true,
        liveDeliveryEnabled,
        visibility: matrix.visibility,
        access: matrix.access,
        routeContract: {
            schemaVersion: 'dwm.webhook.destination_lookup_routes.v1',
            list: {
                method: 'GET' as const,
                route: '/api/dwm/webhooks',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId'],
                responseRowSchema: 'dwm.webhook.destination_lookup_row.v1',
                noNetwork: true,
            },
            update: {
                method: 'PUT' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredBody: ['orgId'],
                optionalBody: ['name', 'label', 'endpointUrl', 'kind', 'events', 'status'],
                noNetwork: true,
            },
            test: {
                method: 'POST' as const,
                route: '/api/dwm/webhook-destinations/:id/test',
                requiredBody: ['orgId', 'dryRun'],
                noNetworkDefault: true,
            },
            disable: {
                method: 'DELETE' as const,
                route: '/api/dwm/webhook-destinations/:id',
                requiredQuery: ['orgId'],
                noNetwork: true,
            },
        },
        summary: {
            destinationCount: rows.length,
            activeDestinationCount: rows.filter(row => row.enabled).length,
            readyDestinationCount: rows.filter(row => row.health.ready).length,
            retryReadyCount: rows.filter(row => row.retry.ready).length,
            auditLinkedCount: rows.filter(row => row.audit.latestAuditEventId).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
        },
        productProgress: adminProof.productProgress,
        destinations: rows,
        blockers: matrix.blockers,
    }
}

export function buildDwmWebhookDeliveryRetryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const orgId = firstClean(normalizedInput.orgId, normalizedInput.organizationId, normalizedInput.tenantId)
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.replayed')
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const alertContext = recordOrEmpty(normalizedInput.alert)
    const alertId = firstClean(normalizedInput.alertId, alertContext.id, alertContext.alertId)
    const dedupeKey = firstClean(normalizedInput.dedupeKey, alertContext.dedupeKey, alertId)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const destinationHealth = buildDwmWebhookDestinationHealth({ destinations, deliveries, auditEvents, liveDeliveryEnabled })
    const healthByDestination = new Map(destinationHealth.map(health => [health.destinationId, health]))
    const ledger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const selectedIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const candidateDestinationIds = destinationId ? [destinationId] : [
        ...dispatch.selectedDestinations.map(destination => destination.id),
        ...dispatch.skippedDestinations.map(destination => destination.id),
    ]
    const blockers: Array<{
        code: DwmWebhookDeliveryOperationBlockerCode
        message: string
        destinationId: string | null
        retryable: boolean
    }> = []

    if (!orgId) blockers.push(operationBlocker('missing_org', 'Organization context is required before retrying webhook delivery.'))
    if (!alertId && !dedupeKey) blockers.push(operationBlocker('missing_alert_context', 'Alert id or dedupe key is required before retrying webhook delivery.'))
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(operationBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    if (destinationId && !destinations.some(destination => destination.id === destinationId)) {
        blockers.push(operationBlocker('not_found', 'Destination is not available for this organization.', destinationId))
    }

    for (const candidateId of candidateDestinationIds) {
        const destination = destinations.find(item => item.id === candidateId)
        const health = candidateId ? healthByDestination.get(candidateId) || null : null
        if (!destination) continue
        if (destination.status !== 'active') {
            blockers.push(operationBlocker('destination_disabled', 'Destination is disabled and cannot be retried.', destination.id))
        }
        if (!destination.endpointHint || !destination.endpointHash) {
            blockers.push(operationBlocker('missing_webhook_url', 'Destination does not have a configured webhook URL.', destination.id))
        }
        if (health && !health.ready && !health.blockers.every(blocker => blocker === 'live_delivery_disabled' || blocker === 'retry_scheduled')) {
            blockers.push(operationBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }
    }

    const targetIds = selectedIds.size > 0 ? selectedIds : new Set(candidateDestinationIds.filter(Boolean))
    for (const targetId of targetIds) {
        const idempotencyKey = orgId && targetId && dedupeKey
            ? buildIdempotencyKey(eventType, orgId, targetId, dedupeKey)
            : ''
        if (!idempotencyKey) continue
        const related = ledger.filter(attempt => attempt.idempotencyKey === idempotencyKey)
        const sent = related.find(attempt => attempt.status === 'sent')
        const latest = [...related].sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))[0]
        if (sent) {
            blockers.push(operationBlocker('dedupe_already_delivered', 'This alert/destination idempotency key has already been delivered.', targetId))
        } else if (latest && !latest.retryable && latest.status !== 'queued') {
            blockers.push(operationBlocker('retry_not_eligible', 'Latest delivery attempt is not eligible for retry.', targetId))
        }
    }

    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    return {
        schemaVersion: 'dwm.webhook.delivery_retry.v1',
        ownerId,
        orgId: orgId || null,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        canRetry: canManage && uniqueBlockers.length === 0,
        canTest: canManage && uniqueBlockers.every(blocker => blocker.code !== 'missing_org' && blocker.code !== 'not_found'),
        access: {
            canManage,
            canRetry: canManage,
            canTest: canManage,
        },
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        deliveryOperations: buildDwmWebhookDeliveryOperations({
            deliveries,
            auditEvents,
            destinations,
            filters: {
                orgId,
                destinationId: destinationId || undefined,
                alertId: alertId || undefined,
                dedupeKey: dedupeKey || undefined,
            },
            liveDeliveryEnabled,
        }),
    }
}

export function buildDwmWebhookDeliveryAuditTrail({
    auditEvents,
    deliveries = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: {
    auditEvents: DwmWebhookAuditPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    destinations?: DwmWebhookDestinationPublic[]
    filters?: DwmWebhookDeliveryEvidenceFilters
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage'] as const)
    const normalizedFilters = normalizeWebhookEvidenceFilters(filters)
    const deniedBlocker = auditTrailBlocker('permission_denied', 'Webhook delivery audit trail is not visible for this organization membership.', null, true)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.audit_trail.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            visibility: decision,
            access,
            filters: normalizedFilters,
            counts: {
                total: 0,
                destination: 0,
                delivery: 0,
                failed: 0,
                retryable: 0,
                replay: 0,
                memberSafe: 0,
            },
            blockers: [deniedBlocker],
            entries: [],
        }
    }

    const auditContracts = buildDwmWebhookAuditEventContracts({ auditEvents, deliveries, destinations })
    const retryWorkOrders = buildDwmWebhookDeliveryRetryWorkOrders({
        auditEvents,
        deliveries,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const retryByDeliveryId = new Map(retryWorkOrders.workOrders.map(order => [order.deliveryId, order]))
    const entries = auditContracts
        .filter((audit) => {
            if (normalizedFilters.orgId && audit.orgId !== normalizedFilters.orgId) return false
            if (normalizedFilters.destinationId && audit.destinationId !== normalizedFilters.destinationId) return false
            if (normalizedFilters.requestId && audit.deliveryId !== normalizedFilters.requestId && audit.requestId !== normalizedFilters.requestId) return false
            if (normalizedFilters.alertId && audit.delivery?.alertId !== normalizedFilters.alertId) return false
            if (normalizedFilters.casePath && audit.delivery?.casePath !== normalizedFilters.casePath) return false
            if (normalizedFilters.dedupeKey) {
                const deliveryDedupeKey = audit.delivery?.idempotencyKey
                    ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey)
                    : null
                if (audit.delivery?.idempotencyKey !== normalizedFilters.dedupeKey && deliveryDedupeKey !== normalizedFilters.dedupeKey) return false
            }
            return true
        })
        .map((audit) => {
            const retryWorkOrder = audit.deliveryId ? retryByDeliveryId.get(audit.deliveryId) || null : null
            const replay = audit.delivery?.eventType === 'dwm.alert.replayed' || audit.action === 'delivery.replayed'
            const summary = audit.category === 'destination'
                ? `${audit.outcome} destination ${audit.destination?.label || audit.destinationId || 'webhook destination'}`
                : `${audit.outcome} ${audit.delivery?.eventType || 'webhook delivery'} for alert ${audit.delivery?.alertId || 'unknown'}`
            const retryActionRequest = retryWorkOrder
                ? {
                    action: retryWorkOrder.state === 'dry_run_ready' || retryWorkOrder.state === 'live_ready'
                        ? 'retry_delivery'
                        : retryWorkOrder.state === 'already_delivered'
                            ? 'review_duplicate'
                            : retryWorkOrder.state === 'terminal_failure'
                                ? 'remediate_destination'
                                : 'review_blocker',
                    method: 'POST',
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: access.canManage && retryWorkOrder.eligibility.dryRunReady,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && retryWorkOrder.eligibility.dryRunReady
                        ? retryWorkOrder.request.dryRunBody
                        : null,
                    expectedAuditAction: retryWorkOrder.audit.nextAction,
                    expectedStatus: retryWorkOrder.eligibility.dryRunReady ? 'dry_run' : 'blocked',
                    blockers: retryWorkOrder.eligibility.blockers,
                }
                : null
            const destinationTestRequest = !retryActionRequest && audit.destinationId
                ? {
                    action: 'test_destination',
                    method: 'POST',
                    route: `POST /api/dwm/webhook-destinations/${audit.destinationId}/test`,
                    canSend: access.canManage && audit.destination?.enabled === true,
                    noNetwork: true,
                    externalSendEnabled: false,
                    body: access.canManage && audit.destination?.enabled === true
                        ? {
                            orgId: audit.orgId,
                            destinationId: audit.destinationId,
                            eventType: 'dwm.alert.test' as DwmAlertEventType,
                            dryRun: true,
                            live: false,
                            idempotencyKey: buildIdempotencyKey('dwm.alert.test', audit.orgId, audit.destinationId, 'webhook_test'),
                        }
                        : null,
                    expectedAuditAction: 'delivery.tested',
                    expectedStatus: access.canManage && audit.destination?.enabled === true ? 'dry_run' : 'blocked',
                    blockers: audit.destination?.enabled === true
                        ? []
                        : [auditTrailBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', audit.destinationId, true)],
                }
                : null

            return {
                schemaVersion: 'dwm.webhook.audit_trail_entry.v1',
                auditEventId: audit.auditEventId,
                action: audit.action,
                category: audit.category,
                outcome: audit.outcome,
                severity: audit.severity,
                orgId: audit.orgId,
                destinationId: audit.destinationId,
                deliveryId: audit.deliveryId,
                requestId: audit.requestId,
                actorId: access.canManage ? audit.actorId : null,
                customerSummary: truncate(summary, 180),
                destination: audit.destination,
                delivery: audit.delivery
                    ? {
                        alertId: audit.delivery.alertId,
                        eventType: audit.delivery.eventType,
                        status: audit.delivery.status,
                        dryRun: audit.delivery.dryRun,
                        live: audit.delivery.live,
                        replay,
                        idempotencyKey: audit.delivery.idempotencyKey,
                        dedupeKey: audit.delivery.idempotencyKey ? dedupeFromIdempotencyKey(audit.delivery.idempotencyKey) : null,
                        payloadHash: audit.delivery.payloadHash,
                        responseStatus: audit.delivery.responseStatus,
                        error: audit.delivery.error,
                        watchlistId: audit.delivery.watchlistId,
                        watchlistName: audit.delivery.watchlistName,
                        route: audit.delivery.route,
                        casePath: audit.delivery.casePath,
                        attemptedAt: audit.delivery.attemptedAt,
                        updatedAt: audit.delivery.updatedAt,
                    }
                    : null,
                retry: retryWorkOrder
                    ? {
                        state: retryWorkOrder.state,
                        nextRetryAt: retryWorkOrder.eligibility.nextRetryAt,
                        attemptCount: retryWorkOrder.eligibility.attemptCount,
                        lastErrorCategory: retryWorkOrder.eligibility.lastErrorCategory,
                        canRetry: access.canManage && retryWorkOrder.eligibility.canRetry,
                        nextAuditAction: retryWorkOrder.audit.nextAction,
                    }
                    : audit.retry,
                metadata: access.canManage ? audit.metadata : null,
                actionRequest: retryActionRequest || destinationTestRequest,
                routes: {
                    delivery: audit.deliveryId ? `GET /api/dwm/webhook-deliveries?deliveryId=${audit.deliveryId}` : null,
                    destination: audit.destinationId ? `GET /api/dwm/webhooks?destinationId=${audit.destinationId}` : null,
                    retry: retryWorkOrder ? 'POST /api/dwm/webhook-deliveries' : null,
                    testDestination: audit.destinationId ? `POST /api/dwm/webhook-destinations/${audit.destinationId}/test` : null,
                },
                memberSafe: access.memberSafe,
                createdAt: audit.createdAt,
            }
        })

    return {
        schemaVersion: 'dwm.webhook.audit_trail.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        visibility: decision,
        access,
        filters: normalizedFilters,
        counts: {
            total: entries.length,
            destination: entries.filter(entry => entry.category === 'destination').length,
            delivery: entries.filter(entry => entry.category === 'delivery').length,
            failed: entries.filter(entry => entry.outcome === 'failed').length,
            retryable: entries.filter(entry => Boolean(entry.retry?.nextRetryAt)).length,
            replay: entries.filter(entry => entry.delivery?.replay).length,
            memberSafe: entries.filter(entry => entry.memberSafe).length,
        },
        blockers: [],
        entries,
    }
}

export function filterDwmWebhookDeliveryEvidenceForVisibility({
    evidence,
    visibility,
}: {
    evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>
    visibility: DwmWebhookEvidenceVisibilityInput
}) {
    const decision = organizationVisibilityDecision(visibility)
    return {
        decision,
        deliveryEvidence: decision.allowed ? evidence : [],
    }
}

export function buildDwmWebhookDestinationContracts({
    destinations,
    deliveries = [],
    auditEvents = [],
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
}) {
    return destinations.map((destination) => {
        const destinationDeliveries = deliveries
            .filter(delivery => delivery.destinationId === destination.id)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const destinationAudits = auditEvents
            .filter(audit => audit.destinationId === destination.id)
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const lastTestDelivery = destinationDeliveries.find(delivery => delivery.eventType === 'dwm.alert.test')
        const lastDelivery = destinationDeliveries.find(delivery => delivery.eventType !== 'dwm.alert.test')
        const testAudit = lastTestDelivery ? destinationAudits.find(audit => audit.deliveryId === lastTestDelivery.id) : null
        const deliveryAudit = lastDelivery ? destinationAudits.find(audit => audit.deliveryId === lastDelivery.id) : null
        const failureReason = redactNullableDeliveryText(destination.lastTestError || lastDelivery?.error || lastTestDelivery?.error || null)
        const lastTestStatus = lastTestDelivery?.status || (destination.lastTestStatus === 'delivered' ? 'unknown' : destination.lastTestStatus || null)

        return {
            id: destination.id,
            orgId: destination.orgId,
            type: destination.kind,
            kind: destination.kind,
            label: destination.name,
            name: destination.name,
            display: {
                label: destination.name,
                channelLabel: destination.kind === 'discord' ? destination.name : null,
                destinationType: destination.kind,
                enabled: destination.status === 'active',
                status: destination.status,
            },
            status: destination.status,
            enabled: destination.status === 'active',
            events: destination.events,
            redactedUrl: redactDeliveryEvidenceText(destination.endpointHint),
            redactedDestination: {
                endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                endpointHash: destination.endpointHash,
            },
            createdBy: destination.createdBy,
            actorId: destination.createdBy,
            lastTest: {
                at: destination.lastTestedAt || lastTestDelivery?.attemptedAt || null,
                status: lastTestStatus,
                dryRun: lastTestDelivery?.dryRun ?? null,
                live: lastTestDelivery?.status === 'delivered' && lastTestDelivery.dryRun === false,
                httpStatus: destination.lastTestHttpStatus || lastTestDelivery?.responseStatus || null,
                failureReason: redactNullableDeliveryText(destination.lastTestError || lastTestDelivery?.error || null),
                requestId: lastTestDelivery?.id || null,
                auditEventId: testAudit?.id || null,
            },
            lastDelivery: {
                at: destination.lastDeliveryAt || lastDelivery?.attemptedAt || null,
                status: lastDelivery?.status || null,
                requestId: lastDelivery?.id || null,
                auditEventId: deliveryAudit?.id || null,
                failureReason: redactNullableDeliveryText(lastDelivery?.error || null),
            },
            failureReason,
            latestAuditEventId: destinationAudits[0]?.id || null,
            auditEventIds: destinationAudits.map(audit => audit.id),
            createdAt: destination.createdAt,
            updatedAt: destination.updatedAt,
        }
    })
}

export function buildDwmWebhookDeliveryReadiness({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const destinationContracts = buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    return buildDwmWebhookDeliveryReadinessFromProjection({
        destinationContracts,
        deliveryLedger,
        liveDeliveryEnabled,
    })
}

function buildDwmWebhookDeliveryReadinessFromProjection({
    destinationContracts,
    deliveryLedger,
    liveDeliveryEnabled,
}: {
    destinationContracts: ReturnType<typeof buildDwmWebhookDestinationContracts>
    deliveryLedger: ReturnType<typeof buildDwmWebhookDeliveryLedger>
    liveDeliveryEnabled: boolean
}) {
    const attemptsByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = attemptsByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        attemptsByDestination.set(attempt.destinationId, attempts)
    }
    const destinationReadiness = destinationContracts.map((destination) => {
        const attempts = (attemptsByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = attempts[0] || null
        const blockers = destinationReadinessBlockers({ destination, latestAttempt, liveDeliveryEnabled })
        const ready = blockers.filter(blocker => blocker !== 'live_delivery_disabled').length === 0
        const retryState = latestAttempt
            ? {
                retryable: latestAttempt.retryable,
                nextRetryAt: latestAttempt.nextRetryAt,
                errorClass: latestAttempt.errorClass,
                reason: latestAttempt.retryReason,
                attemptCount: latestAttempt.attemptCount,
            }
            : { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 }

        return {
            destinationId: destination.id,
            orgId: destination.orgId,
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            ready,
            readiness: ready ? 'ready' : latestAttempt?.retryable ? 'retrying' : destination.enabled ? 'blocked' : 'disabled',
            redactedEndpoint: destination.redactedDestination,
            lastTest: destination.lastTest,
            lastDelivery: destination.lastDelivery,
            retryState,
            failureClass: retryState.errorClass,
            blockers,
            idempotencyCoverage: idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
        }
    })
    const blockers = [...new Set(destinationReadiness.flatMap(destination => destination.blockers))]
    const recentAttempts = [...deliveryLedger]
        .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        .slice(0, 10)

    return {
        schemaVersion: 'dwm.webhook.readiness.v1',
        liveDeliveryEnabled,
        destinationCount: destinationReadiness.length,
        activeDestinationCount: destinationReadiness.filter(destination => destination.enabled).length,
        readyDestinationCount: destinationReadiness.filter(destination => destination.ready).length,
        disabledDestinationCount: destinationReadiness.filter(destination => !destination.enabled).length,
        retryScheduledCount: destinationReadiness.filter(destination => destination.retryState.retryable).length,
        failedDestinationCount: destinationReadiness.filter(destination => destination.failureClass && !destination.retryState.retryable).length,
        blockers,
        destinations: destinationReadiness,
        recentAttempts,
        idempotencyCoverage: idempotencyCoverage(deliveryLedger),
    }
}

export function buildDwmWebhookCustomerSetupProof({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
    readModels: suppliedReadModels,
}: DwmWebhookDestinationVisibilityOptions & {
    readModels?: ReturnType<typeof buildDwmWebhookDestinationReadModels>
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canCreate', 'canUpdate', 'canTest', 'canDelete', 'canDeliver'] as const)
    if (!decision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.customer_setup.v1',
            liveDeliveryEnabled,
            noNetwork: true,
            externalSendEnabled: false,
            visibility: decision,
            access,
            status: 'permission_denied',
            summary: {
                destinationCount: 0,
                activeDestinationCount: 0,
                verifiedDryRunCount: 0,
                recentOrgAlertDeliveryCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
            },
            blockers: [retryQueueBlocker('permission_denied', 'Webhook destination setup is not visible for this organization membership.', null, true)],
            routes: webhookSetupRoutes(),
            setupSteps: [],
        }
    }

    const readModels = suppliedReadModels || buildDwmWebhookDestinationReadModels({
        destinations, deliveries, auditEvents, liveDeliveryEnabled, viewerRole, canManage,
    })
    const { deliveryReadiness: readiness, destinationAdminProof: adminProof } = readModels
    const destinationTests = destinations.map(destination => buildDwmWebhookDestinationTestContract({
        destination,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    }))
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility: null,
    })
    const activeDestinations = readiness.destinations.filter(destination => destination.enabled)
    const verifiedTests = destinationTests.filter(test => test.status === 'verified')
    const recentOrgAlertDeliveries = readiness.recentAttempts.filter(attempt => attempt.eventType !== 'dwm.alert.test')
    const retryScheduled = readiness.destinations.filter(destination => destination.retryState.retryable)
    const terminalFailures = replayGuard.entries.filter(entry => entry.retry.terminalFailure)
    const firstActiveDestination = activeDestinations[0] || null
    const dryRunTestRequests = activeDestinations.map(destination => {
        const test = destinationTests.find(item => item.destinationId === destination.destinationId) || null
        return {
            method: 'POST',
            route: `POST /api/dwm/webhook-destinations/${destination.destinationId}/test`,
            noNetwork: true,
            externalSendEnabled: false,
            destinationId: destination.destinationId,
            orgId: destination.orgId,
            label: destination.label,
            enabled: destination.enabled,
            status: destination.status,
            body: {
                dryRun: true,
                live: false,
                eventType: 'dwm.alert.test',
                destinationId: destination.destinationId,
                orgId: destination.orgId,
            },
            payloadPreview: test?.dryRunPayloadPreview || null,
            blockers: test?.blockers || [],
        }
    })
    const blockers = []
    if (destinations.length === 0) blockers.push(retryQueueBlocker('missing_webhook_destination', 'Create a Discord or webhook destination before enabling customer alert delivery.', null, true))
    if (destinations.length > 0 && activeDestinations.length === 0) blockers.push(retryQueueBlocker('no_active_destination', 'All webhook destinations are disabled.', null, true))
    if (activeDestinations.length > 0 && verifiedTests.length === 0) blockers.push(retryQueueBlocker('no_verified_dry_run', 'Run a dry-run destination test before relying on customer notifications.', firstActiveDestination?.destinationId || null, true))
    if (recentOrgAlertDeliveries.length === 0) blockers.push(retryQueueBlocker('no_recent_org_alert_delivery', 'No org alert delivery attempt has been recorded yet.', firstActiveDestination?.destinationId || null, false))
    if (retryScheduled.length > 0) blockers.push(retryQueueBlocker('retry_scheduled', 'One or more destinations have retryable failed deliveries.', retryScheduled[0]?.destinationId || null, false))
    if (terminalFailures.length > 0) blockers.push(retryQueueBlocker('terminal_failure', 'One or more destinations have terminal delivery failures that need remediation.', terminalFailures[0]?.destinationId || null, true))
    if (!liveDeliveryEnabled) blockers.push(retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled; setup can still be verified with dry-run tests.', firstActiveDestination?.destinationId || null, false))
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const status = blockingCodes.length > 0
        ? destinations.length === 0
            ? 'missing_destination'
            : 'blocked'
        : verifiedTests.length > 0
            ? 'verified'
            : 'needs_test'

    return {
        schemaVersion: 'dwm.webhook.customer_setup.v1',
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
        visibility: decision,
        access,
        status,
        summary: {
            destinationCount: destinations.length,
            activeDestinationCount: activeDestinations.length,
            verifiedDryRunCount: verifiedTests.length,
            recentOrgAlertDeliveryCount: recentOrgAlertDeliveries.length,
            retryScheduledCount: retryScheduled.length,
            terminalFailureCount: terminalFailures.length,
        },
        routes: webhookSetupRoutes(firstActiveDestination?.destinationId || '<destination_id>'),
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        setupSteps: [
            {
                id: 'create_destination',
                label: 'Create destination',
                status: destinations.length > 0 ? 'complete' : access.canCreate ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhooks',
                blockers: destinations.length > 0 ? [] : uniqueBlockers.filter(blocker => blocker.code === 'permission_denied'),
            },
            {
                id: 'dry_run_test',
                label: 'Run dry-run test',
                status: verifiedTests.length > 0 ? 'complete' : activeDestinations.length > 0 && access.canTest ? 'available' : 'blocked',
                route: firstActiveDestination ? `POST /api/dwm/webhook-destinations/${firstActiveDestination.destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test',
                noNetwork: true,
                externalSendEnabled: false,
                blockers: uniqueBlockers.filter(blocker => ['no_active_destination', 'missing_webhook_destination', 'permission_denied'].includes(blocker.code)),
            },
            {
                id: 'deliver_org_alert',
                label: 'Deliver org alert',
                status: recentOrgAlertDeliveries.length > 0 ? 'complete' : blockingCodes.length === 0 && access.canDeliver ? 'available' : 'blocked',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: liveDeliveryEnabled && blockingCodes.length === 0,
                blockers: uniqueBlockers,
            },
        ],
        dryRunTestRequest: dryRunTestRequests[0] || null,
        dryRunTestRequests,
        deliveryReadiness: readiness,
        destinationTests,
        destinationAdminProof: adminProof,
        deliveryReplayGuard: replayGuard,
    }
}

type DwmWebhookDestinationProjection = {
    destinationContracts: ReturnType<typeof buildDwmWebhookDestinationContracts>
    deliveryLedger: ReturnType<typeof buildDwmWebhookDeliveryLedgerFromEvidence>
    auditContracts: ReturnType<typeof buildDwmWebhookAuditEventContractsFromLedger>
    readiness: ReturnType<typeof buildDwmWebhookDeliveryReadinessFromProjection>
}

function prepareDwmWebhookDestinationProjection({
    destinations,
    deliveries,
    auditEvents,
    liveDeliveryEnabled,
    now = new Date(),
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries: DwmWebhookDeliveryPublic[]
    auditEvents: DwmWebhookAuditPublic[]
    liveDeliveryEnabled: boolean
    now?: Date
}): DwmWebhookDestinationProjection {
    const destinationContracts = buildDwmWebhookDestinationContracts({ destinations, deliveries, auditEvents })
    const projection = buildDwmWebhookDeliveryEvidenceProjection({ deliveries, auditEvents })
    const deliveryLedger = buildDwmWebhookDeliveryLedgerFromEvidence({ projection, now })
    const auditContracts = buildDwmWebhookAuditEventContractsFromLedger({
        auditEvents,
        deliveries,
        destinations,
        ledger: deliveryLedger,
    })
    const readiness = buildDwmWebhookDeliveryReadinessFromProjection({
        destinationContracts,
        deliveryLedger,
        liveDeliveryEnabled,
    })

    return { destinationContracts, deliveryLedger, auditContracts, readiness }
}

function buildDwmWebhookDestinationHealthFromProjection({
    destinationContracts,
    deliveryLedger,
    auditContracts,
    readiness,
    liveDeliveryEnabled,
}: DwmWebhookDestinationProjection & { liveDeliveryEnabled: boolean }) {
    const readinessByDestination = new Map(readiness.destinations.map(item => [item.destinationId, item]))
    const auditByDestination = new Map<string, typeof auditContracts>()
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
    const ledgerByDestination = new Map<string, typeof deliveryLedger>()
    for (const attempt of deliveryLedger) {
        if (!attempt.destinationId) continue
        const attempts = ledgerByDestination.get(attempt.destinationId) || []
        attempts.push(attempt)
        ledgerByDestination.set(attempt.destinationId, attempts)
    }

    return destinationContracts.map((destination) => {
        const attempts = (ledgerByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const audits = (auditByDestination.get(destination.id) || [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        const readinessRow = readinessByDestination.get(destination.id) || null
        const lastDryRun = attempts.find(attempt => attempt.dryRun) || null
        const lastFailure = attempts.find(attempt => attempt.rawStatus === 'failed' || attempt.errorClass) || null
        const lastLiveDisabled = attempts.find(attempt => attempt.errorClass === 'live_delivery_disabled') || null
        const latestAttempt = attempts[0] || null
        const lastTestAuditId = auditEventIdForDelivery(audits, destination.lastTest.requestId)
        const lastDeliveryAuditId = auditEventIdForDelivery(audits, destination.lastDelivery.requestId)

        return {
            schemaVersion: 'dwm.webhook.destination_health.v1',
            destinationId: destination.id,
            orgId: destination.orgId,
            owner: {
                ownerId: destination.createdBy,
                createdBy: destination.createdBy,
                actorId: destination.actorId,
            },
            type: destination.type,
            label: destination.label,
            status: destination.status,
            enabled: destination.enabled,
            health: readinessRow?.readiness || (destination.enabled ? 'blocked' : 'disabled'),
            ready: readinessRow?.ready || false,
            liveDeliveryEnabled,
            redactedEndpoint: destination.redactedDestination,
            blockers: readinessRow?.blockers || [],
            retry: readinessRow?.retryState || { retryable: false, nextRetryAt: null, errorClass: null, reason: 'no_attempts', attemptCount: 0 },
            lastDryRun: lastDryRun ? destinationHealthAttempt(lastDryRun, auditEventIdForDelivery(audits, lastDryRun.deliveryId)) : null,
            lastTest: {
                ...destination.lastTest,
                auditEventId: destination.lastTest.auditEventId || lastTestAuditId,
            },
            lastDelivery: {
                ...destination.lastDelivery,
                auditEventId: destination.lastDelivery.auditEventId || lastDeliveryAuditId,
            },
            lastFailure: lastFailure ? destinationHealthAttempt(lastFailure, auditEventIdForDelivery(audits, lastFailure.deliveryId)) : null,
            lastLiveDisabled: lastLiveDisabled ? destinationHealthAttempt(lastLiveDisabled, auditEventIdForDelivery(audits, lastLiveDisabled.deliveryId)) : null,
            latestAttempt: latestAttempt ? destinationHealthAttempt(latestAttempt, auditEventIdForDelivery(audits, latestAttempt.deliveryId)) : null,
            idempotencyCoverage: readinessRow?.idempotencyCoverage || idempotencyCoverage(attempts),
            recentAttempts: attempts.slice(0, 5).map(attempt => destinationHealthAttempt(attempt, auditEventIdForDelivery(audits, attempt.deliveryId))),
            auditEventIds: destination.auditEventIds,
            latestAuditEventId: destination.latestAuditEventId,
            auditEventContracts: audits.slice(0, 10),
            updatedAt: destination.updatedAt,
            createdAt: destination.createdAt,
        }
    })
}

export function buildDwmWebhookDestinationHealth({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    return buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
}

export function buildDwmWebhookDashboardReadinessAdapter({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    visibility = null,
    orgStatus = 'active',
    watchlistStatus = 'active',
}: {
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    visibility?: DwmWebhookEvidenceVisibilityInput | null
    orgStatus?: unknown
    watchlistStatus?: unknown
}) {
    const visibilityDecision = webhookVisibilityDecision(visibility)
    const orgLifecycleStatus = clean(orgStatus).toLowerCase() || 'active'
    const watchlistLifecycleStatus = clean(watchlistStatus).toLowerCase() || 'active'
    const orgBlocked = ['archived', 'disabled', 'deleted', 'suspended'].includes(orgLifecycleStatus)
    const watchlistBlocked = ['archived', 'retired', 'deleted'].includes(watchlistLifecycleStatus)
    const policyBlockers = [
        visibilityDecision.allowed ? null : dashboardReadinessBlocker('policy_blocked', 'Destination readiness is not visible for this actor.', null, visibilityDecision.reason || 'permission_denied'),
        orgBlocked ? dashboardReadinessBlocker('policy_blocked', 'Organization lifecycle blocks webhook delivery.', null, 'org_archived') : null,
        watchlistBlocked ? dashboardReadinessBlocker('policy_blocked', 'Retired or archived watchlist blocks alert delivery.', null, 'watchlist_retired') : null,
    ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]

    if (!visibilityDecision.allowed) {
        return {
            schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
            liveDeliveryEnabled,
            visibility: visibilityDecision,
            orgStatus: orgLifecycleStatus,
            watchlistStatus: watchlistLifecycleStatus,
            summary: {
                destinationCount: 0,
                verifiedCount: 0,
                blockedCount: 0,
                retryScheduledCount: 0,
                terminalFailureCount: 0,
                disabledCount: 0,
                policyBlockedCount: 1,
                lifecycleCounts: {
                    active: 0,
                    disabled: 0,
                    failed: 0,
                    revokedOwner: 0,
                    secretRotated: 0,
                    testRequired: 0,
                },
                lifecycleActions: [],
            },
            blockers: policyBlockers,
            destinations: [],
        }
    }

    const now = new Date()
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        now,
    })
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistenceFromProjection({
        destinations,
        filters: {},
        liveDeliveryEnabled,
        ledger: projection.deliveryLedger,
        auditContracts: projection.auditContracts,
    })
    const deliveriesById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const auditContracts = projection.auditContracts
    const auditByDestination = new Map<string, typeof auditContracts>()
    const dashboardCanManage = ['owner', 'admin'].includes(clean(recordOrEmpty(visibility).role).toLowerCase())
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }
    const retryKeysByDestination = new Map<string, ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys']>()
    for (const key of retryPersistence.deliveryKeys) {
        if (!key.destinationId) continue
        const keys = retryKeysByDestination.get(key.destinationId) || []
        keys.push(key)
        retryKeysByDestination.set(key.destinationId, keys)
    }
    const rows = destinationHealth.map((health) => {
        const retryKeys = retryKeysByDestination.get(health.destinationId) || []
        const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
        const latestRetryKey = retryKeys[0] || null
        const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
            || retryKeys.some(key => key.retry.terminalFailure)
        const states = [
            policyBlockers.length ? 'policy_blocked' : null,
            !health.enabled ? 'disabled' : null,
            endpointPresent ? null : 'secret_missing',
            health.lastTest.status === 'failed' ? 'test_failed' : null,
            health.retry.retryable ? 'retry_scheduled' : null,
            terminalFailure ? 'terminal_failure' : null,
            health.enabled && endpointPresent && health.lastTest.requestId && isLiveDeliveredProof(health.lastTest) ? 'verified' : null,
        ].filter(Boolean) as string[]
        const blockers = [
            ...policyBlockers.map(blocker => ({ ...blocker, destinationId: health.destinationId })),
            !health.enabled ? dashboardReadinessBlocker('disabled', 'Destination is disabled.', health.destinationId, 'destination_disabled') : null,
            endpointPresent ? null : dashboardReadinessBlocker('secret_missing', 'Destination has no stored webhook URL reference.', health.destinationId, 'secret_missing'),
            health.lastTest.status === 'failed' ? dashboardReadinessBlocker('test_failed', 'Latest destination test failed.', health.destinationId, 'test_failed') : null,
            health.retry.retryable ? dashboardReadinessBlocker('retry_scheduled', 'Latest failed delivery has retry/backoff scheduled.', health.destinationId, health.retry.errorClass || 'retry_scheduled', false) : null,
            terminalFailure ? dashboardReadinessBlocker('terminal_failure', 'Latest delivery failure is not retryable.', health.destinationId, health.lastFailure?.errorClass || latestRetryKey?.retry.lastErrorCategory || 'terminal_failure') : null,
        ].filter(Boolean) as ReturnType<typeof dashboardReadinessBlocker>[]
        const healthStatus = dashboardPrimaryHealthStatus(states)
        const latestDelivery = health.latestAttempt?.deliveryId ? deliveriesById.get(health.latestAttempt.deliveryId) || null : null
        const latestPayloadPreview = latestDelivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(latestDelivery.payload) : null
        const lifecycleState = destinationLifecycleState({
            destination: destinationById.get(health.destinationId) || null,
            health,
            audits: auditByDestination.get(health.destinationId) || [],
            canManage: dashboardCanManage,
        })
        const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage: dashboardCanManage })

        return {
            schemaVersion: 'dwm.webhook.dashboard_destination_readiness.v1',
            orgId: health.orgId,
            destinationId: health.destinationId,
            label: health.label,
            type: health.type,
            lifecycle: {
                status: health.status,
                enabled: health.enabled,
            },
            healthStatus,
            healthStates: [...new Set(states.length ? states : ['unverified'])],
            readyForDryRun: health.enabled && endpointPresent && !policyBlockers.length,
            readyForLive: health.ready && liveDeliveryEnabled && !policyBlockers.length,
            secretState: endpointPresent ? 'redacted' : 'missing',
            redactedEndpoint: health.redactedEndpoint,
            lifecycleState,
            lifecycleReadinessReceipt,
            latestDeliveryProof: {
                requestId: health.latestAttempt?.requestId || null,
                deliveryId: health.latestAttempt?.deliveryId || null,
                status: health.latestAttempt?.status || null,
                rawStatus: health.latestAttempt?.rawStatus || null,
                dryRun: health.latestAttempt?.dryRun ?? null,
                live: health.latestAttempt?.live ?? null,
                replay: health.latestAttempt?.replay ?? null,
                dedupeKey: health.latestAttempt?.dedupeKey || latestRetryKey?.dedupeKey || null,
                idempotencyKey: health.latestAttempt?.idempotencyKey || latestRetryKey?.idempotencyKey || null,
                casePath: health.latestAttempt?.casePath || latestRetryKey?.casePath || null,
                auditEventId: health.latestAttempt?.auditEventId || latestRetryKey?.audit.latestAuditEventId || null,
                attemptedAt: health.latestAttempt?.attemptedAt || null,
                discordTemplate: latestPayloadPreview?.context.discordTemplate || null,
            },
            test: {
                status: health.lastTest.status,
                requestId: health.lastTest.requestId,
                auditEventId: health.lastTest.auditEventId,
                failureReason: health.lastTest.failureReason,
            },
            retry: {
                retryable: health.retry.retryable,
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                terminalFailure,
            },
            replay: {
                duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
                latestReplayRequestId: health.recentAttempts.find(attempt => attempt.replay)?.requestId || null,
            },
            auditEventIds: health.auditEventIds,
            latestAuditEventId: health.latestAuditEventId,
            blockers: uniqueDashboardReadinessBlockers(blockers),
        }
    })

    return {
        schemaVersion: 'dwm.webhook.dashboard_readiness.v1',
        liveDeliveryEnabled,
        visibility: visibilityDecision,
        orgStatus: orgLifecycleStatus,
        watchlistStatus: watchlistLifecycleStatus,
        summary: {
            destinationCount: rows.length,
            verifiedCount: rows.filter(row => row.healthStates.includes('verified')).length,
            blockedCount: rows.filter(row => row.blockers.some(blocker => blocker.blocking)).length,
            retryScheduledCount: rows.filter(row => row.healthStates.includes('retry_scheduled')).length,
            terminalFailureCount: rows.filter(row => row.healthStates.includes('terminal_failure')).length,
            disabledCount: rows.filter(row => row.healthStates.includes('disabled')).length,
            policyBlockedCount: rows.filter(row => row.healthStates.includes('policy_blocked')).length,
            lifecycleCounts: {
                active: rows.filter(row => row.lifecycleState.active).length,
                disabled: rows.filter(row => row.lifecycleState.disabled).length,
                failed: rows.filter(row => row.lifecycleState.failed).length,
                revokedOwner: rows.filter(row => row.lifecycleState.revokedOwner).length,
                secretRotated: rows.filter(row => row.lifecycleState.secretRotated).length,
                testRequired: rows.filter(row => row.lifecycleState.testRequired).length,
            },
            lifecycleActions: dashboardLifecycleActionSummary(rows),
        },
        blockers: uniqueDashboardReadinessBlockers([
            ...policyBlockers,
            ...rows.flatMap(row => row.blockers),
        ]),
        destinations: rows,
    }
}

function buildDwmWebhookDestinationLifecycleFromProjection({
    destinations,
    auditContracts,
    healthRows,
    viewerRole,
    canManage,
}: {
    destinations: DwmWebhookDestinationPublic[]
    auditContracts: DwmWebhookDestinationProjection['auditContracts']
    healthRows: ReturnType<typeof buildDwmWebhookDestinationHealth>
    viewerRole: string | null
    canManage: boolean
}) {
    const auditByDestination = new Map<string, typeof auditContracts>()
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    for (const audit of auditContracts) {
        if (!audit.destinationId) continue
        const audits = auditByDestination.get(audit.destinationId) || []
        audits.push(audit)
        auditByDestination.set(audit.destinationId, audits)
    }

    return healthRows.map((health) => {
        const audits = auditByDestination.get(health.destinationId) || []
        const created = audits.find(audit => audit.action === 'destination.created') || null
        const updated = audits.find(audit => audit.action === 'destination.updated') || null
        const disabled = audits.find(audit => audit.action === 'destination.archived') || null
        const replay = health.recentAttempts.find(attempt => attempt.eventType === 'dwm.alert.replayed') || null
        const adminAuditEvents = canManage ? audits : []
        const destination = destinationById.get(health.destinationId) || null
        const lifecycleState = destinationLifecycleState({ destination, health, audits, canManage })
        const lifecycleReadinessReceipt = destinationLifecycleReadinessReceipt({ health, lifecycleState, canManage })

        return {
            schemaVersion: 'dwm.webhook.destination_lifecycle.v1',
            destinationId: health.destinationId,
            orgId: health.orgId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            view: canManage ? 'admin' : 'member',
            access: {
                role: clean(viewerRole) || null,
                canReadStatus: true,
                canManage,
                canUpdate: canManage,
                canTest: canManage,
                canDisable: canManage && health.enabled,
                memberSafe: !canManage,
            },
            lifecycleState,
            lifecycleReadinessReceipt,
            redactedEndpoint: health.redactedEndpoint,
            lifecycle: {
                created: lifecycleEvent(created, canManage),
                updated: lifecycleEvent(updated, canManage),
                disabled: lifecycleEvent(disabled, canManage),
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastReplay: replay,
                lastDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                redactedEndpoint: health.redactedEndpoint,
            },
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
                idempotencyCoverage: health.idempotencyCoverage,
            },
            auditEventIds: health.auditEventIds,
            latestAuditEventId: health.latestAuditEventId,
            auditEventContracts: adminAuditEvents,
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
}

export function buildDwmWebhookDestinationLifecycle({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: DwmWebhookDestinationLifecycleOptions) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const healthRows = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    return buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: projection.auditContracts,
        healthRows,
        viewerRole,
        canManage,
    })
}

export function buildDwmWebhookDestinationCrudContract({
    action,
    ownerId,
    input = {},
    destination = null,
    destinations = [],
    deliveries = [],
    auditEvents = [],
    viewerRole = null,
    canManage = false,
    entitlementAllowed = true,
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    action: DwmWebhookDestinationCrudAction
    ownerId: string
    input?: DwmWebhookDestinationInput
    destination?: DwmWebhookDestinationPublic | null
    destinations?: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    viewerRole?: string | null
    canManage?: boolean
    entitlementAllowed?: boolean
    liveDeliveryEnabled?: boolean
}) {
    const requestId = firstClean(input.requestId, input.request_id)
    const rawEndpoint = firstClean(input.endpointUrl, input.endpoint_url, input.webhookUrl, input.webhook_url, input.url)
    const rawKind = firstClean(input.kind, input.type)
    const endpointValidation = validateWebhookEndpointForContract(rawEndpoint)
    const normalizedKind = WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)
        ? rawKind as DwmWebhookKind
        : endpointValidation.normalizedUrl
            ? parseKind(rawKind, endpointValidation.normalizedUrl, destination?.kind)
            : destination?.kind || 'webhook'
    const normalizedEndpointHash = endpointValidation.normalizedUrl ? hashWebhookValue('endpoint', endpointValidation.normalizedUrl) : destination?.endpointHash || null
    const normalizedEndpointHint = endpointValidation.normalizedUrl ? redactWebhookEndpoint(endpointValidation.normalizedUrl) : destination?.endpointHint || null
    const normalizedOrgId = firstClean(input.orgId, destination?.orgId, ownerId)
    const normalizedLabel = firstClean(input.name, input.label, input.channelName, input.channel_name, input.channel, destination?.name)
        || (normalizedKind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
    const operationStatus = action === 'delete' ? 'archived' : action === 'disable' ? 'paused' : null
    const status = parseStatus(input.status ?? operationStatus ?? destination?.status ?? 'active')
    const scopedDestinations = destinations.filter(item => item.orgId === normalizedOrgId)
    const duplicate = normalizedEndpointHash
        ? scopedDestinations.find(item => item.endpointHash === normalizedEndpointHash && item.id !== destination?.id && item.status !== 'archived') || null
        : null
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: destination ? [destination] : scopedDestinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const proofRow = destination ? adminProof.destinations.find(item => item.destinationId === destination.id) || null : null
    const blockers: ReturnType<typeof crudBlocker>[] = []

    if (!canManage) {
        blockers.push(crudBlocker('permission_denied', 'Only organization owners and admins can manage webhook destinations.', destination?.id || null))
    }
    if (destination && normalizedOrgId !== destination.orgId) {
        blockers.push(crudBlocker('org_scope_mismatch', 'Webhook destinations cannot be moved between organizations. Create a new destination for the target organization.', destination.id))
    }
    if (!entitlementAllowed || parseBoolean(input.entitlementAllowed ?? input.entitlement_allowed, true) === false) {
        blockers.push(crudBlocker('entitlement_plan_denied', 'Current plan does not allow another webhook destination.', destination?.id || null))
    }
    if (endpointValidation.error && (rawEndpoint || action === 'create')) {
        blockers.push(crudBlocker('invalid_url', endpointValidation.error, destination?.id || null))
    }
    if (rawKind && !WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)) {
        blockers.push(crudBlocker('unsupported_destination_type', 'Destination type must be discord or webhook.', destination?.id || null))
    }
    if (duplicate && action === 'create') {
        blockers.push(crudBlocker('duplicate_destination', 'An active destination already uses this endpoint for the organization.', duplicate.id))
    }
    if ((action === 'update' || action === 'disable' || action === 'delete' || action === 'enable' || action === 'test') && !destination) {
        blockers.push(crudBlocker('permission_denied', 'Webhook destination is not available for this organization.', null))
    }
    if ((action === 'disable' || action === 'delete' || action === 'test') && destination?.status !== 'active') {
        blockers.push(crudBlocker('destination_disabled', 'Destination is disabled.', destination?.id || null, false, action === 'test'))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_live_endpoint')) {
        blockers.push(crudBlocker('invalid_url', 'Destination has no valid webhook URL reference.', destination?.id || null))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_verified_dry_run')) {
        blockers.push(crudBlocker('no_verified_dry_run', 'Destination has no verified dry-run delivery yet.', destination?.id || null, action === 'test', false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'destination_unhealthy')) {
        blockers.push(crudBlocker('unhealthy_destination', 'Destination health is blocked or retrying.', destination?.id || null, Boolean(proofRow.retry.retryable), false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'audit_missing')) {
        blockers.push(crudBlocker('audit_missing', 'Destination has no linked audit event.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'dedupe_already_delivered')) {
        blockers.push(crudBlocker('idempotency_duplicate', 'Latest destination delivery idempotency key has already been delivered.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'retry_not_eligible')) {
        blockers.push(crudBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', destination?.id || null, false, false))
    }

    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blocking = uniqueBlockers.filter(blocker => blocker.blocking)
    const routeContract = destinationCrudRouteContract()
    const managementRequest = destinationCrudManagementRequest({
        action,
        orgId: normalizedOrgId,
        destinationId: destination?.id || null,
        requestId,
        label: normalizedLabel.slice(0, 120),
        kind: normalizedKind,
        channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
        status,
        events: parseEvents(input.events),
        redactedEndpoint: {
            endpointHint: normalizedEndpointHint,
            endpointHash: normalizedEndpointHash,
        },
        blockers: uniqueBlockers,
        canApply: blocking.length === 0,
        liveDeliveryEnabled,
    })
    const destinationPersistenceReceipt = destinationCrudPersistenceReceipt({
        action,
        orgId: normalizedOrgId,
        destination,
        desired: {
            label: normalizedLabel.slice(0, 120),
            type: normalizedKind,
            kind: normalizedKind,
            channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
            status,
            events: parseEvents(input.events),
            redactedEndpoint: {
                endpointHint: normalizedEndpointHint,
                endpointHash: normalizedEndpointHash,
            },
        },
        managementRequest,
        blockers: uniqueBlockers,
        proofRow,
        duplicateDestinationId: duplicate?.id || null,
        liveDeliveryEnabled,
    })
    return {
        schemaVersion: 'dwm.webhook.destination_crud.v1',
        action,
        requestId: requestId || null,
        ownerId,
        orgId: normalizedOrgId,
        canApply: blocking.length === 0,
        access: {
            role: clean(viewerRole) || null,
            canManage,
            canCreate: canManage,
            canUpdate: canManage && Boolean(destination),
            canDisable: canManage && destination?.status === 'active',
            canDelete: canManage && destination?.status === 'active',
            canEnable: canManage && Boolean(destination) && destination?.status !== 'active',
            canTest: canManage && Boolean(destination),
            memberSafe: !canManage,
        },
        desired: {
            label: normalizedLabel.slice(0, 120),
            type: normalizedKind,
            kind: normalizedKind,
            channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
            status,
            events: parseEvents(input.events),
            redactedEndpoint: {
                endpointHint: normalizedEndpointHint,
                endpointHash: normalizedEndpointHash,
            },
        },
        destination: destination
            ? {
                id: destination.id,
                orgId: destination.orgId,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                enabled: destination.status === 'active',
                redactedEndpoint: {
                    endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                    endpointHash: destination.endpointHash,
                },
            }
            : null,
        duplicateDestinationId: duplicate?.id || null,
        blockers: uniqueBlockers,
        blockingCodes: blocking.map(blocker => blocker.code),
        health: proofRow
            ? {
                status: proofRow.health.status,
                ready: proofRow.health.ready,
                blockers: proofRow.health.adminProofBlockers,
                retry: proofRow.retry,
                audit: proofRow.audit,
                productProgress: adminProof.productProgress,
            }
            : {
                status: 'pending',
                ready: false,
                blockers: [],
                retry: null,
                audit: null,
                productProgress: adminProof.productProgress,
            },
        audit: {
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
            duplicateDestinationId: duplicate?.id || null,
        },
        routeContract,
        managementRequest,
        destinationPersistenceReceipt,
        noNetwork: true,
        liveDeliveryEnabled,
    }
}

function buildDwmWebhookDestinationAdminProofFromProjection({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
    projection,
    healthRows: preparedHealthRows,
    lifecycleRows: preparedLifecycleRows,
}: DwmWebhookDestinationVisibilityOptions & {
    projection?: DwmWebhookDestinationProjection
    healthRows?: ReturnType<typeof buildDwmWebhookDestinationHealth>
    lifecycleRows?: ReturnType<typeof buildDwmWebhookDestinationLifecycle>
}) {
    const decision = webhookVisibilityDecision(visibility)
    const access = webhookAccess(decision, viewerRole, canManage, ['canManage', 'canTest', 'canRetry'] as const)

    if (!decision.allowed) {
        const blocker = adminProofBlocker('permission_denied', 'Webhook destination health is not visible for this organization membership.')
        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
            liveDeliveryEnabled,
            visibility: decision,
            access,
            productProgress: webhookProductProgressSummary([], liveDeliveryEnabled, [blocker]),
            summary: destinationAdminProofSummary([], [], liveDeliveryEnabled),
            blockers: [blocker],
            destinations: [],
        }
    }

    const sharedProjection = projection || prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const healthRows = preparedHealthRows || buildDwmWebhookDestinationHealthFromProjection({
        ...sharedProjection,
        liveDeliveryEnabled,
    })
    const lifecycleRows = preparedLifecycleRows || buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: sharedProjection.auditContracts,
        healthRows,
        viewerRole,
        canManage,
    })
    const operations = buildDwmWebhookDeliveryOperationsFromProjection({
        destinations,
        filters: {},
        liveDeliveryEnabled,
        ledger: sharedProjection.deliveryLedger,
        auditContracts: sharedProjection.auditContracts,
    })
    const lifecycleByDestination = new Map(lifecycleRows.map(row => [row.destinationId, row]))
    const operationsByDestination = new Map<string, typeof operations.recentDeliveries>()
    for (const operation of operations.recentDeliveries) {
        if (!operation.destinationId) continue
        const rows = operationsByDestination.get(operation.destinationId) || []
        rows.push(operation)
        operationsByDestination.set(operation.destinationId, rows)
    }

    const proofs = healthRows.map((health) => {
        const lifecycle = lifecycleByDestination.get(health.destinationId) || null
        const destinationOperations = (operationsByDestination.get(health.destinationId) || [])
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestOrgAlert = destinationOperations.find(operation => operation.eventType !== 'dwm.alert.test') || null
        const latestReplay = destinationOperations.find(operation => operation.replay) || null
        const latestSent = destinationOperations.find(operation => operation.status === 'sent') || null
        const latestFailedOrSkipped = destinationOperations.find(operation => operation.status === 'failed' || operation.status === 'skipped') || null
        const blockers = destinationAdminProofBlockers({
            health,
            latestOrgAlert,
            latestSent,
            latestFailedOrSkipped,
        })

        return {
            schemaVersion: 'dwm.webhook.destination_admin_proof_row.v1',
            orgId: health.orgId,
            destinationId: health.destinationId,
            type: health.type,
            label: health.label,
            status: health.status,
            enabled: health.enabled,
            redactedEndpoint: health.redactedEndpoint,
            access: lifecycle?.access || access,
            health: {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                adminProofBlockers: blockers,
                liveDeliveryEnabled: health.liveDeliveryEnabled,
            },
            lifecycle: {
                created: lifecycle?.lifecycle.created || null,
                updated: lifecycle?.lifecycle.updated || null,
                disabled: lifecycle?.lifecycle.disabled || null,
                lastDryRun: health.lastDryRun,
                lastTest: health.lastTest,
                lastLiveDelivery: health.lastDelivery,
                lastFailure: health.lastFailure,
                lastLiveDisabled: health.lastLiveDisabled,
            },
            retry: {
                retryable: health.retry.retryable,
                eligible: access.canRetry && blockers.every(blocker => !['destination_disabled', 'no_live_endpoint', 'no_verified_dry_run', 'permission_denied', 'retry_not_eligible'].includes(blocker.code)),
                nextRetryAt: health.retry.nextRetryAt,
                attemptCount: health.retry.attemptCount,
                lastErrorCategory: health.retry.errorClass,
                reason: health.retry.reason,
                requestId: lifecycle?.retry.requestId || health.lastFailure?.requestId || health.latestAttempt?.requestId || null,
                deliveryId: lifecycle?.retry.deliveryId || health.lastFailure?.deliveryId || health.latestAttempt?.deliveryId || null,
                dedupeKey: lifecycle?.retry.dedupeKey || health.lastFailure?.dedupeKey || health.latestAttempt?.dedupeKey || null,
            },
            deliveryOperations: {
                total: destinationOperations.length,
                recent: destinationOperations.slice(0, 5),
                latestOrgAlert,
            },
            dedupe: {
                duplicateKeyCount: health.idempotencyCoverage.duplicateKeyCount,
                covered: health.idempotencyCoverage.covered,
                latestDedupeKey: latestOrgAlert?.dedupeKey || health.latestAttempt?.dedupeKey || null,
                alreadyDelivered: Boolean(latestSent),
                deliveredRequestId: latestSent?.requestId || null,
            },
            replay: {
                latestReplayRequestId: latestReplay?.requestId || null,
                latestReplayDedupeKey: latestReplay?.dedupeKey || null,
                replayAttemptCount: destinationOperations.filter(operation => operation.replay).length,
            },
            audit: {
                latestAuditEventId: health.latestAuditEventId,
                auditEventIds: health.auditEventIds,
                auditEventContracts: access.canManage ? health.auditEventContracts : [],
            },
            updatedAt: health.updatedAt,
            createdAt: health.createdAt,
        }
    })
    const blockers = uniqueWebhookBlockers(proofs.flatMap(proof => proof.health.adminProofBlockers))

    return {
        schemaVersion: 'dwm.webhook.destination_admin_proof.v1',
        liveDeliveryEnabled,
        visibility: decision,
        access,
        productProgress: webhookProductProgressSummary(proofs, liveDeliveryEnabled, blockers),
        summary: destinationAdminProofSummary(proofs, operations.recentDeliveries, liveDeliveryEnabled),
        blockers,
        destinations: proofs,
    }
}

export function buildDwmWebhookDestinationAdminProof(options: DwmWebhookDestinationVisibilityOptions) {
    return buildDwmWebhookDestinationAdminProofFromProjection(options)
}

export function buildDwmWebhookDestinationReadModels({
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDestinationVisibilityOptions) {
    const projection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...projection, liveDeliveryEnabled })
    const destinationLifecycle = buildDwmWebhookDestinationLifecycleFromProjection({
        destinations,
        auditContracts: projection.auditContracts,
        healthRows: destinationHealth,
        viewerRole,
        canManage,
    })
    const destinationAdminProof = buildDwmWebhookDestinationAdminProofFromProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
        projection,
        healthRows: destinationHealth,
        lifecycleRows: destinationLifecycle,
    })

    return {
        destinationContracts: projection.destinationContracts,
        deliveryReadiness: projection.readiness,
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
    }
}

export function buildDwmOrgAlertWebhookDeliveryContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const destinationReadModels = buildDwmWebhookDestinationReadModels({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const {
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
    } = destinationReadModels
    const deliveryLedger = buildDwmWebhookDeliveryLedger({ deliveries, auditEvents })
    const auditEventContracts = buildDwmWebhookAuditEventContracts({ destinations, deliveries, auditEvents })
    const deliveryOutcome = buildDwmOrgAlertWebhookDeliveryOutcome({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const destinationId = clean(normalizedInput.destinationId ?? normalizedInput.destination_id)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const alertDestinationReadiness = buildDwmAlertWebhookReadinessHandoff({
        ownerId,
        input: normalizedInput,
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const deliveryEvidenceAccess = {
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        filters: {
            orgId: dispatch.orgId,
            destinationId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey,
        },
    }
    const deliveryTimeline = buildDwmWebhookDeliveryTimeline(deliveryEvidenceAccess)
    const deliveryActionPlan = buildDwmWebhookDeliveryActionPlan(deliveryEvidenceAccess)
    const deliveryReplayGuard = buildDwmWebhookDeliveryReplayGuard(deliveryEvidenceAccess)
    const deliveryReadinessConsumer = buildDwmWebhookDeliveryReadinessConsumerProof(deliveryEvidenceAccess)
    const customerSetup = buildDwmWebhookCustomerSetupProof({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        readModels: destinationReadModels,
    })
    const alertDeliveryProof = buildDwmWebhookAlertDeliveryProof({
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        selectedDestinations: dispatch.selectedDestinations,
        skippedDestinations: dispatch.skippedDestinations,
        normalizedAlert,
        watchlist,
        customerSetup,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        destinationAdminProof,
        auditEventContracts,
    })
    const organizationConsumerReceipt = buildDwmWebhookOrganizationConsumerReceipt({
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        selectedDestinations: dispatch.selectedDestinations,
        skippedDestinations: dispatch.skippedDestinations,
        normalizedAlert,
        watchlist,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryReadinessConsumer,
        alertDeliveryProof,
        auditEventContracts,
    })

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery.v1',
        ownerId,
        orgId: dispatch.orgId,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        destinationSelection: {
            requestedDestinationId: destinationId || null,
            selectedCount: dispatch.selectedDestinations.length,
            skippedCount: dispatch.skippedDestinations.length,
            selectedDestinations: dispatch.selectedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.org_id,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                idempotencyKey: buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            })),
            skippedDestinations: dispatch.skippedDestinations,
        },
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            evidenceSummary: normalizedAlert.evidenceSummary,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenance: normalizedAlert.provenance,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        deliveryLedger,
        destinationHealth,
        destinationLifecycle,
        destinationAdminProof,
        customerSetup,
        alertDestinationReadiness,
        alertDeliveryProof,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        deliveryReadinessConsumer,
        organizationConsumerReceipt,
        auditEventContracts,
    }
}

function buildDwmWebhookOrganizationConsumerReceipt({
    ownerId,
    orgId,
    eventType,
    dryRun,
    liveRequested,
    liveDeliveryEnabled,
    selectedDestinations,
    skippedDestinations,
    normalizedAlert,
    watchlist,
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryReadinessConsumer,
    alertDeliveryProof,
    auditEventContracts,
}: {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    dryRun: boolean
    liveRequested: boolean
    liveDeliveryEnabled: boolean
    selectedDestinations: DwmAlertWebhookDispatchPlan['selectedDestinations']
    skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations']
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryReadinessConsumer: ReturnType<typeof buildDwmWebhookDeliveryReadinessConsumerProof>
    alertDeliveryProof: ReturnType<typeof buildDwmWebhookAlertDeliveryProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const idempotencySeed = normalizedAlert.dedupeKey || normalizedAlert.id
    const readinessRows = new Map(deliveryReadinessConsumer.rows.map(row => [row.destinationId, row]))
    const latestOutcomeRows = new Map(deliveryOutcome.selectedDestinations.map(destination => [destination.destinationId, destination]))
    const selectedBlockingCodes = alertDeliveryProof.alertScopedBlockerCodes
    const skippedBlockerCodes = skippedDestinations.map((destination) => {
        if (destination.reason === 'disabled') return 'destination_disabled'
        if (destination.reason === 'org_mismatch') return 'org_mismatch'
        return destination.reason
    })
    const blockerCodes = [...new Set([
        ...selectedBlockingCodes,
        ...skippedBlockerCodes,
        ...(!orgId ? ['missing_org_ref'] : []),
        ...(selectedDestinations.length === 0 ? ['destination_unavailable'] : []),
        ...(!liveDeliveryEnabled && liveRequested && !dryRun ? ['live_delivery_disabled'] : []),
    ])]
    const destinationDeliveryReady = selectedDestinations.length > 0 && Boolean(orgId)
    const readyForDelivery = destinationDeliveryReady && selectedBlockingCodes.length === 0
    const dryRunReady = destinationDeliveryReady && (dryRun || !liveRequested || !liveDeliveryEnabled)
    const watchedTerms = (watchlist.terms.length ? watchlist.terms : [watchlist.name || watchlist.id])
        .map(term => clean(term))
        .filter(Boolean)

    return {
        schemaVersion: 'dwm.webhook.organization_delivery_consumer_receipt.v1',
        consumesSchemaVersion: 'organization.webhook_destination_delivery_consumer.v1',
        ownerId,
        organizationId: orgId,
        tenantId: orgId,
        route: 'POST /api/dwm/webhook-deliveries',
        upstreamRoute: 'POST /v1/dwm/webhooks/deliver',
        eventType,
        readyForDelivery,
        destinationDeliveryReady,
        dryRunReady,
        blockerReason: blockerCodes[0] || null,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled && readyForDelivery,
        roleGates: {
            automaticDelivery: ['owner', 'admin'],
            manualTrigger: ['owner', 'admin'],
            readDeliverySummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
        destinationScope: {
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
        },
        alertContext: {
            alertId: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            route: normalizedAlert.route,
            alertUrl: normalizedAlert.alertUrl,
            caseId: normalizedAlert.caseId,
            casePath: normalizedAlert.casePath,
            evidenceCount: normalizedAlert.evidenceCount,
            provenanceSummary: normalizedAlert.provenanceSummary,
            dedupeKey: normalizedAlert.dedupeKey,
        },
        watchlistMatches: watchedTerms.map((term) => ({
            organizationId: orgId,
            tenantId: orgId,
            watchlistId: watchlist.id,
            watchlistItemId: watchlist.id,
            watchedEntity: {
                type: 'domain',
                value: term,
                normalizedValue: term.toLowerCase(),
            },
            matchReason: {
                kind: 'shared_watchlist_term',
                code: 'organization_watchlist_term_match',
            },
            actorRef: {
                userId: ownerId,
                role: 'admin',
                source: 'webhook_delivery_contract',
            },
            sourceRefs: {
                sourceFamily: normalizedAlert.sourceFamily,
                exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility',
                deliveryRoute: 'POST /api/dwm/webhook-deliveries',
            },
            provenanceHash: normalizedAlert.provenanceSummary || normalizedAlert.dedupeKey || normalizedAlert.id,
            workflowStatus: readyForDelivery ? 'ready_for_delivery' : 'blocked',
            destinationReadiness: {
                destinationDeliveryReady: readyForDelivery,
                dryRunReady,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                blockerReason: blockerCodes[0] || null,
            },
        })),
        destinationReceipts: selectedDestinations.map((destination) => {
            const idempotencyKey = buildIdempotencyKey(eventType, orgId, destination.id, idempotencySeed)
            const readiness = readinessRows.get(destination.id) || null
            const outcome = latestOutcomeRows.get(destination.id) || null
            return {
                destinationId: destination.id,
                orgId: destination.org_id,
                label: destination.name,
                type: destination.kind,
                status: outcome?.status || destination.status,
                idempotencyKey,
                requestId: outcome?.latestAttempt?.requestId || readiness?.requestId || null,
                deliveryId: outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || null,
                auditEventId: outcome?.latestAttempt?.auditEventId || readiness?.audit?.auditEventId || null,
                retry: {
                    retryable: Boolean(outcome?.latestAttempt?.retryable || readiness?.readiness.retryableFailure),
                    nextRetryAt: outcome?.latestAttempt?.nextRetryAt || readiness?.retry.nextRetryAt || null,
                    attemptCount: outcome?.latestAttempt?.attemptCount || readiness?.retry.attemptCount || 0,
                    lastErrorCategory: outcome?.latestAttempt?.errorClass || readiness?.retry.lastErrorCategory || null,
                },
                readiness: {
                    success: Boolean(readiness?.readiness.success || outcome?.recorded),
                    idempotentReplay: Boolean(readiness?.readiness.idempotentReplay),
                    redactedDryRun: Boolean(readiness?.readiness.redactedDryRun || outcome?.latestAttempt?.dryRun),
                    auditLinked: Boolean(readiness?.readiness.auditLinked || outcome?.latestAttempt?.auditEventId),
                    liveBlocked: !liveDeliveryEnabled && Boolean(outcome?.latestAttempt?.live || readiness?.live),
                },
                redactedDestination: {
                    endpointHash: readiness?.destination.endpointHash || null,
                    endpointHint: readiness?.destination.endpointHint || null,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                },
                routes: {
                    deliveryDetail: outcome?.operationLinks?.deliveryDetail || readiness?.operationLinks.deliveryDetail || `GET /api/dwm/webhook-deliveries/${outcome?.latestAttempt?.deliveryId || readiness?.deliveryId || ':deliveryId'}`,
                    retryDryRun: readiness?.operationLinks.retryDryRun || 'POST /api/dwm/webhook-deliveries',
                    destinationTest: outcome?.operationLinks?.destinationTest || `POST /api/dwm/webhook-destinations/${destination.id}/test`,
                },
            }
        }),
        skippedDestinations: skippedDestinations.map(destination => ({
            destinationId: destination.id,
            orgId: destination.orgId,
            status: destination.status,
            reason: destination.reason,
            code: destination.reason === 'disabled' ? 'destination_disabled' : destination.reason,
        })),
        lifecycleBlockers: blockerCodes.filter(code => [
            'org_archived',
            'org_deleted',
            'member_revoked',
            'watchlist_paused',
            'watchlist_archived',
            'manual_webhook_selection_required',
            'role_not_allowed',
            'destination_disabled',
            'destination_unavailable',
            'missing_org_ref',
            'live_delivery_disabled',
        ].includes(code)),
        blockerCodes,
        audit: {
            auditEventIds: [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))],
            linked: auditEventContracts.length > 0,
            expectedActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
        },
        readiness: {
            alertDestinationReady: alertDestinationReadiness.ready,
            deliveryReadinessStatus: alertDeliveryProof.alertScopedStatus,
            recordedDeliveryStatus: alertDeliveryProof.delivery.recordedDeliveryStatus,
            retryableFailureCount: deliveryReadinessConsumer.counts.retryableFailure,
            nonRetryableFailureCount: deliveryReadinessConsumer.counts.nonRetryableFailure,
            idempotentReplayCount: deliveryReadinessConsumer.counts.idempotentReplay,
            redactedDryRunCount: deliveryReadinessConsumer.counts.redactedDryRun,
        },
        noLeakFields: ['destination.secret', 'destination.endpoint', 'otherOrg.destinationIds', 'case.evidence.rawContent'],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            responseBodyExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
    }
}

function buildDwmWebhookAlertDeliveryProof({
    ownerId,
    orgId,
    eventType,
    dryRun,
    liveRequested,
    liveDeliveryEnabled,
    selectedDestinations,
    skippedDestinations,
    normalizedAlert,
    watchlist,
    customerSetup,
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryTimeline,
    deliveryActionPlan,
    deliveryReplayGuard,
    destinationAdminProof,
    auditEventContracts,
}: {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    dryRun: boolean
    liveRequested: boolean
    liveDeliveryEnabled: boolean
    selectedDestinations: DwmAlertWebhookDispatchPlan['selectedDestinations']
    skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations']
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    customerSetup: ReturnType<typeof buildDwmWebhookCustomerSetupProof>
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryTimeline: ReturnType<typeof buildDwmWebhookDeliveryTimeline>
    deliveryActionPlan: ReturnType<typeof buildDwmWebhookDeliveryActionPlan>
    deliveryReplayGuard: ReturnType<typeof buildDwmWebhookDeliveryReplayGuard>
    destinationAdminProof: ReturnType<typeof buildDwmWebhookDestinationAdminProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const setupBlockers = [
        ...customerSetup.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...destinationAdminProof.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, true)),
    ]
    const deliveryBlockers = [
        ...alertDestinationReadiness.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryOutcome.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryTimeline.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryActionPlan.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryReplayGuard.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
    ]
    const selectedDestinationIds = new Set(selectedDestinations.map(destination => destination.id))
    const alertScopedBlockers = uniqueWebhookBlockers(deliveryBlockers.filter((blocker) => {
        if (!blocker.destinationId) return true
        if (selectedDestinationIds.size === 0) return true
        return selectedDestinationIds.has(blocker.destinationId)
    }))
    const blockers = uniqueWebhookBlockers([...setupBlockers, ...deliveryBlockers])
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const setupBlockingCodes = uniqueWebhookBlockers(setupBlockers)
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const alertScopedBlockingCodes = alertScopedBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const auditEventIds = [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))]
    const recordedDeliveryCount = deliveryOutcome.counts.recorded
    const recordedDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .map(destination => destination.destinationId)
    const pendingDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => !destination.recorded)
        .map(destination => destination.destinationId)
    const recordedDestinationBlockers = uniqueWebhookBlockers(deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .flatMap(destination => destination.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking))))
    const recordedDeliveryBlockingCodes = recordedDestinationBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const safeAlertBody = {
        id: normalizedAlert.id,
        title: normalizedAlert.title,
        severity: normalizedAlert.severity,
        confidence: normalizedAlert.confidence,
        sourceFamily: normalizedAlert.sourceFamily,
        evidenceCount: normalizedAlert.evidenceCount,
        route: normalizedAlert.route,
        dedupeKey: normalizedAlert.dedupeKey,
        casePath: normalizedAlert.casePath,
        caseId: normalizedAlert.caseId,
        alertUrl: normalizedAlert.alertUrl,
        provenanceSummary: normalizedAlert.provenanceSummary,
        watchlist,
    }
    const deliveryRequestBodyForDestination = (destinationId: string, live: boolean) => ({
        orgId,
        organizationId: orgId,
        tenantId: orgId,
        destinationId,
        eventType,
        alertId: normalizedAlert.id,
        watchlistItemId: watchlist.id,
        watchlistName: watchlist.name,
        dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        route: normalizedAlert.route,
        casePath: normalizedAlert.casePath,
        evidenceCount: normalizedAlert.evidenceCount,
        sourceFamily: normalizedAlert.sourceFamily,
        dryRun: !live,
        live,
        alert: safeAlertBody,
    })
    const dryRunDeliveryRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
        expectedAuditAction: deliveryAuditActionForEvent(eventType),
        method: 'POST',
        route: 'POST /api/dwm/webhook-deliveries',
        noNetwork: true,
        externalSendEnabled: false,
        body: deliveryRequestBodyForDestination(destination.id, false),
        blockers: alertScopedBlockers.filter(blocker => blocker.destinationId === destination.id),
    }))
    const liveDeliveryRequests = selectedDestinations.map(destination => {
        const destinationBlockers = alertScopedBlockers.filter(blocker => !blocker.destinationId || blocker.destinationId === destination.id)
        const blockingDestinationCodes = destinationBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
        const canSend = liveDeliveryEnabled && !dryRun && liveRequested && blockingDestinationCodes.length === 0
        return {
            destinationId: destination.id,
            expectedIdempotencyKey: buildIdempotencyKey(eventType, orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id),
            expectedAuditAction: deliveryAuditActionForEvent(eventType),
            method: 'POST',
            route: 'POST /api/dwm/webhook-deliveries',
            noNetwork: !canSend,
            externalSendEnabled: canSend,
            body: canSend ? deliveryRequestBodyForDestination(destination.id, true) : null,
            blockers: destinationBlockers,
        }
    })
    const customerSetupDryRunRequests = Array.isArray((customerSetup as { dryRunTestRequests?: unknown }).dryRunTestRequests)
        ? (customerSetup as { dryRunTestRequests: Array<{ destinationId?: string, payloadPreview?: unknown }> }).dryRunTestRequests
        : []
    const customerSetupDryRunRequestByDestination = new Map(customerSetupDryRunRequests
        .map(request => [clean(request.destinationId), request] as const)
        .filter(([destinationId]) => Boolean(destinationId)))
    const destinationTestRequests = selectedDestinations.map(destination => ({
        destinationId: destination.id,
        expectedIdempotencyKey: buildIdempotencyKey('dwm.alert.test', orgId, destination.id, 'webhook_test'),
        expectedAuditAction: 'delivery.tested',
        method: 'POST',
        route: `POST /api/dwm/webhook-destinations/${destination.id}/test`,
        noNetwork: true,
        externalSendEnabled: false,
        body: {
            orgId,
            destinationId: destination.id,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            dryRun: true,
            live: false,
            alert: safeAlertBody,
        },
        payloadPreview: customerSetupDryRunRequestByDestination.get(destination.id)?.payloadPreview || null,
    }))
    const status = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : blockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'
    const alertScopedStatus = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : alertScopedBlockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'

    return {
        schemaVersion: 'dwm.webhook.alert_delivery_proof.v1',
        ownerId,
        orgId: orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        status,
        alertScopedStatus,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        destinationSelection: {
            selectedCount: selectedDestinations.length,
            skippedCount: skippedDestinations.length,
            selectedDestinationIds: [...selectedDestinationIds],
            skippedDestinations: skippedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.orgId,
                reason: destination.reason,
                blocking: destination.reason !== 'event_not_subscribed',
            })),
        },
        setup: {
            status: customerSetup.status,
            summary: customerSetup.summary,
            routeNames: customerSetup.routes,
            stepStatuses: customerSetup.setupSteps.map(step => ({
                id: step.id,
                status: step.status,
                route: step.route,
                blockerCodes: step.blockers.map(blocker => blocker.code),
            })),
        },
        delivery: {
            ready: alertDestinationReadiness.ready,
            state: alertDestinationReadiness.state,
            outcomeCounts: deliveryOutcome.counts,
            timelineCounts: deliveryTimeline.counts,
            actionCounts: deliveryActionPlan.counts,
            replayGuardCounts: deliveryReplayGuard.counts,
            latestAuditEventIds: auditEventIds.slice(0, 10),
            recordedDestinationIds,
            pendingDestinationIds,
            recordedDeliveryStatus: recordedDeliveryCount === 0
                ? 'not_recorded'
                : recordedDeliveryBlockingCodes.length > 0
                    ? 'blocked'
                    : 'recorded',
            recordedDeliveryBlockerCodes: recordedDeliveryBlockingCodes,
        },
        retryAndReplay: {
            retryScheduledCount: deliveryActionPlan.counts.retryDryRun + deliveryActionPlan.counts.retryLive,
            replayReadyCount: deliveryReplayGuard.counts.dryRunAllowed,
            duplicateDeliveredCount: deliveryReplayGuard.counts.duplicateDelivered,
            terminalFailureCount: deliveryReplayGuard.counts.terminalFailure,
        },
        dashboardProof: {
            productProgress: destinationAdminProof.productProgress,
            adminProofSummary: destinationAdminProof.summary,
            customerSetupRoute: customerSetup.routes.list,
            deliveryRoute: customerSetup.routes.deliver,
            deliveryHistoryRoute: customerSetup.routes.deliveryHistory,
        },
        actionRequests: {
            dryRunDeliveries: dryRunDeliveryRequests,
            liveDeliveries: liveDeliveryRequests,
            destinationTests: destinationTestRequests,
            alertEventReadiness: {
                schemaVersion: 'dwm.webhook.alert_event_readiness_fixture.v1',
                consumesSchemaVersion: alertDestinationReadiness.alertEventConsumer.schemaVersion,
                noNetwork: true,
                externalSendEnabled: false,
                eventType,
                orgId,
                alertId: normalizedAlert.id,
                dedupeKey: normalizedAlert.dedupeKey,
                casePath: normalizedAlert.casePath,
                sourceFamily: normalizedAlert.sourceFamily,
                watchlistId: watchlist.id,
                provenanceSummary: normalizedAlert.provenanceSummary,
                selectedDestinationIds: [...selectedDestinationIds],
                expectedDeliveryAttempts: dryRunDeliveryRequests.map(request => ({
                    destinationId: request.destinationId,
                    idempotencyKey: request.expectedIdempotencyKey,
                    auditAction: request.expectedAuditAction,
                    dryRun: true,
                    live: false,
                })),
                payloadPreview: alertDestinationReadiness.alertEventConsumer.payloadPreview,
                payloadValidation: alertDestinationReadiness.alertEventConsumer.payloadValidation,
                readiness: {
                    ready: alertDestinationReadiness.alertEventConsumer.ready,
                    state: alertDestinationReadiness.alertEventConsumer.state,
                    blockerCodes: alertDestinationReadiness.alertEventConsumer.blockerCodes,
                    auditLinked: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditLinked,
                    auditMissing: alertDestinationReadiness.alertEventConsumer.auditReadiness.auditMissing,
                },
                blockers: alertScopedBlockers,
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                    payloadSecretExposed: false,
                },
            },
            deliveryHistory: {
                method: 'GET',
                route: customerSetup.routes.deliveryHistory,
                expectedAuditActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
                query: {
                    orgId,
                    alertId: normalizedAlert.id,
                    dedupeKey: normalizedAlert.dedupeKey,
                    casePath: normalizedAlert.casePath,
                },
            },
        },
        blockers,
        blockerCodes: blockingCodes,
        alertScopedBlockers,
        alertScopedBlockerCodes: alertScopedBlockingCodes,
        blockerGroups: {
            setupBlockerCodes: setupBlockingCodes,
            alertScopedBlockerCodes: alertScopedBlockingCodes,
            allBlockerCodes: blockingCodes,
        },
    }
}

export function buildDwmOrgAlertWebhookDeliveryOutcome({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const outcomeProjection = prepareDwmWebhookDestinationProjection({
        destinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
    })
    const { deliveryLedger: ledger, auditContracts } = outcomeProjection
    const deliveryById = new Map(deliveries.map(delivery => [delivery.id, delivery]))
    const auditByDeliveryId = new Map(auditContracts.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const healthRows = buildDwmWebhookDestinationHealthFromProjection({ ...outcomeProjection, liveDeliveryEnabled })
    const healthByDestination = new Map(healthRows.map(health => [health.destinationId, health]))

    const selectedDestinations = dispatch.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(dispatch.eventType, dispatch.orgId, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
        const relatedAttempts = ledger
            .filter(attempt => attempt.idempotencyKey === idempotencyKey)
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const latestAttempt = relatedAttempts[0] || null
        const delivery = latestAttempt ? deliveryById.get(latestAttempt.deliveryId) || null : null
        const preview = delivery ? buildDwmWebhookDeliveryPreview(delivery) : null
        const audit = latestAttempt ? auditByDeliveryId.get(latestAttempt.deliveryId) || null : null
        const health = healthByDestination.get(destination.id) || null
        const blockers: ReturnType<typeof orgAlertOutcomeBlocker>[] = []
        if (!latestAttempt) blockers.push(orgAlertOutcomeBlocker('not_recorded', 'No delivery attempt has been recorded for this selected destination yet.', destination.id, true))
        if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(orgAlertOutcomeBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', destination.id, true))
        if (latestAttempt?.retryable) blockers.push(orgAlertOutcomeBlocker('retry_scheduled', 'Latest delivery attempt is retryable and has backoff scheduled.', destination.id, false))
        if (latestAttempt?.status === 'skipped') blockers.push(orgAlertOutcomeBlocker('delivery_skipped', 'Latest delivery attempt was skipped.', destination.id, latestAttempt.errorClass !== 'live_delivery_disabled'))
        if (health && !health.ready && health.blockers.some(blocker => blocker !== 'live_delivery_disabled' && blocker !== 'retry_scheduled')) {
            blockers.push(orgAlertOutcomeBlocker('destination_unhealthy', 'Destination health is not ready for customer delivery.', destination.id, Boolean(health.retry.retryable)))
        }

        return {
            schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_destination.v1',
            destinationId: destination.id,
            orgId: destination.org_id,
            label: destination.name,
            type: destination.kind,
            status: latestAttempt?.status || 'not_recorded',
            idempotencyKey,
            recorded: Boolean(latestAttempt),
            latestAttempt: latestAttempt
                ? {
                    requestId: latestAttempt.requestId,
                    deliveryId: latestAttempt.deliveryId,
                    status: latestAttempt.status,
                    rawStatus: latestAttempt.rawStatus,
                    dryRun: latestAttempt.dryRun,
                    live: latestAttempt.live,
                    liveRequested: latestAttempt.liveRequested,
                    responseStatus: latestAttempt.responseStatus,
                    errorClass: latestAttempt.errorClass,
                    retryable: latestAttempt.retryable,
                    nextRetryAt: latestAttempt.nextRetryAt,
                    attemptCount: latestAttempt.attemptCount,
                    auditEventId: audit?.auditEventId || latestAttempt.auditEventId,
                    attemptedAt: latestAttempt.attemptedAt,
                    payloadHash: latestAttempt.payloadHash,
                }
                : null,
            preview: preview
                ? {
                    discord: {
                        content: preview.discord.content,
                        embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                        fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                            ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                            : [],
                    },
                    context: preview.context,
                    payloadHash: preview.payloadHash,
                }
                : null,
            audit: {
                latestAuditEventId: audit?.auditEventId || latestAttempt?.auditEventId || null,
                action: audit?.action || latestAttempt?.auditAction || null,
            },
            operationLinks: preview?.operationLinks || null,
            health: health
                ? {
                    status: health.health,
                    ready: health.ready,
                    blockers: health.blockers,
                    latestAuditEventId: health.latestAuditEventId,
                }
                : null,
            blockers: uniqueWebhookBlockers(blockers),
        }
    })
    const skippedDestinations = dispatch.skippedDestinations.map(skipped => ({
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome_skipped_destination.v1',
        destinationId: skipped.id,
        orgId: skipped.orgId,
        status: 'skipped',
        reason: skipped.reason,
        blockers: [orgAlertOutcomeBlocker(skipped.reason, `Destination skipped: ${skipped.reason}.`, skipped.id, skipped.reason !== 'event_not_subscribed')],
    }))
    const allBlockers = uniqueWebhookBlockers([
        ...selectedDestinations.flatMap(destination => destination.blockers),
        ...skippedDestinations.flatMap(destination => destination.blockers),
    ])

    return {
        schemaVersion: 'dwm.webhook.org_alert_delivery_outcome.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        eventType: dispatch.eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: true,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        counts: {
            selected: selectedDestinations.length,
            skipped: skippedDestinations.length,
            recorded: selectedDestinations.filter(destination => destination.recorded).length,
            dryRun: selectedDestinations.filter(destination => destination.latestAttempt?.dryRun).length,
            delivered: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'sent').length,
            failed: selectedDestinations.filter(destination => destination.latestAttempt?.status === 'failed').length,
            retryable: selectedDestinations.filter(destination => destination.latestAttempt?.retryable).length,
            blocked: allBlockers.filter(blocker => blocker.blocking).length,
        },
        selectedDestinations,
        skippedDestinations,
        blockers: allBlockers,
    }
}

export function buildDwmAlertWebhookReadinessHandoff({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const liveRequested = parseBoolean(normalizedInput.live, false)
    const eventType = parseEventType(normalizedInput.eventType ?? normalizedInput.event_type, 'dwm.alert.created')
    const dispatch = buildDwmWebhookDispatchPlanForDestinations(ownerId, normalizedInput, destinations)
    const normalizedAlert = normalizeAlert(dispatch.alert)
    const watchlist = normalizeWatchlist(dispatch.alert.watchlist)
    const orgDestinations = destinations.filter(destination => destination.orgId === dispatch.orgId)
    const orgDeliveries = deliveries.filter(delivery => delivery.orgId === dispatch.orgId)
    const orgAuditEvents = auditEvents.filter(audit => audit.orgId === dispatch.orgId)
    const readinessProjection = prepareDwmWebhookDestinationProjection({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
    })
    const destinationReadiness = readinessProjection.readiness
    const destinationHealth = buildDwmWebhookDestinationHealthFromProjection({ ...readinessProjection, liveDeliveryEnabled })
    const retryPersistence = buildDwmWebhookDeliveryRetryPersistence({
        destinations: orgDestinations,
        deliveries: orgDeliveries,
        auditEvents: orgAuditEvents,
        liveDeliveryEnabled,
        filters: {
            orgId: dispatch.orgId,
            alertId: normalizedAlert.id,
            casePath: normalizedAlert.casePath,
            dedupeKey: normalizedAlert.dedupeKey || normalizedAlert.id,
        },
    })
    const selectedDestinationIds = new Set(dispatch.selectedDestinations.map(destination => destination.id))
    const selectedRetryKeys = retryPersistence.deliveryKeys
        .filter(key => key.destinationId && selectedDestinationIds.has(key.destinationId))
    const alertEventExpectedAuditAction = deliveryAuditActionForEvent(eventType)
    const alertEventAuditContracts = readinessProjection.auditContracts
    const selectedAlertEventAuditContracts = alertEventAuditContracts.filter((audit) => {
        const auditDestinationSelected = audit.destinationId ? selectedDestinationIds.has(audit.destinationId) : false
        const auditAlertMatches = audit.delivery?.alertId === normalizedAlert.id
        const auditDedupeMatches = Boolean(normalizedAlert.dedupeKey && audit.delivery?.idempotencyKey?.includes(normalizedAlert.dedupeKey))
        return audit.orgId === dispatch.orgId && (auditDestinationSelected || auditAlertMatches || auditDedupeMatches)
    })
    const firstSelectedDestination = dispatch.selectedDestinations[0] || null
    const alertEventPreviewPayload = firstSelectedDestination
        ? buildDwmAlertDeliveryPayload({
            destination: {
                id: firstSelectedDestination.id,
                kind: firstSelectedDestination.kind,
                name: firstSelectedDestination.name,
                org_id: dispatch.orgId,
            },
            eventType,
            deliveryId: '<dry_run_delivery_id>',
            alert: dispatch.alert,
        }) as Record<string, unknown>
        : null
    const alertEventPreviewContext = recordOrEmpty(alertEventPreviewPayload?._hanasand)
    const alertEventPreviewEmbeds = Array.isArray(alertEventPreviewPayload?.embeds)
        ? alertEventPreviewPayload.embeds as Array<Record<string, unknown>>
        : []
    const alertEventPreviewFields = Array.isArray(alertEventPreviewEmbeds[0]?.fields)
        ? (alertEventPreviewEmbeds[0]?.fields as Array<Record<string, unknown>>)
        : []
    const alertEventPreviewFieldNames = alertEventPreviewFields.map(field => clean(field.name)).filter(Boolean)
    const alertEventRequiredDiscordFields = ['Organization', 'Severity', 'Watchlist', 'Source family', 'Evidence count', 'Workflow', 'Dedupe key']
    const alertEventMissingDiscordFields = alertEventRequiredDiscordFields.filter(name => !alertEventPreviewFieldNames.includes(name))
    const alertEventDiscordLimits = {
        content: clean(alertEventPreviewPayload?.content).length <= DISCORD_CONTENT_LIMIT,
        embedCount: alertEventPreviewEmbeds.length <= 10,
        title: clean(alertEventPreviewEmbeds[0]?.title).length <= DISCORD_EMBED_TITLE_LIMIT,
        description: clean(alertEventPreviewEmbeds[0]?.description).length <= DISCORD_EMBED_DESCRIPTION_LIMIT,
        fields: alertEventPreviewFields.length <= DISCORD_EMBED_FIELD_LIMIT,
        fieldNames: alertEventPreviewFields.every(field => clean(field.name).length <= DISCORD_EMBED_FIELD_NAME_LIMIT),
        fieldValues: alertEventPreviewFields.every(field => clean(field.value).length <= DISCORD_EMBED_FIELD_VALUE_LIMIT),
    }
    const alertEventSerializedPreview = JSON.stringify(alertEventPreviewPayload || {})
    const alertEventDiscordTemplate = recordOrEmpty(alertEventPreviewContext.discordTemplate)
    const alertEventRedactionProof = {
        endpointExposed: false,
        webhookSecretExposed: false,
        responseBodyExposed: false,
        mentionsDisabled: Array.isArray(recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse)
            && (recordOrEmpty(alertEventPreviewPayload?.allowed_mentions).parse as unknown[]).length === 0,
        noWebhookUrl: !/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+/i.test(alertEventSerializedPreview),
    }
    const alertEventRedactionValid = !alertEventRedactionProof.endpointExposed
        && !alertEventRedactionProof.webhookSecretExposed
        && !alertEventRedactionProof.responseBodyExposed
        && alertEventRedactionProof.mentionsDisabled
        && alertEventRedactionProof.noWebhookUrl
    const blockers: Array<{
        code: string
        message: string
        destinationId: string | null
        blocking: boolean
    }> = []

    if (!dispatch.orgId) blockers.push(alertReadinessBlocker('missing_org', 'Organization context is required for customer webhook delivery.'))
    if (!normalizedAlert.id && !normalizedAlert.dedupeKey) blockers.push(alertReadinessBlocker('missing_alert_context', 'Alert id or dedupe key is required for customer webhook delivery.'))
    if (!watchlist.id && !watchlist.name && watchlist.terms.length === 0) blockers.push(alertReadinessBlocker('missing_watchlist_context', 'Watchlist identity or matched term is required for customer context.'))
    if (!normalizedAlert.sourceFamily || normalizedAlert.sourceFamily === 'dark_web' && !normalizedAlert.provenanceSummary) blockers.push(alertReadinessBlocker('missing_source_proof', 'Source family or provenance proof is required for customer delivery.'))
    if (normalizedAlert.evidenceCount <= 0) blockers.push(alertReadinessBlocker('missing_evidence', 'At least one evidence item is required for customer delivery.'))
    if (!normalizedAlert.eventTimestamp) blockers.push(alertReadinessBlocker('missing_timestamp', 'A source observation timestamp is required for customer delivery.'))
    if (dispatch.selectedDestinations.length === 0) blockers.push(alertReadinessBlocker('no_enabled_destination', 'No enabled destination is selected for this org alert.'))
    for (const skipped of dispatch.skippedDestinations) {
        if (skipped.reason === 'disabled') blockers.push(alertReadinessBlocker('destination_disabled', 'A destination exists but is disabled for this alert event.', skipped.id))
        if (skipped.reason === 'event_not_subscribed') blockers.push(alertReadinessBlocker('event_not_subscribed', 'A destination is not subscribed to this alert event.', skipped.id, false))
    }
    if (liveRequested && !dryRun && !liveDeliveryEnabled) blockers.push(alertReadinessBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.'))
    for (const key of selectedRetryKeys) {
        if (key.dedupe.alreadyDelivered) blockers.push(alertReadinessBlocker('dedupe_already_delivered', 'This destination already has a delivered attempt for the alert idempotency key.', key.destinationId, false))
        if (key.retry.retryable) blockers.push(alertReadinessBlocker('retry_scheduled', 'The latest failed delivery has retry/backoff scheduled.', key.destinationId, false))
        if (key.retry.terminalFailure) blockers.push(alertReadinessBlocker('terminal_failure', 'The latest delivery failed with a non-retryable error.', key.destinationId))
    }
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const ready = dispatch.selectedDestinations.length > 0 && blockingCodes.length === 0

    return {
        schemaVersion: 'dwm.webhook.alert_readiness_handoff.v1',
        ownerId,
        orgId: dispatch.orgId || null,
        tenantId: clean(normalizedInput.tenantId) || dispatch.orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        ready,
        state: ready ? 'ready' : dispatch.selectedDestinations.length > 0 ? 'blocked' : 'missing_destination',
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        destinationSelection: {
            selectedDestinationIds: dispatch.selectedDestinations.map(destination => destination.id),
            skippedDestinations: dispatch.skippedDestinations,
        },
        blockers: uniqueBlockers,
        blockerCodes: blockingCodes,
        destinationReadiness,
        destinationHealth,
        deliveryRetryPersistence: retryPersistence,
        alertEventConsumer: {
            schemaVersion: 'dwm.webhook.alert_event_consumer.v1',
            consumesEventType: eventType,
            noNetwork: true,
            ready,
            state: ready ? 'ready' : dispatch.selectedDestinations.length > 0 ? 'blocked' : 'missing_destination',
            routeContract: {
                dryRunDelivery: {
                    method: 'POST',
                    route: '/api/dwm/webhook-deliveries',
                    requiredBody: ['organizationId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun', 'alert'],
                    noNetworkDefault: true,
                },
                deliveryHistory: {
                    method: 'GET',
                    route: '/api/dwm/webhook-deliveries',
                    requiredQuery: ['orgId', 'alertId'],
                    optionalQuery: ['destinationId', 'dedupeKey', 'casePath'],
                    noNetwork: true,
                },
            },
            requiredFields: {
                orgId: Boolean(dispatch.orgId),
                destinationId: Boolean(firstSelectedDestination?.id),
                alertId: Boolean(normalizedAlert.id),
                watchlistId: Boolean(watchlist.id),
                severity: Boolean(normalizedAlert.severity),
                title: Boolean(normalizedAlert.title),
                sourceFamily: Boolean(normalizedAlert.sourceFamily),
                evidence: normalizedAlert.evidenceCount > 0,
                provenance: Boolean(normalizedAlert.provenanceSummary),
                timestamp: Boolean(normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt),
                link: Boolean(normalizedAlert.alertUrl || normalizedAlert.casePath),
                dedupeKey: Boolean(normalizedAlert.dedupeKey),
            },
            persistenceTargets: {
                deliveryAttempt: true,
                deliveryHistory: true,
                retryPersistence: true,
                auditEvent: true,
                idempotencyKey: firstSelectedDestination
                    ? buildIdempotencyKey(eventType, dispatch.orgId, firstSelectedDestination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
                    : null,
            },
            auditReadiness: {
                schemaVersion: 'dwm.webhook.alert_event_audit_readiness.v1',
                expectedNextAction: alertEventExpectedAuditAction,
                expectedFailureAction: 'delivery.failed',
                expectedSkippedAction: 'delivery.skipped',
                expectedRetryAction: 'delivery.retry_scheduled',
                linkedAuditEventIds: selectedAlertEventAuditContracts.map(audit => audit.auditEventId),
                linkedActions: [...new Set(selectedAlertEventAuditContracts.map(audit => audit.action))],
                latestAuditEventId: selectedAlertEventAuditContracts[0]?.auditEventId || null,
                auditLinked: selectedAlertEventAuditContracts.length > 0,
                auditMissing: selectedAlertEventAuditContracts.length === 0,
                retryAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.retry_scheduled'),
                failureAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.failed'),
                skippedAuditLinked: selectedAlertEventAuditContracts.some(audit => audit.action === 'delivery.skipped'),
                contracts: selectedAlertEventAuditContracts.slice(0, 5),
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    webhookSecretExposed: false,
                    metadataRedacted: true,
                },
            },
            payloadPreview: alertEventPreviewPayload && firstSelectedDestination
                ? {
                    schemaVersion: 'dwm.webhook.alert_event_payload_preview.v1',
                    destinationId: firstSelectedDestination.id,
                    redactedDestination: {
                        id: firstSelectedDestination.id,
                        label: firstSelectedDestination.name,
                        type: firstSelectedDestination.kind,
                        endpointExposed: false,
                    },
                    discord: {
                        content: clean(alertEventPreviewPayload.content),
                        embedCount: alertEventPreviewEmbeds.length,
                        fieldNames: alertEventPreviewFieldNames,
                    },
                    context: {
                        orgId: dispatch.orgId || null,
                        destinationId: firstSelectedDestination.id,
                        alertId: normalizedAlert.id,
                        watchlistId: watchlist.id,
                        watchlistTerm: watchlist.terms[0] || watchlist.name || null,
                        sourceFamily: normalizedAlert.sourceFamily,
                        evidenceCount: normalizedAlert.evidenceCount,
                        casePath: normalizedAlert.casePath,
                        routeUrl: normalizedAlert.alertUrl || normalizedAlert.casePath,
                        dedupeKey: normalizedAlert.dedupeKey,
                        replay: eventType === 'dwm.alert.replayed',
                        dryRun,
                        workflowStatus: workflowSummary(normalizedAlert, eventType),
                        provenanceIds: deliveryProvenanceIds(normalizedAlert.provenance),
                        discordTemplate: Object.keys(alertEventDiscordTemplate).length > 0
                            ? {
                                templateId: clean(alertEventDiscordTemplate.templateId),
                                ready: alertEventDiscordTemplate.ready === true,
                                missing: Array.isArray(alertEventDiscordTemplate.missing) ? alertEventDiscordTemplate.missing : [],
                                requiredFields: Array.isArray(alertEventDiscordTemplate.requiredFields) ? alertEventDiscordTemplate.requiredFields : [],
                                noNetworkDefault: alertEventDiscordTemplate.noNetworkDefault === true,
                            }
                            : null,
                    },
                    redaction: {
                        safeForCustomerDisplay: true,
                        endpointExposed: false,
                        webhookSecretExposed: false,
                        responseBodyExposed: false,
                    },
                }
                : null,
            payloadValidation: {
                schemaVersion: 'dwm.webhook.discord_payload_validation.v1',
                valid: Boolean(alertEventPreviewPayload && firstSelectedDestination)
                    && alertEventMissingDiscordFields.length === 0
                    && Object.values(alertEventDiscordLimits).every(Boolean)
                    && alertEventRedactionValid,
                requiredDiscordFields: alertEventRequiredDiscordFields,
                missingDiscordFields: alertEventMissingDiscordFields,
                limits: alertEventDiscordLimits,
                redaction: alertEventRedactionProof,
                context: {
                    orgId: Boolean(dispatch.orgId),
                    alertId: Boolean(normalizedAlert.id),
                    watchlistId: Boolean(watchlist.id),
                    sourceFamily: Boolean(normalizedAlert.sourceFamily),
                    evidence: normalizedAlert.evidenceCount > 0,
                    caseOrAlertLink: Boolean(normalizedAlert.alertUrl || normalizedAlert.casePath),
                    provenance: Boolean(normalizedAlert.provenanceSummary),
                },
            },
            blockers: uniqueBlockers,
            blockerCodes: blockingCodes,
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
    }
}

export function buildDwmWebhookDestinationTestContract({
    destination,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    destination: DwmWebhookDestinationPublic | null
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const { destinationId, latestTest, persistedLastTest, preview, testPayload, dryRunPayloadPreview } = buildDwmWebhookDestinationTestEvidence(destination, deliveries)
    const health = destination
        ? buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents, liveDeliveryEnabled })[0] || null
        : null
    const auditContracts = buildDwmWebhookAuditEventContracts({
        auditEvents,
        deliveries,
        destinations: destination ? [destination] : [],
    })
    const latestAudit = latestTest
        ? auditContracts.find(audit => audit.deliveryId === latestTest.id) || null
        : destinationId
            ? auditContracts.find(audit => audit.destinationId === destinationId && audit.action === 'delivery.tested') || null
            : null
    const blockers: ReturnType<typeof testContractBlocker>[] = []
    if (!canManage) blockers.push(testContractBlocker('permission_denied', 'Only organization owners and admins can test webhook destinations.', destinationId))
    if (!destination) blockers.push(testContractBlocker('destination_missing', 'Webhook destination is not available for this organization.', null))
    if (destination && destination.status !== 'active') blockers.push(testContractBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', destination.id))
    if (destination && !destination.endpointHash && !destination.endpointHint) blockers.push(testContractBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', destination.id))
    if (!latestTest && !persistedLastTest) blockers.push(testContractBlocker('no_verified_dry_run', 'Destination has not recorded a dry-run test delivery yet.', destinationId, false))
    if (latestTest?.status === 'failed' || destination?.lastTestStatus === 'failed' || persistedLastTest?.status === 'failed' || health?.lastTest.status === 'failed') blockers.push(testContractBlocker('test_failed', 'Latest destination test failed.', destinationId))
    if (!latestAudit) blockers.push(testContractBlocker('audit_missing', 'Destination test has no linked audit event yet.', destinationId, false))
    if (!liveDeliveryEnabled) blockers.push(testContractBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; tests default to dry-run.', destinationId, false))
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const verified = latestTest
        ? isLiveDeliveredProof(latestTest)
        : isLiveDeliveredProof(persistedLastTest)
    const latestTestStatus = latestTest?.status || persistedLastTest?.status || null
    const expectedIdempotencyKey = destination ? buildIdempotencyKey('dwm.alert.test', destination.orgId, destination.id, 'webhook_test') : null
    const testRoute = destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test'
    const expectedPayloadHash = testPayload ? hashWebhookValue('payload', JSON.stringify(testPayload)) : null
    const canSendDryRunTest = Boolean(
        canManage
        && destination
        && destination.status === 'active'
        && !uniqueBlockers.some(blocker => blocker.blocking),
    )

    return {
        schemaVersion: 'dwm.webhook.destination_test.v1',
        orgId: destination?.orgId || latestTest?.orgId || null,
        destinationId,
        type: destination?.kind || null,
        label: destination?.name || null,
        status: verified ? 'verified' : latestTestStatus === 'failed' || destination?.lastTestStatus === 'failed' || health?.lastTest.status === 'failed' ? 'test_failed' : destination?.status === 'archived' || destination?.status === 'paused' ? 'disabled' : 'pending',
        noNetwork: true,
        liveDeliveryEnabled,
        externalSendEnabled: false,
        access: {
            role: clean(viewerRole) || null,
            canTest: Boolean(canManage && destination && destination.status === 'active' && blockingCodes.length === 0),
            canReadStatus: Boolean(destination || latestTest),
            memberSafe: !canManage,
        },
        redactedEndpoint: {
            endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : preview?.destination.endpointHint || null,
            endpointHash: destination?.endpointHash || preview?.destination.endpointHash || null,
        },
        latestTest: latestTest
            ? {
                requestId: latestTest.id,
                deliveryId: latestTest.id,
                status: latestTest.status,
                dryRun: latestTest.dryRun,
                live: !latestTest.dryRun && latestTest.status !== 'skipped',
                responseStatus: latestTest.responseStatus,
                error: latestTest.error ? redactDeliveryEvidenceText(latestTest.error) : null,
                attemptedAt: latestTest.attemptedAt,
                payloadHash: latestTest.payloadHash,
                idempotencyKey: latestTest.idempotencyKey,
                source: 'delivery_ledger',
            }
            : persistedLastTest,
        preview: preview
            ? {
                discord: {
                    content: preview.discord.content,
                    embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                    fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                        ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                        : [],
                    allowedMentions: preview.discord.allowedMentions,
                },
                context: preview.context,
                payloadHash: preview.payloadHash,
            }
            : null,
        dryRunPayloadPreview,
        dryRunTestReceipt: {
            schemaVersion: 'dwm.webhook.destination_test_receipt.v1',
            noNetwork: true,
            externalSendEnabled: false,
            destinationId,
            orgId: destination?.orgId || null,
            status: 'dry_run',
            dryRun: true,
            live: false,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            idempotencyKey: expectedIdempotencyKey,
            payloadHash: expectedPayloadHash,
            redactedDestination: {
                id: destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null,
                endpointHash: destination?.endpointHash || null,
                endpointExposed: false,
            },
            expected: {
                deliveryStatus: 'dry_run',
                auditAction: 'delivery.tested',
                persistedAttempt: true,
                responseSummary: 'Dry-run delivery payload prepared without external network.',
            },
            retry: {
                attemptCount: 1,
                retryable: false,
                nextRetryAt: null,
                errorClass: null,
            },
            timestamps: {
                attemptedAt: null,
                createdAt: null,
                updatedAt: null,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
        dryRunTestRequest: {
            method: 'POST',
            route: testRoute,
            canSend: canSendDryRunTest,
            noNetwork: true,
            externalSendEnabled: false,
            body: destination
                ? {
                    orgId: destination.orgId,
                    destinationId: destination.id,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    idempotencyKey: expectedIdempotencyKey,
                }
                : null,
            expected: {
                deliveryStatus: 'dry_run',
                persistedAttempt: true,
                auditAction: 'delivery.tested',
                idempotencyKey: expectedIdempotencyKey,
                endpointExposed: false,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
        health: health
            ? {
                status: health.health,
                ready: health.ready,
                blockers: health.blockers,
                lastTest: health.lastTest,
                latestAuditEventId: health.latestAuditEventId,
            }
            : null,
        audit: {
            latestAuditEventId: latestAudit?.auditEventId || null,
            auditEventIds: auditContracts.filter(audit => audit.destinationId === destinationId).map(audit => audit.auditEventId),
            auditEventContracts: canManage ? auditContracts.filter(audit => audit.destinationId === destinationId).slice(0, 10) : [],
        },
        blockers: uniqueBlockers,
        blockingCodes,
        routes: {
            test: testRoute,
            destination: destinationId ? `GET /api/dwm/webhooks?destinationId=${destinationId}` : 'GET /api/dwm/webhooks',
        },
    }
}

export async function testDwmWebhookDestination(ownerId: string, id: string, input: DwmAlertNotificationInput = {}) {
    const destination = await loadDwmWebhookDestination(ownerId, id)
    if (!destination || destination.status === 'archived') return null

    const delivery = await deliverToDwmWebhookDestinationWithLineageGuard({
        ownerId,
        destination,
        eventType: 'dwm.alert.test',
        alert: buildDwmWebhookTestAlert(destination),
        dryRun: parseBoolean(input.dryRun ?? input.dry_run, true),
        live: parseBoolean(input.live, false),
        markTested: true,
    })

    return delivery
}

export async function deliverDwmAlertNotification(
    ownerId: string,
    input: DwmAlertNotificationInput,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }> = postPublicWebhook
) {
    const eventType = parseEventType(input.eventType ?? input.event_type, 'dwm.alert.created')
    const alert = normalizeDispatchAlertInput(input)
    const orgId = dispatchOrganizationId(ownerId, input, alert)
    const destinationId = clean(input.destinationId ?? input.destination_id)
    const dryRun = parseBoolean(input.dryRun ?? input.dry_run, true)
    const live = parseBoolean(input.live, false)
    const destination = destinationId ? await loadDwmWebhookDestination(ownerId, destinationId) : null
    const candidateDestinations = destinationId
        ? (destination ? [destination] : [])
        : await loadDestinationsForOrg(ownerId, orgId)
    const plan = buildDwmAlertWebhookDispatchPlanForAlert({
        ownerId,
        eventType,
        alert,
        orgId,
        destinations: candidateDestinations,
    })
    const normalizedPlanAlert = normalizeAlert(plan.alert)
    const deliveryBlockers = deliveryAttemptContractBlockers({
        input,
        plan,
        alert: normalizedPlanAlert,
        watchlist: normalizeWatchlist(plan.alert.watchlist),
    })
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, destinationId || null)
    const remainingDeliveryBlockers = deliveryBlockers.filter(blocker => !(
        blocker.code === 'missing_destination'
        && destinationId
        && missingIntent?.reason === 'requested_destination_not_found'
    ))
    if (remainingDeliveryBlockers.length) {
        const error = new Error(remainingDeliveryBlockers[0].message)
        Object.assign(error, { code: remainingDeliveryBlockers[0].code, blockers: remainingDeliveryBlockers })
        throw error
    }

    const deliveries = []
    const persistableSkipped = buildDwmAlertWebhookSkippedDeliveryIntents(plan)
    const destinationsById = new Map(candidateDestinations.map(destination => [destination.id, destination as DwmWebhookDestinationRow]))
    for (const skipped of persistableSkipped) {
        const destination = destinationsById.get(skipped.destinationId)
        if (!destination) continue
        deliveries.push(await recordSkippedSelectionDwmWebhookDelivery({
            ownerId,
            destination,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: skipped,
        }))
    }
    if (!plan.selectedDestinations.length && !persistableSkipped.length && missingIntent) {
        deliveries.push(await recordMissingDestinationDwmWebhookDelivery({
            ownerId,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            intent: missingIntent,
        }))
    }
    for (const destination of plan.selectedDestinations) {
        deliveries.push(await deliverToDwmWebhookDestinationWithLineageGuard({
            ownerId,
            destination: destination as DwmWebhookDestinationRow,
            eventType: plan.eventType,
            alert: plan.alert,
            dryRun,
            live,
            markTested: false,
            sender,
        }))
    }

    return deliveries
}

const DWM_WEBHOOK_DELIVERY_INSERT = `
    INSERT INTO dwm_webhook_deliveries (
        id, destination_id, owner_id, org_id, alert_id, event_type, status, dry_run,
        endpoint_hint, endpoint_hash, payload_hash, payload, response_status, response_body,
        error, error_class, attempt_count, next_retry_at, idempotency_key, watchlist_id,
        watchlist_name, route, case_path, attempted_at, completed_at, delivered_at
    )
    VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12::JSONB, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26
    )
    RETURNING *
`

export async function retryDwmWebhookDelivery(
    ownerId: string,
    orgId: string,
    deliveryId: string,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }> = postPublicWebhook
) {
    const priorResult = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE id = $1
          AND org_id = $2
          AND (
              owner_id = $3
              OR org_id IN (
                  SELECT organization_id
                  FROM organization_members
                  WHERE user_id = $3
                    AND status = 'active'
              )
          )
        LIMIT 1
    `, [deliveryId, orgId, ownerId])
    const prior = (priorResult.rows as DwmWebhookDeliveryRow[])[0]
    if (!prior) return { ok: false as const, status: 404, code: 'delivery_not_found', error: 'Delivery not found for this organization.' }
    if (prior.status !== 'failed' || prior.dry_run) return { ok: false as const, status: 409, code: 'delivery_retry_not_eligible', error: 'Only a failed live delivery can be retried.' }
    if (!prior.destination_id) return { ok: false as const, status: 409, code: 'delivery_destination_missing', error: 'The persisted delivery has no destination.' }
    const destinationId = prior.destination_id

    const destination = await loadDwmWebhookDestination(ownerId, destinationId)
    if (!destination || destination.org_id !== orgId || destination.status !== 'active') {
        return { ok: false as const, status: 409, code: 'delivery_destination_unavailable', error: 'The persisted delivery destination is unavailable.' }
    }
    if (destination.endpoint_hash !== prior.endpoint_hash) {
        return { ok: false as const, status: 409, code: 'delivery_destination_changed', error: 'The delivery destination changed; create a new delivery instead of replaying prior recipient approval.' }
    }
    if (process.env.DWM_WEBHOOK_LIVE_DELIVERY !== 'true') {
        return { ok: false as const, status: 503, code: 'live_delivery_disabled', error: 'Live webhook delivery is disabled.' }
    }
    return withDatabaseAdvisoryLock(`dwm-webhook-delivery:${prior.idempotency_key}`, async () => {
        const latest = await loadLatestDwmWebhookDeliveryAttempt(orgId, destinationId, prior.idempotency_key)
        if (!latest || latest.id !== prior.id) {
            return { ok: false as const, status: 409, code: 'delivery_retry_stale', error: 'Retry the latest failed attempt for this delivery lineage.' }
        }
        const lineageOwnerId = prior.owner_id
        const attemptCount = await countDwmWebhookDeliveryAttempts(orgId, destinationId, prior.idempotency_key)
        if (attemptCount >= MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS) {
            return { ok: false as const, status: 409, code: 'delivery_retry_limit', error: `Delivery retry is limited to ${MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS} total attempts.` }
        }
        const priorRetry = planDwmWebhookDeliveryRetry({
            status: prior.status,
            dryRun: prior.dry_run,
            responseStatus: prior.response_status,
            error: prior.error,
            attemptedAt: prior.attempted_at,
            attemptCount: attemptCount || 1,
        })
        if (!priorRetry.retryable) return { ok: false as const, status: 409, code: 'delivery_retry_not_eligible', error: 'The persisted delivery failure is not retryable.' }
        const persistedRetryAt = prior.next_retry_at && Number.isFinite(Date.parse(prior.next_retry_at))
            ? new Date(prior.next_retry_at).toISOString()
            : null
        const nextRetryAt = persistedRetryAt || priorRetry.nextRetryAt
        if (nextRetryAt && Date.parse(nextRetryAt) > Date.now()) {
            return {
                ok: false as const,
                status: 409,
                code: 'delivery_retry_not_ready',
                error: `This delivery can be retried at ${nextRetryAt}.`,
                nextRetryAt,
            }
        }

        const delivered = await findDeliveredDwmWebhookDelivery(orgId, destination.id, prior.idempotency_key)
        if (delivered) return { ok: false as const, status: 409, code: 'delivery_already_delivered', error: 'This exact idempotency lineage already has a delivered attempt.' }

        const persistedPayload = validatePersistedDwmWebhookRetryPayload(prior, destination, orgId)
        if (!persistedPayload.ok) return { status: 409 as const, ...persistedPayload }
        const { payloadBody, payloadHash, persistedReport } = persistedPayload

        const attemptedAt = new Date().toISOString()
        const { status, responseStatus, responseBody, error } = await sendDwmWebhookPayload(destination, payloadBody, sender)
        const completedAt = new Date().toISOString()
        const nextAttemptCount = attemptCount + 1
        const retryPlan = planDwmWebhookDeliveryRetry({ status, dryRun: false, responseStatus, error, attemptedAt, attemptCount: nextAttemptCount })
        const nextId = crypto.randomUUID()
        const row = await withTransaction(async query => {
            const result = await query(DWM_WEBHOOK_DELIVERY_INSERT, [
                nextId,
                destination.id,
                lineageOwnerId,
                orgId,
                prior.alert_id,
                prior.event_type,
                status,
                false,
                destination.endpoint_hint,
                destination.endpoint_hash,
                payloadHash,
                payloadBody,
                responseStatus,
                responseBody,
                error,
                retryPlan.errorClass,
                nextAttemptCount,
                retryPlan.nextRetryAt,
                prior.idempotency_key,
                prior.watchlist_id,
                prior.watchlist_name,
                prior.route,
                prior.case_path,
                attemptedAt,
                completedAt,
                status === 'delivered' ? completedAt : null,
            ])
            const persisted = result.rows[0] as DwmWebhookDeliveryRow
            const receiptBound = await bindDwmWebhookReceiverReceipt(persisted, query)
            if (status === 'delivered'
                && controlledReceiverEndpointHashes().includes(persisted.endpoint_hash)
                && !receiptBound) {
                throw new Error('Controlled receiver accepted delivery without an exact durable receipt.')
            }
            return persisted
        })
        if (status === 'delivered') {
            await run(`
            UPDATE dwm_webhook_destinations
               SET last_delivery_at = $2::timestamptz,
                   updated_at = NOW()
             WHERE id = $1
        `, [destination.id, completedAt])
        }
        const auditAction = status === 'failed' ? retryPlan.nextRetryAt ? 'delivery.retry_scheduled' : 'delivery.failed' : 'delivery.replayed'
        const auditEventId = await recordDwmWebhookAudit({
            ownerId: lineageOwnerId,
            actorId: ownerId,
            orgId,
            destinationId: destination.id,
            deliveryId: row.id,
            action: auditAction,
            metadata: {
                alertId: row.alert_id,
                status: row.status,
                responseStatus: row.response_status,
                error: row.error,
                errorClass: row.error_class,
                attemptCount: row.attempt_count,
                nextRetryAt: row.next_retry_at,
                idempotencyKey: row.idempotency_key,
                payloadHash: row.payload_hash,
                priorDeliveryId: prior.id,
                exactPersistedPayload: true,
                ...outboundReportAuditMetadata({ report: persistedReport }),
            },
        })
        return {
            ok: true as const,
            status: 202,
            delivery: {
                ...toDwmWebhookDelivery(row),
                auditEventId,
                auditAction,
                auditActorId: ownerId,
            },
        }})
}

function validatePersistedDwmWebhookRetryPayload(
    prior: DwmWebhookDeliveryRow,
    destination: DwmWebhookDestinationRow,
    orgId: string,
) {
    const payloadBody = canonicalJson(prior.payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    if (payloadHash !== prior.payload_hash) {
        return {
            ok: false as const,
            code: 'persisted_payload_invalid',
            error: 'The persisted delivery payload does not match its stored hash.',
        }
    }

    const persistedReport = reportFromPersistedPayload(prior.payload)
    if (persistedReport) {
        const checksum = clean(persistedReport.exportChecksum)
        const validation = validateOutboundThirdPartyReport(persistedReport, {
            organizationId: orgId,
            alertId: prior.alert_id,
            dedupeKey: checksum,
        })
        const expectedIdempotencyKey = buildIdempotencyKey(prior.event_type, orgId, destination.id, checksum)
        if (!validation.valid || prior.idempotency_key !== expectedIdempotencyKey) {
            return {
                ok: false as const,
                code: 'persisted_report_invalid',
                error: validation.error || 'The persisted report idempotency lineage is invalid.',
            }
        }
    }

    return { ok: true as const, payloadBody, payloadHash, persistedReport }
}

function reportFromPersistedPayload(payload: unknown) {
    const root = recordOrEmpty(payload)
    const direct = root.report
    const nested = recordOrEmpty(root._hanasand).report
    const report = direct ?? nested
    return report && typeof report === 'object' && !Array.isArray(report) ? report as Record<string, unknown> : undefined
}

export function buildDwmWebhookDeliveryAttemptContract({
    ownerId,
    input,
    destinations,
    deliveries = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const normalizedInput = buildDwmWebhookDeliveryRequestInput(input)
    const dryRun = parseBoolean(normalizedInput.dryRun ?? normalizedInput.dry_run, true)
    const live = parseBoolean(normalizedInput.live, false)
    const destinationMetadataById = new Map(destinations.map(destination => [destination.id, destination]))
    const dispatchDestinations = destinations.map(toDwmWebhookDispatchDestinationForContract)
    const plan = buildDwmAlertWebhookDispatchPlan({ ownerId, input: normalizedInput, destinations: dispatchDestinations })
    const alert = normalizeAlert(plan.alert)
    const watchlist = normalizeWatchlist(plan.alert.watchlist)
    const payloadContract = buildDwmWebhookDeliveryPayloadFieldContract({
        input: normalizedInput,
        plan,
        alert,
        watchlist,
        dryRun,
        live,
    })
    const requiredFields = Object.fromEntries(
        payloadContract.required.map(field => [field.key, field.present]),
    ) as Record<(typeof payloadContract.required)[number]['key'], boolean>
    const requiredBlockers = deliveryAttemptContractBlockers({ input: normalizedInput, plan, alert, watchlist })
    const existingByIdempotencyKey = new Map<string, DwmWebhookDeliveryPublic[]>()
    for (const delivery of deliveries) {
        const idempotencyKey = clean(delivery.idempotencyKey)
        if (!idempotencyKey) continue
        const attempts = existingByIdempotencyKey.get(idempotencyKey) || []
        attempts.push(delivery)
        existingByIdempotencyKey.set(idempotencyKey, attempts)
    }
    const selectedAttempts = plan.selectedDestinations.map((destination) => {
        const idempotencyKey = buildIdempotencyKey(plan.eventType, destination.org_id, destination.id, alert.dedupeKey || alert.id)
        const attemptCount = (existingByIdempotencyKey.get(idempotencyKey)?.length || 0) + 1
        const payload = buildDwmAlertDeliveryPayload({ destination, alert: plan.alert, eventType: plan.eventType, deliveryId: `delivery_contract_${destination.id}` })
        const preview = buildDwmWebhookDestinationTestPayloadPreview(payload)
        const retryPlan = planDwmWebhookDeliveryRetry({ status: dryRun ? 'dry_run' : 'skipped', dryRun, error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null, attemptCount })
        return {
            destinationId: destination.id,
            orgId: destination.org_id,
            alertId: alert.id,
            eventType: plan.eventType,
            status: dryRun ? 'dry_run' : live && liveDeliveryEnabled ? 'delivered' : 'skipped',
            dryRun,
            live: live && !dryRun && liveDeliveryEnabled,
            replay: plan.eventType === 'dwm.alert.replayed',
            dedupeKey: alert.dedupeKey || idempotencyKey,
            idempotencyKey,
            payloadHash: hashWebhookValue('payload', JSON.stringify(payload)),
            sanitizedPayloadPreview: preview,
            redactedDestination: {
                id: destination.id,
                label: destination.name,
                type: destination.kind,
                ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(destination.id)),
                endpointExposed: false,
            },
            responseSummary: dryRun ? 'Dry-run delivery payload prepared without external network.' : liveDeliveryEnabled ? 'Live delivery is explicitly enabled.' : 'Live delivery is disabled for this environment.',
            error: live && !dryRun && !liveDeliveryEnabled ? 'Live webhook delivery is disabled for this environment.' : null,
            retry: {
                attemptCount,
                retryable: retryPlan.retryable,
                nextRetryAt: retryPlan.nextRetryAt,
                errorClass: retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            audit: {
                expectedAction: dryRun ? 'delivery.tested' : plan.eventType === 'dwm.alert.replayed' ? 'delivery.replayed' : 'delivery.created',
                auditEventId: null,
            },
            timestamps: {
                createdAt: null,
                updatedAt: null,
                attemptedAt: null,
            },
        }
    })
    const skippedAttempts = buildDwmAlertWebhookSkippedDeliveryIntents(plan).map(intent => ({
        destinationId: intent.destinationId,
        orgId: intent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || intent.idempotencyKey,
        idempotencyKey: intent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: intent.destinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(intent.destinationId)),
            endpointExposed: false,
        },
        responseSummary: intent.error,
        error: intent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(intent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: intent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }))
    const missingIntent = buildDwmAlertWebhookMissingDeliveryIntent(plan, clean(normalizedInput.destinationId ?? normalizedInput.destination_id) || null)
    const missingAttempts = missingIntent ? [{
        destinationId: missingIntent.requestedDestinationId,
        orgId: missingIntent.orgId,
        alertId: alert.id,
        eventType: plan.eventType,
        status: 'skipped' as const,
        dryRun,
        live: false,
        replay: plan.eventType === 'dwm.alert.replayed',
        dedupeKey: alert.dedupeKey || missingIntent.idempotencyKey,
        idempotencyKey: missingIntent.idempotencyKey,
        payloadHash: null,
        sanitizedPayloadPreview: null,
        redactedDestination: {
            id: missingIntent.requestedDestinationId,
            label: null,
            type: null,
            ...deliveryAttemptRedactedEndpoint(destinationMetadataById.get(clean(missingIntent.requestedDestinationId))),
            endpointExposed: false,
        },
        responseSummary: missingIntent.error,
        error: missingIntent.error,
        retry: {
            attemptCount: (existingByIdempotencyKey.get(missingIntent.idempotencyKey)?.length || 0) + 1,
            retryable: false,
            nextRetryAt: null,
            errorClass: missingIntent.reason,
            reason: 'selection_blocked',
        },
        audit: {
            expectedAction: 'delivery.skipped',
            auditEventId: null,
        },
        timestamps: {
            createdAt: null,
            updatedAt: null,
            attemptedAt: null,
        },
    }] : []
    const attempts = [...selectedAttempts, ...skippedAttempts, ...missingAttempts]

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_contract.v1',
        ok: requiredBlockers.length === 0 && attempts.length > 0,
        ownerId,
        orgId: plan.orgId,
        eventType: plan.eventType,
        dryRun,
        liveRequested: live,
        externalSendEnabled: live && !dryRun && liveDeliveryEnabled,
        noNetwork: !(live && !dryRun && liveDeliveryEnabled),
        normalizedInput,
        payloadContract,
        requiredFields,
        destinationSelection: {
            selectedDestinationIds: plan.selectedDestinations.map(destination => destination.id),
            skippedDestinations: plan.skippedDestinations,
        },
        attempts,
        blockers: requiredBlockers,
    }
}

function deliveryPayloadField<Key extends string>(key: Key, paths: string[], present: boolean) {
    return { key, paths, present }
}

function buildDwmWebhookDeliveryPayloadFieldContract({
    input,
    plan,
    alert,
    watchlist,
    dryRun,
    live,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    dryRun: boolean
    live: boolean
}) {
    const inputRecord = recordOrEmpty(input)
    const inputAlert = recordOrEmpty(input.alert)
    const required = [
        deliveryPayloadField('orgId', ['orgId', 'organizationId', 'tenantId', 'alert.organizationId', 'alert.orgId', 'alert.tenantId'], Boolean(firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId))),
        deliveryPayloadField('destinationId', ['destinationId', 'destination_id', 'destinations[].id'], Boolean(clean(input.destinationId ?? input.destination_id)) || plan.selectedDestinations.length > 0),
        deliveryPayloadField('alertId', ['alertId', 'alert.id'], Boolean(firstClean(input.alertId, inputAlert.id))),
        deliveryPayloadField('watchlistId', ['watchlistItemId', 'watchlistId', 'alert.watchlist.id'], Boolean(watchlist.id || clean(input.watchlistItemId) || clean(input.watchlistId))),
        deliveryPayloadField('severity', ['alert.severity'], Boolean(firstClean(inputAlert.severity))),
        deliveryPayloadField('title', ['alert.title'], Boolean(firstClean(inputAlert.title))),
        deliveryPayloadField('sourceFamily', ['sourceFamily', 'alert.sourceFamily'], Boolean(firstClean(input.sourceFamily, inputAlert.sourceFamily))),
        deliveryPayloadField('evidence', ['alert.evidence', 'alert.evidenceCount'], alert.evidenceCount > 0 || alert.evidence.length > 0),
        deliveryPayloadField('provenance', ['alert.provenance', 'alert.provenanceSummary'], Boolean(alert.provenanceSummary)),
        deliveryPayloadField('timestamp', ['alert.eventTimestamp', 'alert.detectedAt', 'alert.createdAt', 'alert.updatedAt'], Boolean(alert.eventTimestamp)),
        deliveryPayloadField('link', ['alert.alertUrl', 'alert.casePath', 'casePath', 'caseUrl'], Boolean(alert.alertUrl || alert.casePath)),
        deliveryPayloadField('dedupeKey', ['dedupeKey', 'alert.dedupeKey'], Boolean(firstClean(input.dedupeKey, inputAlert.dedupeKey))),
    ]
    const optional = [
        deliveryPayloadField('caseId', ['caseId', 'alert.caseId'], Boolean(firstClean(inputRecord.caseId, inputAlert.caseId))),
        deliveryPayloadField('casePath', ['casePath', 'caseUrl', 'alert.casePath', 'alert.caseUrl'], Boolean(alert.casePath)),
        deliveryPayloadField('caseAction', ['caseActionId', 'caseActionPath', 'actionId', 'actionPath', 'alert.caseActionId', 'alert.caseActionPath'], Boolean(alert.caseActionId || alert.caseActionPath)),
        deliveryPayloadField('route', ['route', 'recommendedRoute', 'alert.route', 'alert.recommendedRoute'], Boolean(alert.route)),
        deliveryPayloadField('confidence', ['alert.confidence', 'alert.confidenceScore', 'alert.confidenceReason'], Boolean(firstClean(inputAlert.confidence, inputAlert.confidenceScore, inputAlert.confidenceReason))),
        deliveryPayloadField('dryRunState', ['dryRun', 'dry_run'], true),
        deliveryPayloadField('liveState', ['live'], live),
        deliveryPayloadField('replayState', ['eventType', 'event_type'], plan.eventType === 'dwm.alert.replayed'),
    ]
    const missingRequired = required.filter(field => !field.present).map(field => field.key)
    return {
        schemaVersion: 'dwm.webhook.delivery_payload_contract.v1',
        noNetworkDefault: true,
        dryRun,
        liveRequested: live,
        replay: plan.eventType === 'dwm.alert.replayed',
        eventType: plan.eventType,
        required,
        optional,
        missingRequired,
    }
}

function deliveryAttemptRedactedEndpoint(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic | undefined) {
    const publicDestination = destination as DwmWebhookDestinationPublic | undefined
    return {
        endpointHint: publicDestination?.endpointHint ? redactDeliveryEvidenceText(publicDestination.endpointHint) : null,
        endpointHash: publicDestination?.endpointHash || null,
    }
}

export function buildDwmWebhookDeliveryAttemptPersistenceProof({
    ownerId,
    input,
    destinations,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    ownerId: string
    input: DwmAlertNotificationInput
    destinations: Array<DwmWebhookDispatchDestination | DwmWebhookDestinationPublic>
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
}) {
    const contract = buildDwmWebhookDeliveryAttemptContract({
        ownerId,
        input,
        destinations,
        deliveries,
        liveDeliveryEnabled,
    })
    const auditsByDeliveryId = new Map<string, DwmWebhookAuditPublic>()
    for (const audit of auditEvents) {
        const deliveryId = clean(audit.deliveryId)
        if (deliveryId) auditsByDeliveryId.set(deliveryId, audit)
    }
    const rows = contract.attempts.map((attempt) => {
        const persisted = [...deliveries].reverse().find(delivery =>
            delivery.orgId === attempt.orgId
            && delivery.idempotencyKey === attempt.idempotencyKey
            && (delivery.destinationId === attempt.destinationId || (!delivery.destinationId && attempt.status === 'skipped'))
        ) || null
        const audit = persisted ? auditsByDeliveryId.get(persisted.id) || null : null
        const persistedPreview = persisted?.payload ? buildDwmWebhookDestinationTestPayloadPreview(persisted.payload) : null
        return {
            destinationId: attempt.destinationId,
            orgId: attempt.orgId,
            alertId: attempt.alertId,
            eventType: attempt.eventType,
            expectedStatus: attempt.status,
            persisted: Boolean(persisted),
            persistedDeliveryId: persisted?.id || null,
            persistedStatus: persisted?.status || null,
            dryRun: persisted?.dryRun ?? attempt.dryRun,
            live: persisted ? !persisted.dryRun && persisted.status !== 'skipped' : attempt.live,
            replay: attempt.replay,
            dedupeKey: attempt.dedupeKey,
            idempotencyKey: attempt.idempotencyKey,
            payloadHash: persisted?.payloadHash || attempt.payloadHash,
            redactedDestination: {
                ...attempt.redactedDestination,
                endpointHash: persisted?.endpointHash || null,
                endpointHint: persisted?.endpointHint ? redactDeliveryEvidenceText(persisted.endpointHint) : null,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: persistedPreview || attempt.sanitizedPayloadPreview,
            responseSummary: persisted?.responseBody || attempt.responseSummary,
            error: persisted?.error || attempt.error,
            retry: {
                attemptCount: persisted?.attemptCount ?? attempt.retry.attemptCount,
                retryable: persisted ? Boolean(persisted.nextRetryAt) : attempt.retry.retryable,
                nextRetryAt: persisted?.nextRetryAt || attempt.retry.nextRetryAt,
                errorClass: persisted?.errorClass || attempt.retry.errorClass,
                reason: persisted?.nextRetryAt ? 'retry_scheduled' : attempt.retry.reason,
            },
            audit: {
                expectedAction: attempt.audit.expectedAction,
                auditEventId: audit?.id || attempt.audit.auditEventId || null,
                action: audit?.action || null,
            },
            timestamps: {
                createdAt: persisted?.createdAt || attempt.timestamps.createdAt,
                updatedAt: persisted?.updatedAt || attempt.timestamps.updatedAt,
                attemptedAt: persisted?.attemptedAt || attempt.timestamps.attemptedAt,
            },
            blockers: persisted
                ? []
                : [{
                    code: 'delivery_attempt_not_persisted',
                    message: 'No persisted delivery row matched this expected destination and idempotency key.',
                    blocking: true,
                }],
        }
    })
    const missingPersisted = rows.filter(row => !row.persisted)
    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence.v1',
        ok: contract.ok && missingPersisted.length === 0,
        ownerId,
        orgId: contract.orgId,
        eventType: contract.eventType,
        dryRun: contract.dryRun,
        noNetwork: contract.noNetwork,
        externalSendEnabled: contract.externalSendEnabled,
        requiredFields: contract.requiredFields,
        destinationSelection: contract.destinationSelection,
        totals: {
            expectedAttempts: contract.attempts.length,
            persistedAttempts: rows.filter(row => row.persisted).length,
            missingAttempts: missingPersisted.length,
            retryScheduled: rows.filter(row => row.retry.nextRetryAt).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
        },
        rows,
        blockers: [
            ...contract.blockers,
            ...missingPersisted.map(row => ({
                code: 'delivery_attempt_not_persisted',
                destinationId: row.destinationId,
                idempotencyKey: row.idempotencyKey,
                message: 'Expected delivery attempt has not been persisted yet.',
                blocking: true,
            })),
        ],
    }
}

export function buildDwmWebhookDeliveryAttemptPersistenceReadModel({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: DwmWebhookDeliveryEvidenceOptions) {
    return buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        context: prepareDwmWebhookDeliveryProjectionContext({ deliveries, auditEvents, filters }),
    })
}

function buildDwmWebhookDeliveryAttemptPersistenceReadModelFromProjection({
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    context,
}: Pick<DwmWebhookDeliveryEvidenceOptions, 'auditEvents' | 'destinations' | 'filters' | 'liveDeliveryEnabled'> & {
    context: DwmWebhookDeliveryProjectionContext
}) {
    const { projection, now } = context
    const { evidence, deliveriesById } = projection
    const auditByDeliveryId = new Map(auditEvents.filter(audit => audit.deliveryId).map(audit => [audit.deliveryId, audit]))
    const destinationById = new Map(destinations.map(destination => [destination.id, destination]))
    const attemptsByIdempotencyKey = new Map<string, typeof evidence>()
    for (const item of evidence) {
        const key = clean(item.idempotencyKey)
        if (!key) continue
        const attempts = attemptsByIdempotencyKey.get(key) || []
        attempts.push(item)
        attemptsByIdempotencyKey.set(key, attempts)
    }
    const rows = evidence.map((item) => {
        const delivery = deliveriesById.get(item.deliveryId) || null
        const audit = auditByDeliveryId.get(item.deliveryId) || null
        const destination = item.destinationId ? destinationById.get(item.destinationId) || null : null
        const idempotencyKey = clean(item.idempotencyKey)
        const idempotencyAttempts = [...(idempotencyKey ? attemptsByIdempotencyKey.get(idempotencyKey) || [] : [])]
            .sort((a, b) => String(b.attemptedAt || b.createdAt).localeCompare(String(a.attemptedAt || a.createdAt)))
        const deliveredAttempt = idempotencyAttempts.find(attempt => attempt.status === 'delivered' && !attempt.dryRun) || null
        const duplicateAttemptCount = idempotencyAttempts.length > 1 ? idempotencyAttempts.length : 0
        const retryPlan = planDwmWebhookDeliveryRetry({
            status: delivery?.status || item.status,
            dryRun: delivery?.dryRun ?? item.dryRun,
            responseStatus: delivery?.responseStatus ?? item.response.httpStatus,
            error: delivery?.error || item.error,
            attemptedAt: delivery?.attemptedAt || item.attemptedAt,
            attemptCount: delivery?.attemptCount || 1,
            now,
        })
        const replayBody = delivery ? {
            orgId: delivery.orgId,
            destinationId: delivery.destinationId,
            alertId: delivery.alertId,
            watchlistItemId: delivery.watchlistId,
            watchlistId: delivery.watchlistId,
            watchlistName: delivery.watchlistName,
            dedupeKey: dedupeFromIdempotencyKey(delivery.idempotencyKey) || delivery.idempotencyKey,
            eventType: 'dwm.alert.replayed' as DwmAlertEventType,
            route: delivery.route,
            casePath: delivery.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            dryRun: true,
            live: false,
        } : null
        const retryReady = Boolean(retryPlan.nextRetryAt || item.dryRun || item.status === 'failed' || item.status === 'skipped')
        return {
            deliveryId: item.deliveryId,
            requestId: item.requestId,
            destinationId: item.destinationId,
            orgId: item.orgId,
            alertId: item.alertId,
            eventType: item.eventType,
            status: item.status,
            dryRun: item.dryRun,
            live: item.live,
            replay: item.replay,
            dedupeKey: item.dedupeKey,
            idempotencyKey: item.idempotencyKey,
            watchlistId: item.watchlistId,
            watchlistName: item.watchlistName,
            casePath: item.casePath,
            caseActionId: item.caseActionId,
            caseActionPath: item.caseActionPath,
            payloadHash: item.payloadHash,
            redactedDestination: {
                id: item.destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: item.redactedDestination.endpointHint,
                endpointHash: item.redactedDestination.endpointHash,
                endpointExposed: false,
            },
            sanitizedPayloadPreview: delivery?.payload ? buildDwmWebhookDestinationTestPayloadPreview(delivery.payload) : null,
            responseSummary: item.response.summary,
            error: item.error,
            retry: {
                attemptCount: delivery?.attemptCount || 1,
                retryable: retryReady,
                nextRetryAt: delivery?.nextRetryAt || retryPlan.nextRetryAt,
                errorClass: delivery?.errorClass || retryPlan.errorClass,
                reason: retryPlan.reason,
            },
            idempotency: {
                duplicate: duplicateAttemptCount > 0,
                duplicateAttemptCount,
                alreadyDelivered: Boolean(deliveredAttempt),
                deliveredDeliveryId: deliveredAttempt?.deliveryId || null,
                latestDeliveryId: idempotencyAttempts[0]?.deliveryId || null,
                deliveryIds: idempotencyAttempts.map(attempt => attempt.deliveryId).slice(0, 5),
            },
            replayHistory: {
                replay: item.replay,
                replayAttemptCount: idempotencyAttempts.filter(attempt => attempt.replay).length,
                dryRunAttemptCount: idempotencyAttempts.filter(attempt => attempt.dryRun).length,
                liveAttemptCount: idempotencyAttempts.filter(attempt => attempt.live).length,
                duplicateReplay: item.replay && duplicateAttemptCount > 0,
                duplicateLiveBlocked: Boolean(deliveredAttempt && item.status === 'skipped'),
            },
            audit: {
                auditEventId: item.auditEventId || audit?.id || null,
                action: item.auditAction || audit?.action || null,
            },
            timestamps: {
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                attemptedAt: item.attemptedAt,
            },
            actionRequests: {
                deliveryHistory: {
                    route: 'GET /api/dwm/webhook-deliveries',
                    query: {
                        orgId: item.orgId,
                        destinationId: item.destinationId,
                        alertId: item.alertId,
                        watchlistId: item.watchlistId,
                        casePath: item.casePath,
                        caseActionId: item.caseActionId,
                        caseActionPath: item.caseActionPath,
                        dedupeKey: item.dedupeKey,
                        deliveryId: item.deliveryId,
                    },
                },
                dryRunReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: retryReady,
                    noNetwork: true,
                    body: replayBody,
                    expectedStatus: 'dry_run',
                    expectedAuditAction: 'delivery.replayed',
                },
                liveReplay: {
                    route: 'POST /api/dwm/webhook-deliveries',
                    canSend: liveDeliveryEnabled && retryReady,
                    noNetwork: !liveDeliveryEnabled,
                    body: replayBody ? { ...replayBody, dryRun: false, live: true } : null,
                    blockers: liveDeliveryEnabled ? [] : [{
                        code: 'live_delivery_disabled',
                        message: 'Live webhook delivery is disabled for this environment.',
                        blocking: true,
                    }],
                },
            },
            operationLinks: delivery ? buildDwmWebhookDeliveryOperationLinks(delivery) : null,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_attempt_persistence_read.v1',
        noNetwork: true,
        externalSendEnabled: liveDeliveryEnabled,
        filters,
        total: rows.length,
        counts: {
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            replay: rows.filter(row => row.replay).length,
            retryable: rows.filter(row => row.retry.retryable).length,
            auditLinked: rows.filter(row => row.audit.auditEventId).length,
            duplicateIdempotencyKeys: rows.filter(row => row.idempotency.duplicate).length,
            duplicateReplayRows: rows.filter(row => row.replayHistory.duplicateReplay).length,
        },
        rows,
        blockers: rows.length
            ? []
            : [{
                code: 'no_delivery_attempts',
                message: 'No persisted webhook delivery attempts matched the current filters.',
                blocking: false,
            }],
    }
}

export function buildDwmWebhookDeliveryReplayApiContract({
    deliveries,
    auditEvents = [],
    destinations = [],
    filters = {},
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
    visibility = null,
}: DwmWebhookDeliveryEvidenceAccessOptions) {
    const readModel = buildDwmWebhookDeliveryAttemptPersistenceReadModel({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
    })
    const replayGuard = buildDwmWebhookDeliveryReplayGuard({
        deliveries,
        auditEvents,
        destinations,
        filters,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
        visibility,
    })
    return buildDwmWebhookDeliveryReplayApiProjection(readModel, replayGuard, liveDeliveryEnabled)
}

function toDwmWebhookDispatchDestinationForContract(destination: DwmWebhookDispatchDestination | DwmWebhookDestinationPublic): DwmWebhookDispatchDestination {
    const dispatchDestination = destination as DwmWebhookDispatchDestination
    const publicDestination = destination as DwmWebhookDestinationPublic
    return {
        id: destination.id,
        org_id: clean(dispatchDestination.org_id) || clean(publicDestination.orgId) || '',
        name: destination.name,
        kind: destination.kind,
        status: destination.status,
        events: Array.isArray(destination.events) ? destination.events : [],
    }
}

function deliveryAttemptContractBlockers({
    input,
    plan,
    alert,
    watchlist,
}: {
    input: DwmAlertNotificationInput
    plan: DwmAlertWebhookDispatchPlan
    alert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
}) {
    const blockers: Array<{ code: string; path: string; message: string; blocking: true }> = []
    const add = (code: string, path: string, message: string) => blockers.push({ code, path, message, blocking: true })
    const inputAlert = recordOrEmpty(input.alert)
    if (!firstClean(input.orgId, input.organizationId, input.tenantId, inputAlert.organizationId, inputAlert.orgId, inputAlert.tenantId)) add('missing_org_id', 'orgId', 'Webhook delivery requires organization scope.')
    if (!firstClean(input.alertId, inputAlert.id)) add('missing_alert_id', 'alert.id', 'Webhook delivery requires a persisted alert id.')
    if (!firstClean(inputAlert.title)) add('missing_alert_title', 'alert.title', 'Webhook delivery requires an alert title for Discord rendering.')
    if (!firstClean(inputAlert.severity)) add('missing_severity', 'alert.severity', 'Webhook delivery requires alert severity.')
    if (!firstClean(input.sourceFamily, inputAlert.sourceFamily)) add('missing_source_family', 'alert.sourceFamily', 'Webhook delivery requires source family context.')
    if (!watchlist.id && !firstClean(input.watchlistItemId, input.watchlistId)) add('missing_watchlist_id', 'alert.watchlist.id', 'Webhook delivery requires watchlist identity.')
    if (!firstClean(input.dedupeKey, inputAlert.dedupeKey)) add('missing_dedupe_key', 'alert.dedupeKey', 'Webhook delivery requires a dedupe key for idempotency.')
    if (alert.evidenceCount <= 0 && alert.evidence.length === 0) add('missing_evidence', 'alert.evidence', 'Webhook delivery requires at least one evidence item or evidence count.')
    if (!alert.provenanceSummary) add('missing_provenance', 'alert.provenance', 'Webhook delivery requires source provenance context.')
    if (!alert.eventTimestamp) add('missing_timestamp', 'alert.eventTimestamp', 'Webhook delivery requires an alert event timestamp.')
    if (!alert.alertUrl && !alert.casePath) add('missing_alert_link', 'alert.alertUrl', 'Webhook delivery requires an alert or case link.')
    for (const destination of plan.selectedDestinations) {
        if (!WEBHOOK_KINDS.has(destination.kind)) {
            add('unsupported_destination_type', `destinations.${destination.id}.kind`, 'Webhook delivery only supports discord and webhook destinations.')
        }
    }
    if (!plan.selectedDestinations.length && !plan.skippedDestinations.some(destination => destination.reason !== 'org_mismatch')) {
        add('missing_destination', 'destinations', 'Webhook delivery requires an org-scoped destination or a persistable missing-destination attempt.')
    }
    return blockers
}

export async function triggerDwmAlertWebhookNotification(
    ownerId: string,
    alert: Record<string, unknown>,
    options: DwmAlertWebhookTriggerOptions = {}
) {
    return deliverDwmAlertNotification(ownerId, buildDwmAlertWebhookNotificationInput(alert, options))
}

async function deliverToDwmWebhookDestinationWithLineageGuard(input: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    live: boolean
    markTested: boolean
    sender?: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
}) {
    const normalizedAlert = normalizeAlert(input.alert)
    const idempotencyKey = buildIdempotencyKey(
        input.eventType,
        input.destination.org_id,
        input.destination.id,
        normalizedAlert.dedupeKey || normalizedAlert.id
    )
    return withDatabaseAdvisoryLock(`dwm-webhook-delivery:${idempotencyKey}`, async () => {
        const delivered = input.live && !input.dryRun
            ? await findDeliveredDwmWebhookDelivery(input.destination.org_id, input.destination.id, idempotencyKey)
            : null
        if (delivered) {
            return recordSkippedDuplicateDwmWebhookDelivery({
                ownerId: input.ownerId,
                destination: input.destination,
                eventType: input.eventType,
                alert: input.alert,
                priorDelivery: delivered,
            })
        }
        return deliverToDwmWebhookDestination(input)
    })
}

async function deliverToDwmWebhookDestination({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    live,
    markTested,
    sender = postPublicWebhook,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    live: boolean
    markTested: boolean
    sender?: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination, alert, eventType, deliveryId })
    const { alert: normalizedAlert, watchlist } = '_hanasand' in payload ? payload._hanasand : payload
    const payloadBody = canonicalJson(payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    const liveRequested = live && !dryRun && process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true'
    let status: DwmWebhookDeliveryRow['status'] = dryRun ? 'dry_run' : 'skipped'
    let responseStatus: number | null = null
    let responseBody: string | null = null
    let error: string | null = null
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const liveAttemptCount = await countDwmWebhookDeliveryAttempts(destination.org_id, destination.id, idempotencyKey)
    const shouldSendLive = liveRequested && liveAttemptCount < MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS
    const attemptedAt = shouldSendLive ? new Date().toISOString() : null
    let completedAt: string | null = null
    const attemptCount = liveAttemptCount + (shouldSendLive ? 1 : 0)

    if (!dryRun && live && process.env.DWM_WEBHOOK_LIVE_DELIVERY !== 'true') {
        error = 'Live DWM webhook delivery is disabled. Set DWM_WEBHOOK_LIVE_DELIVERY=true and send live=true to enable external calls.'
    } else if (liveRequested && !shouldSendLive) {
        error = `Delivery attempt limit reached for this report (${MAX_DWM_WEBHOOK_DELIVERY_ATTEMPTS} attempts).`
    }

    if (shouldSendLive) {
        try {
            const sendResult = await sendDwmWebhookPayload(destination, payloadBody, sender)
            status = sendResult.status
            responseStatus = sendResult.responseStatus
            responseBody = sendResult.responseBody
            error = sendResult.error
        } finally {
            completedAt = new Date().toISOString()
        }
    }
    const deliveredAt = status === 'delivered' ? completedAt : null

    const delivery = await withTransaction(async query => {
        const result = await query(DWM_WEBHOOK_DELIVERY_INSERT, [
            deliveryId,
            destination.id,
            ownerId,
            destination.org_id,
            normalizedAlert.id,
            eventType,
            status,
            dryRun,
            destination.endpoint_hint,
            destination.endpoint_hash,
            payloadHash,
            payloadBody,
            responseStatus,
            responseBody,
            error,
            classifyDeliveryError({ status, dryRun, responseStatus, error }),
            attemptCount,
            planDwmWebhookDeliveryRetry({ status, dryRun, responseStatus, error, attemptCount }).nextRetryAt,
            idempotencyKey,
            watchlist.id,
            watchlist.name,
            normalizedAlert.route,
            normalizedAlert.casePath,
            attemptedAt,
            completedAt,
            deliveredAt,
        ])
        const persisted = result.rows[0] as DwmWebhookDeliveryRow
        const receiptBound = await bindDwmWebhookReceiverReceipt(persisted, query)
        if (status === 'delivered'
            && controlledReceiverEndpointHashes().includes(persisted.endpoint_hash)
            && !receiptBound) {
            throw new Error('Controlled receiver accepted delivery without an exact durable receipt.')
        }
        return persisted
    })

    if (status === 'delivered' || status === 'dry_run' || markTested) {
        await run(`
            UPDATE dwm_webhook_destinations
               SET last_tested_at = CASE WHEN $2 THEN NOW() ELSE last_tested_at END,
                   last_test_status = CASE WHEN $2 THEN $3 ELSE last_test_status END,
                   last_test_error = CASE WHEN $2 THEN $4 ELSE last_test_error END,
                   last_test_http_status = CASE WHEN $2 THEN $5 ELSE last_test_http_status END,
                   last_delivery_at = CASE WHEN $6 THEN $7::timestamptz ELSE last_delivery_at END,
                   updated_at = NOW()
             WHERE id = $1
        `, [destination.id, markTested, status, error, responseStatus, status === 'delivered', deliveredAt])
    }

    const auditAction = markTested
        ? 'delivery.tested'
        : delivery.status === 'failed'
            ? delivery.next_retry_at ? 'delivery.retry_scheduled' : 'delivery.failed'
            : delivery.status === 'skipped'
                ? 'delivery.skipped'
                : deliveryAuditActionForEvent(delivery.event_type)
    const auditEventId = await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: destination.id,
        deliveryId: delivery.id,
        action: auditAction,
        metadata: {
            ...dwmWebhookDeliveryAuditMetadata(delivery, alert, {
                responseStatus: delivery.response_status,
            }),
        },
    })

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction,
        auditActorId: ownerId,
    }
}

async function sendDwmWebhookPayload(
    destination: DwmWebhookDestinationRow,
    payloadBody: string,
    sender: (endpoint: string, body: string, signingSecret?: string) => Promise<{ status: number, body: string }>
): Promise<{
    status: 'delivered' | 'failed'
    responseStatus: number | null
    responseBody: string | null
    error: string | null
}> {
    try {
        const target = decryptWebhookTarget(destination.endpoint_encrypted)
        const response = await sender(target.endpoint, payloadBody, target.signingSecret)
        const status = response.status >= 200 && response.status < 300 ? 'delivered' : 'failed'
        return {
            status,
            responseStatus: response.status,
            responseBody: sanitizeDwmWebhookDeliveryDiagnostic(response.body),
            error: status === 'delivered' ? null : sanitizeDwmWebhookDeliveryDiagnostic(`Webhook returned HTTP ${response.status}.`),
        }
    } catch (sendError) {
        return {
            status: 'failed' as const,
            responseStatus: null,
            responseBody: null,
            error: sanitizeDwmWebhookDeliveryDiagnostic(sendError instanceof Error ? sendError.message : String(sendError)),
        }
    }
}

async function recordSkippedDuplicateDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    priorDelivery,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    priorDelivery: DwmWebhookDeliveryRow
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        payloadDestination: destination,
        endpointHint: destination.endpoint_hint,
        endpointHash: destination.endpoint_hash,
        eventType,
        alert,
        dryRun: false,
        error: 'Delivery skipped because this destination already has a delivered attempt for the same idempotency key.',
        reason: 'duplicate_delivered_idempotency_key',
        additionalAuditMetadata: {
            priorDeliveryId: priorDelivery.id,
            priorDeliveredAt: priorDelivery.delivered_at,
        },
    })
}

async function recordSkippedSelectionDwmWebhookDelivery({
    ownerId,
    destination,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    destination: DwmWebhookDestinationRow
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookSkippedDeliveryIntent
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: destination.org_id,
        destinationId: destination.id,
        payloadDestination: destination,
        endpointHint: destination.endpoint_hint,
        endpointHash: destination.endpoint_hash,
        eventType,
        alert,
        dryRun,
        idempotencyKey: intent.idempotencyKey,
        error: intent.error,
        reason: intent.reason,
    })
}

async function recordMissingDestinationDwmWebhookDelivery({
    ownerId,
    eventType,
    alert,
    dryRun,
    intent,
}: {
    ownerId: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    intent: DwmAlertWebhookMissingDeliveryIntent
}) {
    return recordSkippedDwmWebhookDelivery({
        ownerId,
        orgId: intent.orgId,
        destinationId: null,
        payloadDestination: {
            id: intent.requestedDestinationId || 'missing_destination',
            kind: 'webhook',
            name: 'Missing webhook destination',
            org_id: intent.orgId,
        },
        endpointHint: intent.requestedDestinationId ? 'requested_destination_not_found' : 'no_webhook_destination',
        endpointHash: intent.requestedDestinationId ? hashWebhookValue('endpoint', intent.requestedDestinationId) : 'no_webhook_destination',
        eventType,
        alert,
        dryRun,
        idempotencyKey: intent.idempotencyKey,
        error: intent.error,
        reason: intent.reason,
        additionalAuditMetadata: {
            requestedDestinationId: intent.requestedDestinationId,
        },
    })
}

async function recordSkippedDwmWebhookDelivery({
    ownerId,
    orgId,
    destinationId,
    payloadDestination,
    endpointHint,
    endpointHash,
    eventType,
    alert,
    dryRun,
    idempotencyKey,
    error,
    reason,
    additionalAuditMetadata = {},
}: {
    ownerId: string
    orgId: string
    destinationId: string | null
    payloadDestination: Pick<DwmWebhookDispatchDestination, 'id' | 'kind' | 'name' | 'org_id'>
    endpointHint: string
    endpointHash: string
    eventType: DwmAlertEventType
    alert: Record<string, unknown>
    dryRun: boolean
    idempotencyKey?: string
    error: string
    reason: string
    additionalAuditMetadata?: Record<string, unknown>
}) {
    const deliveryId = crypto.randomUUID()
    const payload = buildDwmAlertDeliveryPayload({ destination: payloadDestination, alert, eventType, deliveryId })
    const { alert: normalizedAlert, watchlist } = '_hanasand' in payload ? payload._hanasand : payload
    const resolvedIdempotencyKey = idempotencyKey || buildIdempotencyKey(
        eventType,
        orgId,
        destinationId || 'missing_destination',
        normalizedAlert.dedupeKey || normalizedAlert.id,
    )
    const payloadBody = JSON.stringify(payload)
    const payloadHash = hashWebhookValue('payload', payloadBody)
    const attemptCount = await countDwmWebhookDeliveryAttempts(orgId, destinationId, resolvedIdempotencyKey)
    const errorClass = classifyDeliveryError({ status: 'skipped', dryRun, error })
    const result = await run(`
        INSERT INTO dwm_webhook_deliveries (
            id,
            destination_id,
            owner_id,
            org_id,
            alert_id,
            event_type,
            status,
            dry_run,
            endpoint_hint,
            endpoint_hash,
            payload_hash,
            payload,
            response_status,
            response_body,
            error,
            error_class,
            attempt_count,
            next_retry_at,
            idempotency_key,
            watchlist_id,
            watchlist_name,
            route,
            case_path,
            attempted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7, $8, $9, $10, $11::JSONB, NULL, NULL, $12, $13, $14, NULL, $15, $16, $17, $18, $19, NULL)
        RETURNING *
    `, [
        deliveryId,
        destinationId,
        ownerId,
        orgId,
        normalizedAlert.id,
        eventType,
        dryRun,
        endpointHint,
        endpointHash,
        payloadHash,
        payloadBody,
        error,
        errorClass,
        attemptCount,
        resolvedIdempotencyKey,
        watchlist.id,
        watchlist.name,
        normalizedAlert.route,
        normalizedAlert.casePath,
    ])

    const delivery = result.rows[0] as DwmWebhookDeliveryRow
    const auditEventId = await recordDwmWebhookAudit({
        ownerId,
        actorId: ownerId,
        orgId: delivery.org_id,
        destinationId: delivery.destination_id,
        deliveryId: delivery.id,
        action: 'delivery.skipped',
        metadata: {
            ...dwmWebhookDeliveryAuditMetadata(delivery, alert, {
                reason,
                ...additionalAuditMetadata,
            }),
        },
    })

    return {
        ...toDwmWebhookDelivery(delivery),
        auditEventId,
        auditAction: 'delivery.skipped',
        auditActorId: ownerId,
    }
}

function dwmWebhookDeliveryAuditMetadata(
    delivery: DwmWebhookDeliveryRow,
    alert: Record<string, unknown>,
    additional: Record<string, unknown> = {},
) {
    return {
        alertId: delivery.alert_id,
        eventType: delivery.event_type,
        status: delivery.status,
        endpointHint: delivery.endpoint_hint,
        endpointHash: delivery.endpoint_hash,
        payloadHash: delivery.payload_hash,
        dryRun: delivery.dry_run,
        error: delivery.error,
        errorClass: delivery.error_class,
        attemptCount: delivery.attempt_count,
        nextRetryAt: delivery.next_retry_at,
        idempotencyKey: delivery.idempotency_key,
        watchlistId: delivery.watchlist_id,
        route: delivery.route,
        casePath: delivery.case_path,
        ...additional,
        ...outboundReportAuditMetadata(alert),
    }
}

async function findDeliveredDwmWebhookDelivery(
    orgId: string,
    destinationId: string,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND destination_id = $2
          AND idempotency_key = $3
          AND status = 'delivered'
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
        ORDER BY attempted_at DESC
        LIMIT 1
    `, [orgId, destinationId, idempotencyKey])

    return (result.rows as DwmWebhookDeliveryRow[])[0] || null
}

async function loadLatestDwmWebhookDeliveryAttempt(
    orgId: string,
    destinationId: string,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT *
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND destination_id = $2
          AND idempotency_key = $3
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
          AND status IN ('delivered', 'failed')
        ORDER BY attempted_at DESC, created_at DESC
        LIMIT 1
    `, [orgId, destinationId, idempotencyKey])

    return (result.rows as DwmWebhookDeliveryRow[])[0] || null
}

async function countDwmWebhookDeliveryAttempts(
    orgId: string,
    destinationId: string | null,
    idempotencyKey: string
) {
    const result = await run(`
        SELECT COUNT(*)::INT AS count
        FROM dwm_webhook_deliveries
        WHERE org_id = $1
          AND (($2::TEXT IS NULL AND destination_id IS NULL) OR destination_id = $2)
          AND idempotency_key = $3
          AND dry_run = FALSE
          AND attempted_at IS NOT NULL
          AND status IN ('delivered', 'failed')
    `, [orgId, destinationId, idempotencyKey])

    return Number(result.rows[0]?.count ?? 0)
}

function destinationReadinessBlockers({
    destination,
    latestAttempt,
    liveDeliveryEnabled,
}: {
    destination: ReturnType<typeof buildDwmWebhookDestinationContracts>[number]
    latestAttempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number] | null
    liveDeliveryEnabled: boolean
}) {
    const blockers = []
    if (!destination.enabled) blockers.push('destination_disabled')
    if (!destination.lastTest.requestId) blockers.push('test_delivery_missing')
    if (!isLiveDeliveredProof(destination.lastTest)) blockers.push('test_delivery_unverified')
    if (destination.lastTest.status === 'failed') blockers.push('test_delivery_failed')
    if (!liveDeliveryEnabled) blockers.push('live_delivery_disabled')
    if (latestAttempt?.retryable) blockers.push('retry_scheduled')
    if (latestAttempt?.status === 'failed' && !latestAttempt.retryable) blockers.push('last_delivery_failed')
    if (latestAttempt?.status === 'skipped' && latestAttempt.errorClass !== 'live_delivery_disabled') blockers.push('last_delivery_skipped')
    return [...new Set(blockers)]
}

function destinationHealthAttempt(
    attempt: ReturnType<typeof buildDwmWebhookDeliveryLedger>[number],
    auditEventId: string | null
) {
    return {
        requestId: attempt.requestId,
        deliveryId: attempt.deliveryId,
        alertId: attempt.alertId,
        eventType: attempt.eventType,
        status: attempt.status,
        rawStatus: attempt.rawStatus,
        dryRun: attempt.dryRun,
        live: attempt.live,
        liveRequested: attempt.liveRequested,
        replay: attempt.replay,
        idempotencyKey: attempt.idempotencyKey,
        dedupeKey: attempt.dedupeKey,
        route: attempt.route,
        casePath: attempt.casePath,
        responseStatus: attempt.responseStatus,
        responseSummary: attempt.responseSummary,
        error: attempt.error,
        errorClass: attempt.errorClass,
        retryable: attempt.retryable,
        nextRetryAt: attempt.nextRetryAt,
        retryReason: attempt.retryReason,
        attemptCount: attempt.attemptCount,
        payloadHash: attempt.payloadHash,
        auditEventId: attempt.auditEventId || auditEventId,
        auditAction: attempt.auditAction,
        attemptedAt: attempt.attemptedAt,
        createdAt: attempt.createdAt,
    }
}

function hasTerminalDeliveryFailure(attempt: ReturnType<typeof destinationHealthAttempt> | null | undefined) {
    return Boolean(attempt && !attempt.retryable && attempt.errorClass !== 'live_delivery_disabled')
}

function auditEventIdForDelivery(
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>,
    deliveryId?: string | null
) {
    if (!deliveryId) return null
    return audits.find(audit => audit.deliveryId === deliveryId)?.auditEventId || null
}

function lifecycleEvent(
    audit: ReturnType<typeof buildDwmWebhookAuditEventContracts>[number] | null,
    includeActor: boolean
) {
    if (!audit) return null
    return {
        auditEventId: audit.auditEventId,
        action: audit.action,
        outcome: audit.outcome,
        severity: audit.severity,
        actorId: includeActor ? audit.actorId : null,
        requestId: audit.requestId,
        createdAt: audit.createdAt,
    }
}

function destinationLifecycleState({
    destination,
    health,
    audits,
    canManage,
}: {
    destination: DwmWebhookDestinationPublic | null
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>
    canManage: boolean
}) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const latestSecretAudit = audits.find((audit) => {
        if (audit.action !== 'destination.updated') return false
        const metadata = recordOrEmpty(audit.metadata)
        return Boolean(clean(metadata.endpointHash) || clean(metadata.endpointHint) || clean(metadata.endpointUrl) || clean(metadata.webhookUrl))
    }) || null
    const latestSecretUpdateAt = latestSecretAudit?.createdAt || null
    const lastTestAt = health.lastTest.at || null
    const secretRotated = Boolean(
        latestSecretUpdateAt
        && (!lastTestAt || String(latestSecretUpdateAt).localeCompare(String(lastTestAt)) > 0)
    )
    const revokedOwner = Boolean(destination?.createdBy && destination?.ownerId && destination.createdBy !== destination.ownerId)
    const failed = health.lastTest.status === 'failed' || hasTerminalDeliveryFailure(health.lastFailure)
    const verified = isLiveDeliveredProof(health.lastTest)
    const liveVerified = verified
    const liveDeliveryUnverified = health.enabled && endpointPresent && !liveVerified
    const testRequired = health.enabled && endpointPresent && (!verified || secretRotated)
    const states = [
        health.enabled ? null : 'disabled',
        failed ? 'failed' : null,
        revokedOwner ? 'revoked_owner' : null,
        secretRotated ? 'secret_rotated' : null,
        testRequired ? 'test_required' : null,
        liveDeliveryUnverified ? 'live_delivery_unverified' : null,
        health.enabled && endpointPresent && liveVerified && !failed && !revokedOwner && !secretRotated ? 'active' : null,
    ].filter(Boolean) as string[]
    const primary = states[0] || (health.enabled ? 'test_required' : 'disabled')
    const blockers = [
        !health.enabled ? lifecycleStateBlocker('disabled', 'Destination is disabled and will not receive alert deliveries.', health.destinationId, true) : null,
        failed ? lifecycleStateBlocker('failed', 'Latest destination test or delivery failed and needs remediation before live use.', health.destinationId, true) : null,
        revokedOwner ? lifecycleStateBlocker('revoked_owner', 'Destination was created by a user who no longer owns this destination record.', health.destinationId, true) : null,
        secretRotated ? lifecycleStateBlocker('secret_rotated', 'Webhook URL or secret reference changed after the last verified dry-run test.', health.destinationId, false) : null,
        testRequired ? lifecycleStateBlocker('test_required', 'Run a no-network dry-run test before relying on this destination.', health.destinationId, false) : null,
        liveDeliveryUnverified ? lifecycleStateBlocker('live_delivery_unverified', 'A successful live delivery has not been recorded for this destination.', health.destinationId, false) : null,
    ].filter(Boolean) as ReturnType<typeof lifecycleStateBlocker>[]

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_state.v1',
        primary,
        states: [...new Set(states)],
        active: states.includes('active'),
        disabled: states.includes('disabled'),
        failed: states.includes('failed'),
        revokedOwner: states.includes('revoked_owner'),
        secretRotated: states.includes('secret_rotated'),
        testRequired: states.includes('test_required'),
        liveDeliveryUnverified: states.includes('live_delivery_unverified'),
        liveVerified,
        verified,
        secretState: endpointPresent ? 'redacted' : 'missing',
        ownerState: revokedOwner ? 'revoked_owner' : 'current',
        owner: {
            ownerId: canManage ? destination?.ownerId || null : null,
            createdBy: canManage ? destination?.createdBy || null : null,
            actorExposed: canManage,
        },
        rotation: {
            rotatedAt: latestSecretUpdateAt,
            auditEventId: latestSecretAudit?.auditEventId || null,
            lastVerifiedTestAt: lastTestAt,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers,
        requiredActions: lifecycleStateActions({ destinationId: health.destinationId, blockers }),
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
    }
}

function lifecycleStateBlocker(
    code: 'disabled' | 'failed' | 'revoked_owner' | 'secret_rotated' | 'test_required' | 'live_delivery_unverified',
    message: string,
    destinationId: string | null,
    blocking = false
) {
    return { code, message, destinationId, blocking }
}

function lifecycleStateActions({
    destinationId,
    blockers,
}: {
    destinationId: string
    blockers: ReturnType<typeof lifecycleStateBlocker>[]
}) {
    const codes = new Set(blockers.map(blocker => blocker.code))
    return {
        dryRunTest: codes.has('test_required') || codes.has('secret_rotated') || codes.has('failed')
            ? {
                route: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
                method: 'POST',
                body: { dryRun: true, live: false },
                noNetworkDefault: true,
            }
            : null,
        updateDestination: codes.has('failed') || codes.has('revoked_owner')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                noNetworkDefault: true,
            }
            : null,
        enableDestination: codes.has('disabled')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                body: { status: 'active' },
                noNetworkDefault: true,
            }
            : null,
    }
}

function destinationLifecycleReadinessReceipt({
    health,
    lifecycleState,
    canManage,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    lifecycleState: ReturnType<typeof destinationLifecycleState>
    canManage: boolean
}) {
    const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
    const blockingCodes = lifecycleState.blockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const nextAction = lifecycleState.requiredActions.dryRunTest
        ? 'dry_run_test'
        : lifecycleState.requiredActions.enableDestination
            ? 'enable_destination'
            : lifecycleState.requiredActions.updateDestination
                ? 'review_destination'
                : health.retry.retryable
                    ? 'retry_delivery'
                    : lifecycleState.liveDeliveryUnverified
                        ? 'deliver_live_alert'
                        : health.ready
                            ? 'ready'
                            : 'inspect_destination'
    const nextDeliveryState = !health.enabled
        ? 'disabled'
        : terminalFailure
            ? 'terminal_failure'
            : health.retry.retryable
                ? 'retry_scheduled'
                : lifecycleState.testRequired
                    ? 'test_required'
                    : lifecycleState.liveDeliveryUnverified
                        ? 'live_delivery_unverified'
                        : health.ready
                            ? 'ready'
                            : 'blocked'

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_readiness_receipt.v1',
        orgId: health.orgId,
        destinationId: health.destinationId,
        status: {
            lifecycle: lifecycleState.primary,
            health: health.health,
            nextDeliveryState,
            readyForDryRun: health.enabled && lifecycleState.secretState === 'redacted',
            readyForLive: lifecycleState.liveVerified && health.liveDeliveryEnabled && blockingCodes.length === 0,
            liveDeliveryEnabled: health.liveDeliveryEnabled,
        },
        nextAction,
        routes: {
            test: lifecycleState.requiredActions.dryRunTest?.route || `POST /api/dwm/webhook-destinations/${health.destinationId}/test`,
            update: lifecycleState.requiredActions.updateDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            enable: lifecycleState.requiredActions.enableDestination?.route || `PATCH /api/dwm/webhook-destinations/${health.destinationId}`,
            history: `/api/dwm/webhook-deliveries?orgId=${encodeURIComponent(health.orgId)}&destinationId=${encodeURIComponent(health.destinationId)}`,
        },
        actionBodyPreview: {
            dryRunTest: lifecycleState.requiredActions.dryRunTest?.body || null,
            enableDestination: lifecycleState.requiredActions.enableDestination?.body || null,
            updateDestination: lifecycleState.requiredActions.updateDestination ? { destinationId: health.destinationId } : null,
        },
        deliveryProof: {
            requestId: health.latestAttempt?.requestId || null,
            deliveryId: health.latestAttempt?.deliveryId || null,
            alertId: health.latestAttempt?.alertId || null,
            casePath: health.latestAttempt?.casePath || null,
            dedupeKey: health.latestAttempt?.dedupeKey || null,
            idempotencyKey: health.latestAttempt?.idempotencyKey || null,
            replay: health.latestAttempt?.replay ?? null,
            status: health.latestAttempt?.status || null,
            responseStatus: health.latestAttempt?.responseStatus || null,
            errorClass: health.latestAttempt?.errorClass || health.retry.errorClass || null,
            auditEventId: health.latestAttempt?.auditEventId || health.latestAuditEventId || null,
            attemptedAt: health.latestAttempt?.attemptedAt || null,
        },
        retry: {
            retryable: health.retry.retryable,
            nextRetryAt: health.retry.nextRetryAt,
            attemptCount: health.retry.attemptCount,
            lastErrorCategory: health.retry.errorClass,
            terminalFailure,
        },
        organizationLifecycleSettingsConsumer: {
            schemaVersion: 'dwm.webhook.organization_lifecycle_settings_consumer.v1',
            consumesSchemaVersion: 'organization.lifecycle_settings_mutation_receipt.v1',
            route: `PUT /api/organizations/${encodeURIComponent(health.orgId)}/settings`,
            readRoute: `GET /api/organizations/${encodeURIComponent(health.orgId)}/alert-readiness`,
            noNetwork: true,
            organizationId: health.orgId,
            destinationId: health.destinationId,
            expectedLifecycleStatuses: ['active', 'archived', 'deleted'],
            expectedDownstreamFields: [
                'settingsMutationReceipt.downstreamReadiness.webhookDeliveryReady',
                'settingsMutationReceipt.destinationReadiness.deliveryBlockedByLifecycle',
                'settingsMutationReceipt.destinationReadiness.nonmemberDestinationEnumeration',
                'settingsMutationReceipt.noLeakFields',
            ],
            deliveryBlockers: {
                archived: 'org_archived',
                deleted: 'org_deleted',
                active: null,
            },
            destinationReadiness: {
                deliveryBlockedByLifecycle: false,
                nonmemberDestinationEnumeration: false,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
            mutationPreview: {
                archive: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'archived' },
                    expectedWebhookDeliveryReady: false,
                    expectedBlocker: 'org_archived',
                },
                reactivate: {
                    method: 'PUT',
                    body: { lifecycleStatus: 'active' },
                    expectedWebhookDeliveryReady: true,
                    expectedBlocker: null,
                },
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        audit: {
            latestAuditEventId: health.latestAuditEventId,
            auditEventIds: canManage ? health.auditEventIds : [],
            auditEventCount: health.auditEventIds.length,
            actorExposed: canManage,
        },
        redactedDestination: {
            label: health.label,
            type: health.type,
            endpointHint: health.redactedEndpoint.endpointHint,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers: lifecycleState.blockers,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
        noNetwork: true,
    }
}

const retryQueueBlocker = makeWebhookBlocker
const auditTrailBlocker = makeWebhookBlocker
const testContractBlocker = makeWebhookBlocker
const destinationMatrixBlocker = makeWebhookBlocker
const alertReadinessBlocker = makeWebhookBlocker
const orgAlertOutcomeBlocker = makeWebhookBlocker
const alertDeliveryProofBlocker = makeWebhookBlocker

function operationBlocker(
    code: DwmWebhookDeliveryOperationBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable })
}

function deliveryProvenanceIds(value: unknown) {
    const record = recordOrEmpty(value)
    return {
        captureIds: cleanList(record.captureIds).slice(0, 5),
        sourceIds: cleanList(record.sourceIds).slice(0, 5),
        primaryCaptureId: clean(record.primaryCaptureId) || null,
    }
}

function deliveryReceiptContext(entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]) {
    return {
        org: { id: entry.orgId },
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
        },
        watchlist: {
            id: entry.watchlist.id,
            term: entry.watchlist.terms[0] || entry.watchlist.name || null,
            name: entry.watchlist.name,
        },
        provenance: {
            ...entry.alert.provenanceIds,
            summary: entry.alert.provenanceSummary || null,
        },
    }
}

function buildDwmWebhookDeliveryTransitionReceipt({
    entry,
    retryKey,
    blockers,
    access,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryKey: ReturnType<typeof buildDwmWebhookDeliveryRetryPersistence>['deliveryKeys'][number] | null
    blockers: ReturnType<typeof retryQueueBlocker>[]
    access: { canRetry: boolean }
    liveDeliveryEnabled: boolean
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const canDryRunRetry = access.canRetry && entry.retry.retryable && blockingCodes.length === 0
    const canLiveRetry = canDryRunRetry && liveDeliveryEnabled
    const dedupeKey = retryKey?.dedupe.latestDedupeKey || entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const retryBody = {
        orgId: entry.orgId,
        organizationId: entry.orgId,
        destinationId: entry.destinationId,
        eventType: entry.eventType,
        alertId: entry.alert.id,
        dedupeKey,
        route: entry.route,
        casePath: entry.alert.casePath,
        caseId: entry.alert.caseId,
        watchlistItemId: entry.watchlist.id,
        watchlistId: entry.watchlist.id,
        watchlistName: entry.watchlist.name,
        alert: {
            id: entry.alert.id,
            title: entry.alert.title,
            severity: entry.alert.severity,
            sourceFamily: entry.alert.sourceFamily,
            evidenceCount: entry.alert.evidenceCount,
            dedupeKey,
            casePath: entry.alert.casePath,
            caseId: entry.alert.caseId,
            alertUrl: entry.alert.alertUrl,
            provenanceSummary: entry.alert.provenanceSummary,
            watchlist: {
                id: entry.watchlist.id,
                name: entry.watchlist.name,
                terms: entry.watchlist.terms,
            },
            delivery: {
                route: entry.route,
                replay: entry.replay,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
        },
    }
    const caseActionDryRunReceipt = buildDwmWebhookCaseActionDryRunReceipt({
        entry,
        retryBody,
        blockers: uniqueBlockers,
        canDryRunRetry,
        liveDeliveryEnabled,
    })
    const nextState = blockingCodes.includes('destination_unavailable')
        ? 'destination_unavailable'
        : blockingCodes.includes('destination_disabled')
            ? 'destination_disabled'
            : entry.dedupe.alreadyDelivered
                ? 'already_delivered'
                : entry.retry.terminalFailure
                    ? 'terminal_failure'
                    : canDryRunRetry
                        ? 'dry_run_retry_ready'
                        : entry.dryRun && entry.status !== 'failed'
                            ? 'dry_run_recorded'
                            : entry.status

    return {
        schemaVersion: 'dwm.webhook.delivery_transition_receipt.v1',
        org: receiptContext.org,
        destinationId: entry.destinationId,
        redactedTarget: {
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: receiptContext.alert,
        case: {
            id: entry.alert.caseId,
            path: entry.alert.casePath,
            alertUrl: entry.alert.alertUrl,
        },
        watchlist: receiptContext.watchlist,
        provenance: receiptContext.provenance,
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: entry.dryRun,
            live: entry.live,
            route: entry.route,
            routeUrl: entry.alert.alertUrl || entry.alert.casePath || entry.route || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            auditAction: entry.deliveryProof.auditAction,
            auditEventIds: retryKey?.audit.auditEventIds || (entry.deliveryProof.auditEventId ? [entry.deliveryProof.auditEventId] : []),
        },
        state: {
            current: entry.status,
            rawStatus: entry.rawStatus,
            next: nextState,
            attemptedAt: entry.deliveryProof.attemptedAt,
            updatedAt: entry.deliveryProof.updatedAt,
        },
        retry: {
            retryable: entry.retry.retryable,
            attemptCount: retryKey?.retry.persistedAttemptCount || entry.retry.attemptCount,
            nextRetryAt: entry.retry.nextRetryAt,
            lastErrorCategory: entry.retry.lastErrorCategory,
            terminalFailure: entry.retry.terminalFailure,
            dryRunReady: canDryRunRetry,
            liveReady: canLiveRetry,
        },
        requests: {
            dryRunRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: true,
                externalSendEnabled: false,
                canSend: canDryRunRetry,
                blockers: canDryRunRetry ? [] : uniqueBlockers.filter(blocker => blocker.blocking),
                body: canDryRunRetry ? { ...retryBody, dryRun: true, live: false } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
            liveRetry: {
                method: 'POST',
                route: 'POST /api/dwm/webhook-deliveries',
                noNetwork: !liveDeliveryEnabled,
                externalSendEnabled: canLiveRetry,
                canSend: canLiveRetry,
                blockers: canLiveRetry ? [] : uniqueWebhookBlockers([
                    ...(!liveDeliveryEnabled ? [retryQueueBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment.', entry.destinationId, true)] : []),
                    ...uniqueBlockers,
                ]).filter(blocker => blocker.blocking),
                body: canLiveRetry ? { ...retryBody, dryRun: false, live: true } : null,
                expectedAuditAction: entry.replay ? 'delivery.replayed' : 'delivery.retry_requested',
            },
        },
        caseActionDryRunReceipt,
        denial: {
            denied: blockingCodes.length > 0 || !access.canRetry && entry.retry.retryable,
            blockers: uniqueBlockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
        },
    }
}

function buildDwmWebhookCaseActionDryRunReceipt({
    entry,
    retryBody,
    blockers,
    canDryRunRetry,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryBody: Record<string, unknown>
    blockers: ReturnType<typeof retryQueueBlocker>[]
    canDryRunRetry: boolean
    liveDeliveryEnabled: boolean
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const body = canDryRunRetry
        ? {
            ...retryBody,
            dryRun: true,
            live: false,
            replay: entry.replay,
        }
        : null
    const casePath = entry.alert.casePath || null
    const caseId = entry.alert.caseId || null
    const dedupeKey = entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const routeUrl = entry.alert.alertUrl || casePath || entry.route || null
    const expectedAuditAction = entry.replay ? 'delivery.replayed' : 'delivery.retry_requested'
    const sourceHandoffReadinessConsumer = buildDwmWebhookAlertSourceHandoffReadinessConsumer({
        entry,
        blockers,
        dedupeKey,
        routeUrl,
    })

    return {
        schemaVersion: 'dwm.webhook.case_action_dry_run_receipt.v1',
        noNetwork: true,
        externalSendEnabled: false,
        liveDeliveryEnabled,
        ready: canDryRunRetry,
        org: receiptContext.org,
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: receiptContext.alert,
        case: {
            id: caseId,
            path: casePath,
            alertUrl: entry.alert.alertUrl,
            routeUrl: entry.alert.alertUrl || casePath || entry.route || null,
        },
        watchlist: receiptContext.watchlist,
        provenance: receiptContext.provenance,
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: true,
            live: false,
            route: entry.route,
            routeUrl,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            currentAction: entry.deliveryProof.auditAction,
            expectedAction: expectedAuditAction,
        },
        bodyPreview: body,
        payloadPreview: entry.sanitizedPayloadPreview
            ? {
                schemaVersion: entry.sanitizedPayloadPreview.schemaVersion,
                payloadHash: entry.sanitizedPayloadPreview.payloadHash,
                discord: {
                    title: entry.discordPreview?.title || entry.alert.title || null,
                    fieldNames: entry.discordPreview?.fieldNames || [],
                    content: entry.discordPreview?.content || null,
                },
                context: {
                    alertId: entry.alert.id,
                    caseId,
                    casePath,
                    watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                    sourceFamily: entry.alert.sourceFamily,
                    routeUrl,
                },
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    payloadExposed: false,
                },
            }
            : null,
        historyQuery: {
            method: 'GET' as const,
            route: 'GET /api/dwm/webhook-deliveries',
            query: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                casePath,
                dedupeKey,
                deliveryId: entry.deliveryId,
            },
            noNetwork: true as const,
        },
        actionRequest: {
            method: 'POST' as const,
            route: 'POST /api/dwm/webhook-deliveries',
            canSend: canDryRunRetry,
            body,
            expectedAuditAction,
            blockers: canDryRunRetry ? [] : blockers.filter(blocker => blocker.blocking),
            noNetwork: true as const,
            externalSendEnabled: false as const,
        },
        caseReplayExportConsumer: {
            schemaVersion: 'dwm.webhook.case_replay_export_consumer.v1',
            consumesSchemaVersion: 'dwm.case_action_replay_export.v1',
            route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}/action-replay-export` : '/v1/cases/:caseId/action-replay-export',
            method: 'GET' as const,
            noNetwork: true,
            ready: Boolean(caseId && entry.orgId),
            query: {
                organizationId: entry.orgId,
                actionId: entry.replay ? 'alertReplay' : 'webhookDryRun',
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
            expectedFields: [
                'schemaVersion',
                'caseId',
                'organizationId',
                'alertId',
                'handoffActionReadiness',
                'handoffActionHistory.receipts[]',
                'workflowTransitions[]',
                'replayPlan.blockerCodes',
                'provenance.captureIds',
                'auditSafety.webhookSecretExposed',
            ],
            webhookContext: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                caseId,
                casePath,
                watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                sourceFamily: entry.alert.sourceFamily,
                routeUrl,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
                auditEventId: entry.deliveryProof.auditEventId,
                expectedAuditAction,
            },
            deliveryState: {
                status: entry.status,
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
                blockers: blockers.map(blocker => blocker.code),
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                webhookSecretExposed: false,
            },
        },
        caseWebhookReplayReadinessConsumer: {
            schemaVersion: 'dwm.webhook.case_webhook_replay_readiness_consumer.v1',
            consumesSchemaVersion: 'dwm.case_webhook_replay_readiness_response.v1',
            route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}/webhook-replay-readiness` : '/v1/cases/:caseId/webhook-replay-readiness',
            method: 'GET' as const,
            noNetwork: true,
            ready: Boolean(caseId && entry.orgId),
            query: {
                organizationId: entry.orgId,
                deliveryId: entry.deliveryId,
                destinationId: entry.destinationId,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
            },
            expectedFields: [
                'schemaVersion',
                'caseId',
                'organizationId',
                'webhookDryRunReadiness.readyForReplay',
                'webhookDeliveryReplayContext.retryState.nextRetryAt',
                'webhookDeliveryReplayContext.summary.deliveryIds',
                'customerNotificationReadiness.blockerCodes',
                'nextWebhookActions[].id',
                'auditSafety.webhookSecretExposed',
            ],
            webhookContext: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                caseId,
                casePath,
                caseActionId: entry.alert.caseActionId,
                caseActionPath: entry.alert.caseActionPath,
                watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                sourceFamily: entry.alert.sourceFamily,
                routeUrl,
                dedupeKey,
                idempotencyKey: entry.deliveryProof.idempotencyKey,
                auditEventId: entry.deliveryProof.auditEventId,
                expectedAuditAction,
            },
            deliveryState: {
                status: entry.status,
                retryable: entry.retry.retryable,
                attemptCount: entry.retry.attemptCount,
                nextRetryAt: entry.retry.nextRetryAt,
                lastErrorCategory: entry.retry.lastErrorCategory,
                terminalFailure: entry.retry.terminalFailure,
                dryRunReceiptAvailable: entry.dryRun,
                replay: entry.replay,
                blockers: blockers.map(blocker => blocker.code),
            },
            nextWebhookActionIds: ['run_webhook_dry_run', 'retry_webhook_delivery', 'record_customer_notification'],
            roleGates: {
                replay: ['owner', 'admin'],
                retry: ['owner', 'admin'],
                readSummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            },
            readiness: {
                dryRunReady: canDryRunRetry,
                retryableDelivery: entry.retry.retryable,
                idempotentReplay: entry.replay && entry.dedupe.duplicateAttemptCount > 0,
                auditLinked: Boolean(entry.deliveryProof.auditEventId),
                redactedPayload: true,
            },
            redaction: {
                safeForCustomerDisplay: true,
                endpointExposed: false,
                payloadBodyExposed: false,
                webhookSecretExposed: false,
            },
        },
        sourceHandoffReadinessConsumer,
        denial: {
            denied: blockingCodes.length > 0,
            blockingCodes,
            blockers,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'endpointSecret', 'endpoint_encrypted'],
        },
    }
}

function buildDwmWebhookAlertSourceHandoffReadinessConsumer({
    entry,
    blockers,
    dedupeKey,
    routeUrl,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    blockers: ReturnType<typeof retryQueueBlocker>[]
    dedupeKey: string | null
    routeUrl: string | null
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const captureIds = entry.alert.provenanceIds.captureIds || []
    const sourceIds = entry.alert.provenanceIds.sourceIds || []
    const sourceReady = Boolean(entry.alert.sourceFamily && entry.alert.evidenceCount > 0 && captureIds.length > 0 && sourceIds.length > 0)
    const destinationReady = Boolean(entry.destinationId && entry.destination.enabled !== false && entry.destination.status !== 'disabled')
    const deliveryReady = destinationReady && !blockers.some(blocker => blocker.blocking && ['destination_unavailable', 'destination_disabled', 'permission_denied'].includes(blocker.code))
    const state = sourceReady && deliveryReady
        ? 'ready_for_consumers'
        : !sourceReady
            ? 'source_provenance_gap'
            : 'delivery_handoff_gap'
    const supportRecoveryNeeded = blockers.some(blocker => blocker.code === 'permission_denied')

    return {
        schemaVersion: 'dwm.webhook.alert_source_handoff_readiness_consumer.v1',
        consumesSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
        noNetwork: true,
        ready: state === 'ready_for_consumers',
        state,
        routeContract: {
            sourceHandoff: {
                method: 'GET' as const,
                route: '/v1/dwm/alerts',
                requiredQuery: ['organizationId', 'alertId'],
                expectedSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
                noNetwork: true,
            },
            supportHistory: {
                method: 'GET' as const,
                route: '/api/admin/support/inspect',
                requiredQuery: ['organizationId', 'targetUserId', 'requestId', 'action'],
                expectedSchemaVersion: 'organization.member_recovery_support_history_bridge.v1',
                noNetwork: true,
            },
        },
        org: receiptContext.org,
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: {
            ...receiptContext.alert,
            selectedCaptureIds: captureIds,
            provenanceCaptureIds: captureIds,
            provenanceSourceIds: sourceIds,
            provenanceGapCodes: sourceReady ? [] : ['missing_source_provenance'],
        },
        case: {
            id: entry.alert.caseId || null,
            path: entry.alert.casePath || null,
            routeUrl,
        },
        watchlist: receiptContext.watchlist,
        webhookConsumer: {
            ready: deliveryReady,
            deliveryReady,
            delivered: entry.dedupe.alreadyDelivered || entry.status === 'sent',
            deliveryDedupeKey: dedupeKey,
            deliveryHistoryRefs: [entry.deliveryId].filter(Boolean),
            blockerCodes: blockers.map(blocker => blocker.code),
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                terminalFailure: entry.retry.terminalFailure,
            },
        },
        caseConsumer: {
            ready: Boolean(entry.alert.caseId || entry.alert.casePath),
            caseId: entry.alert.caseId || null,
            casePath: entry.alert.casePath || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            blockerCodes: [],
        },
        supportRecoveryBridge: buildOrganizationSupportHistoryBridge({
            required: supportRecoveryNeeded,
            replayFilters: {
                organizationId: entry.orgId,
                targetUserId: '<target_user_id>',
                requestId: entry.requestId,
                action: 'support.organization.access_recovery',
            },
        }),
        orgDestinationReadinessBridge: buildWebhookDestinationReadinessBridge({
            defaultWebhookPolicy: 'manual_selection',
            canUseDefaultDestinations: false,
            selectedDestinationSource: entry.destinationId ? 'manual_selection' : 'manual_selection_required',
            requiredDestinationOrgId: entry.orgId,
            blockerCodes: blockers.map(blocker => blocker.code),
            dwmReadiness: {
                ready: deliveryReady,
                selectedDestination: entry.destinationId
                    ? {
                        id: entry.destinationId,
                        orgId: entry.orgId,
                        label: entry.destination.label,
                        type: entry.destination.type,
                        endpointHash: entry.destination.redactedEndpoint.endpointHash,
                        endpointExposed: false,
                        status: entry.destination.status,
                        enabled: entry.destination.enabled,
                    }
                    : null,
                retry: {
                    retryable: entry.retry.retryable,
                    nextRetryAt: entry.retry.nextRetryAt,
                    attemptCount: entry.retry.attemptCount,
                    terminalFailure: entry.retry.terminalFailure,
                },
                idempotency: {
                    key: entry.deliveryProof.idempotencyKey,
                    dedupeKey,
                },
            },
        }),
        stableFields: [
            'sourceFamily',
            'selectedCaptureIds',
            'evidenceCount',
            'provenanceCaptureIds',
            'provenanceSourceIds',
            'webhookConsumer.deliveryDedupeKey',
            'webhookConsumer.retry.nextRetryAt',
            'caseConsumer.casePath',
            'orgDestinationReadinessBridge.selectedDestination.id',
        ],
        gapFields: [
            'state',
            'alert.provenanceGapCodes',
            'webhookConsumer.blockerCodes',
            'supportRecoveryBridge.required',
            'orgDestinationReadinessBridge.blockerCodes',
        ],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
        },
    }
}

function buildDwmWebhookReceiptHistoryFilters({
    receipts,
    filters,
    access,
    liveDeliveryEnabled,
    blockers = [],
}: {
    receipts: Array<{
        deliveryId: string
        requestId: string
        orgId: string
        destinationId: string | null
        alertId: string
        eventType: DwmAlertEventType
        status: DwmWebhookDeliveryAttemptState
        rawStatus: string
        dryRun: boolean
        live: boolean
        replay: boolean
        dedupeKey: string | null
        casePath: string
        caseActionId?: string | null
        caseActionPath?: string | null
        alertUrl: string
        watchlist: { id: string, name: string, terms: string[] }
        destination: {
            label: string | null
            type: string | null
            status: string | null
            enabled: boolean | null
            redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
        }
        proof: {
            auditEventId: string | null
            auditAction: string | null
            payloadHash: string | null
            updatedAt: string | null
        }
        retry: {
            retryable: boolean
            nextRetryAt: string | null
            attemptCount: number
            lastErrorCategory: string | null
            terminalFailure: boolean
        }
        transitionReceipt: ReturnType<typeof buildDwmWebhookDeliveryTransitionReceipt>
        blockingCodes: string[]
    }>
    filters: {
        orgId?: string | null
        destinationId?: string | null
        alertId?: string | null
        casePath?: string | null
        caseActionId?: string | null
        caseActionPath?: string | null
        dedupeKey?: string | null
        requestId?: string | null
        idempotencyKey?: string | null
        action?: string | null
        status?: string | null
        timeFrom?: string | null
        timeTo?: string | null
        retryState?: string | null
        actorId?: string | null
    }
    access: { canRead: boolean, canRetry: boolean, memberSafe: boolean }
    liveDeliveryEnabled: boolean
    blockers?: ReturnType<typeof retryQueueBlocker>[]
}) {
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        caseActionId: clean(filters.caseActionId) || null,
        caseActionPath: clean(filters.caseActionPath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || null,
        idempotencyKey: clean(filters.idempotencyKey) || null,
        action: clean(filters.action) || null,
        status: clean(filters.status) || null,
        timeFrom: clean(filters.timeFrom) || null,
        timeTo: clean(filters.timeTo) || null,
        retryState: clean(filters.retryState) || null,
        actorId: clean(filters.actorId) || null,
    }
    const queryPreview = {
        orgId: normalizedFilters.orgId || '<org_id>',
        destinationId: normalizedFilters.destinationId || undefined,
        alertId: normalizedFilters.alertId || undefined,
        casePath: normalizedFilters.casePath || undefined,
        caseActionId: normalizedFilters.caseActionId || undefined,
        caseActionPath: normalizedFilters.caseActionPath || undefined,
        dedupeKey: normalizedFilters.dedupeKey || undefined,
        deliveryId: normalizedFilters.requestId || undefined,
        idempotencyKey: normalizedFilters.idempotencyKey || undefined,
        action: normalizedFilters.action || undefined,
        status: normalizedFilters.status || undefined,
        timeFrom: normalizedFilters.timeFrom || undefined,
        timeTo: normalizedFilters.timeTo || undefined,
        retryState: normalizedFilters.retryState || undefined,
        actorId: normalizedFilters.actorId || undefined,
    }
    const rows = receipts.map(receipt => ({
        schemaVersion: 'dwm.webhook.delivery_receipt_history_filter_row.v1',
        deliveryId: receipt.deliveryId,
        requestId: receipt.requestId,
        orgId: receipt.orgId,
        destinationId: receipt.destinationId,
        alertId: receipt.alertId,
        casePath: receipt.casePath,
        caseActionId: receipt.caseActionId || null,
        caseActionPath: receipt.caseActionPath || null,
        alertUrl: receipt.alertUrl,
        dedupeKey: receipt.dedupeKey,
        eventType: receipt.eventType,
        status: receipt.status,
        rawStatus: receipt.rawStatus,
        dryRun: receipt.dryRun,
        live: receipt.live,
        replay: receipt.replay,
        watchlistTerm: receipt.watchlist.terms[0] || receipt.watchlist.name || null,
        sourceFamily: receipt.transitionReceipt.alert.sourceFamily,
        provenanceIds: receipt.transitionReceipt.provenance,
        workflowStatus: receipt.transitionReceipt.workflow.status,
        routeUrl: receipt.transitionReceipt.workflow.routeUrl,
        auditEventId: receipt.proof.auditEventId,
        auditAction: receipt.proof.auditAction,
        auditEventIds: receipt.transitionReceipt.audit.auditEventIds,
        redactedTarget: receipt.transitionReceipt.redactedTarget,
        retry: {
            retryable: receipt.retry.retryable,
            nextRetryAt: receipt.retry.nextRetryAt,
            attemptCount: receipt.retry.attemptCount,
            lastErrorCategory: receipt.retry.lastErrorCategory,
            terminalFailure: receipt.retry.terminalFailure,
        },
        idempotency: {
            key: receipt.transitionReceipt.workflow.idempotencyKey,
            dedupeKey: receipt.transitionReceipt.workflow.dedupeKey,
            replay: receipt.replay,
        },
        queryKeys: {
            byDelivery: { orgId: receipt.orgId, deliveryId: receipt.deliveryId },
            byDestination: receipt.destinationId ? { orgId: receipt.orgId, destinationId: receipt.destinationId } : null,
            byAlert: receipt.alertId ? { orgId: receipt.orgId, alertId: receipt.alertId } : null,
            byCase: receipt.casePath ? { orgId: receipt.orgId, casePath: receipt.casePath } : null,
            byCaseAction: receipt.caseActionId || receipt.caseActionPath ? {
                orgId: receipt.orgId,
                ...(receipt.caseActionId ? { caseActionId: receipt.caseActionId } : {}),
                ...(receipt.caseActionPath ? { caseActionPath: receipt.caseActionPath } : {}),
            } : null,
            byDedupe: receipt.dedupeKey ? { orgId: receipt.orgId, dedupeKey: receipt.dedupeKey } : null,
        },
        blockers: receipt.transitionReceipt.denial.blockers,
        blockingCodes: receipt.transitionReceipt.denial.blockingCodes,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            payloadExposed: false,
        },
    }))
    const retryableRows = rows.filter(row => row.retry.retryable)
    const replayRows = rows.filter(row => row.replay)
    const missingDestinationRows = rows.filter(row => row.blockingCodes.includes('destination_unavailable'))
    const disabledRows = rows.filter(row => row.blockingCodes.includes('destination_disabled'))

    return {
        schemaVersion: 'dwm.webhook.delivery_receipt_history_filters.v1',
        noNetwork: true,
        liveDeliveryEnabled,
        externalSendEnabled: false,
        access,
        activeFilters: normalizedFilters,
        routeContract: {
            list: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'caseActionId', 'caseActionPath', 'dedupeKey', 'deliveryId', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId', 'replay'],
                noNetwork: true,
            },
            detail: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'deliveryId'],
                noNetwork: true,
            },
            replayHistory: {
                method: 'GET',
                route: '/api/dwm/webhook-deliveries',
                requiredQuery: ['orgId', 'dedupeKey'],
                optionalQuery: ['destinationId', 'alertId', 'casePath', 'caseActionId', 'caseActionPath', 'idempotencyKey', 'action', 'status', 'timeFrom', 'timeTo', 'retryState', 'actorId'],
                noNetwork: true,
            },
            dryRunReplay: {
                method: 'POST',
                route: '/api/dwm/webhook-deliveries',
                requiredBody: ['orgId', 'destinationId', 'alertId', 'dedupeKey', 'dryRun'],
                noNetworkDefault: true,
            },
        },
        queryPreview,
        queryPresets: {
            replayOnly: { ...queryPreview, replay: true },
            retryable: retryableRows[0]?.queryKeys.byDedupe || retryableRows[0]?.queryKeys.byDelivery || null,
            missingDestination: missingDestinationRows[0]?.queryKeys.byAlert || missingDestinationRows[0]?.queryKeys.byDelivery || null,
            disabledDestination: disabledRows[0]?.queryKeys.byDestination || disabledRows[0]?.queryKeys.byDelivery || null,
            latestReplay: replayRows[0]?.queryKeys.byDedupe || replayRows[0]?.queryKeys.byDelivery || null,
            latestCaseActionReplay: replayRows.find(row => row.queryKeys.byCaseAction)?.queryKeys.byCaseAction || null,
        },
        counts: {
            total: rows.length,
            replay: replayRows.length,
            dryRun: rows.filter(row => row.dryRun).length,
            live: rows.filter(row => row.live).length,
            failed: rows.filter(row => row.status === 'failed').length,
            skipped: rows.filter(row => row.status === 'skipped').length,
            retryable: retryableRows.length,
            terminalFailure: rows.filter(row => row.retry.terminalFailure).length,
            missingDestination: missingDestinationRows.length,
            disabledDestination: disabledRows.length,
            auditLinked: rows.filter(row => Boolean(row.auditEventId)).length,
            blocked: rows.filter(row => row.blockingCodes.length > 0).length,
        },
        blockers: uniqueWebhookBlockers(blockers),
        rows,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            payloadExposed: false,
        },
    }
}

function webhookSetupRoutes(destinationId = '<destination_id>') {
    return {
        list: 'GET /api/dwm/webhooks?orgId=<org_id>',
        create: 'POST /api/dwm/webhooks',
        update: `PUT /api/dwm/webhook-destinations/${destinationId}`,
        disable: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        delete: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        archive: `DELETE /api/dwm/webhook-destinations/${destinationId}`,
        test: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
        deliver: 'POST /api/dwm/webhook-deliveries',
        deliveryHistory: 'GET /api/dwm/webhook-deliveries?orgId=<org_id>&destinationId=<destination_id>',
    }
}

function dashboardReadinessBlocker(
    code: string,
    message: string,
    destinationId: string | null = null,
    reason: string | null = null,
    blocking = true
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { reason, blocking })
}

const uniqueDashboardReadinessBlockers = (blockers: ReturnType<typeof dashboardReadinessBlocker>[]) => uniqueWebhookBlockers(blockers, true)

function dashboardPrimaryHealthStatus(states: string[]) {
    const priority = [
        'policy_blocked',
        'disabled',
        'secret_missing',
        'test_failed',
        'terminal_failure',
        'retry_scheduled',
        'verified',
    ]
    for (const status of priority) {
        if (states.includes(status)) return status
    }
    return 'unverified'
}

function dashboardLifecycleActionSummary(rows: Array<{
    destinationId: string
    lifecycleState: ReturnType<typeof destinationLifecycleState>
}>) {
    const dryRunRows = rows.filter(row => row.lifecycleState.requiredActions.dryRunTest)
    const enableRows = rows.filter(row => row.lifecycleState.requiredActions.enableDestination)
    const updateRows = rows.filter(row => row.lifecycleState.requiredActions.updateDestination)
    const ownerReviewRows = rows.filter(row => row.lifecycleState.revokedOwner)
    const actions = [
        dryRunRows.length
            ? {
                action: 'dry_run_test',
                count: dryRunRows.length,
                destinationIds: dryRunRows.map(row => row.destinationId),
                routeTemplate: 'POST /api/dwm/webhook-destinations/{destinationId}/test',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        enableRows.length
            ? {
                action: 'enable_destination',
                count: enableRows.length,
                destinationIds: enableRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                bodyPreview: { status: 'active' },
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        updateRows.length
            ? {
                action: 'review_destination_owner_or_secret',
                count: updateRows.length,
                destinationIds: updateRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
        ownerReviewRows.length
            ? {
                action: 'review_revoked_owner',
                count: ownerReviewRows.length,
                destinationIds: ownerReviewRows.map(row => row.destinationId),
                routeTemplate: 'PATCH /api/dwm/webhook-destinations/{destinationId}',
                noNetworkDefault: true,
                liveSendAllowed: false,
            }
            : null,
    ].filter(Boolean) as Array<Record<string, unknown>>

    return actions.map(action => ({
        ...action,
        redaction: {
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: false,
            safeForCustomerDisplay: true,
        },
    }))
}

function destinationHealthStates(health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const terminalFailure = hasTerminalDeliveryFailure(health.lastFailure)
    const states = [
        !health.enabled ? 'disabled' : null,
        endpointPresent ? null : 'secret_missing',
        health.lastTest.status === 'failed' ? 'test_failed' : null,
        health.retry.retryable ? 'retry_scheduled' : null,
        terminalFailure ? 'terminal_failure' : null,
        health.enabled && endpointPresent && health.lastTest.requestId && isLiveDeliveredProof(health.lastTest) ? 'verified' : null,
    ].filter(Boolean) as string[]
    return [...new Set(states.length ? states : ['unverified'])]
}

function validateWebhookEndpointForContract(rawEndpoint: string) {
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

function crudBlocker(
    code: DwmWebhookDestinationCrudBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false,
    blocking = true
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable, blocking })
}

function destinationCrudRouteContract() {
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

function destinationCrudManagementRequest({
    action,
    orgId,
    destinationId,
    requestId,
    label,
    kind,
    channel,
    status,
    events,
    redactedEndpoint,
    blockers,
    canApply,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destinationId: string | null
    requestId: string
    label: string
    kind: DwmWebhookKind
    channel: string | null
    status: DwmWebhookStatus
    events: DwmAlertEventType[]
    redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    blockers: ReturnType<typeof crudBlocker>[]
    canApply: boolean
    liveDeliveryEnabled: boolean
}) {
    const route = action === 'create'
        ? '/api/dwm/webhook-destinations'
        : action === 'test'
            ? `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}/test`
            : `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}`
    const method = action === 'create' || action === 'test'
        ? 'POST'
        : action === 'disable' || action === 'delete'
            ? 'DELETE'
            : 'PUT'
    const expectedAuditAction = action === 'create'
        ? 'destination.created'
        : action === 'disable' || action === 'delete'
            ? 'destination.archived'
            : action === 'test'
                ? 'delivery.tested'
                : 'destination.updated'
    const bodyPreview = method === 'DELETE'
        ? null
        : {
            orgId,
            destinationId,
            requestId: requestId || null,
            label,
            type: kind,
            kind,
            channel,
            status,
            events,
            dryRun: action === 'test' ? true : undefined,
            redactedEndpoint: {
                endpointHint: redactedEndpoint.endpointHint,
                endpointHash: redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            secretFields: action === 'create' || action === 'update' ? ['endpointUrl', 'webhookUrl', 'url'] : [],
        }

    return {
        schemaVersion: 'dwm.webhook.destination_management_request.v1',
        action,
        method,
        route,
        noNetwork: true,
        liveDeliveryEnabled,
        canSend: canApply,
        expectedAuditAction,
        expectedPersistedAttempt: action === 'test',
        bodyPreview,
        queryPreview: method === 'DELETE' ? { orgId, requestId: requestId || null } : null,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        blockers,
        blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
    }
}

function destinationCrudPersistenceReceipt({
    action,
    orgId,
    destination,
    desired,
    managementRequest,
    blockers,
    proofRow,
    duplicateDestinationId,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destination: DwmWebhookDestinationPublic | null
    desired: {
        label: string
        type: DwmWebhookKind
        kind: DwmWebhookKind
        channel: string | null
        status: DwmWebhookStatus
        events: DwmAlertEventType[]
        redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    }
    managementRequest: ReturnType<typeof destinationCrudManagementRequest>
    blockers: ReturnType<typeof crudBlocker>[]
    proofRow: ReturnType<typeof buildDwmWebhookDestinationAdminProof>['destinations'][number] | null
    duplicateDestinationId: string | null
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const currentStatus = destination?.status || null
    const nextStatus = action === 'delete'
        ? 'archived'
        : action === 'disable'
            ? 'paused'
            : action === 'enable'
                ? 'active'
                : desired.status
    const persisted = blockingCodes.length === 0
    const destinationId = destination?.id || null
    const redactedEndpoint = {
        endpointHint: desired.redactedEndpoint.endpointHint || (destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null),
        endpointHash: desired.redactedEndpoint.endpointHash || destination?.endpointHash || null,
        endpointExposed: false,
    }

    return {
        schemaVersion: 'dwm.webhook.destination_persistence_receipt.v1',
        action,
        org: { id: orgId },
        destinationId,
        redactedTarget: {
            destinationId,
            label: destination?.name || desired.label,
            type: destination?.kind || desired.kind,
            currentStatus,
            nextStatus,
            endpoint: redactedEndpoint,
        },
        mutation: {
            operation: action,
            persisted,
            stateChanged: Boolean(currentStatus && currentStatus !== nextStatus),
            currentStatus,
            nextStatus,
            enabledAfter: nextStatus === 'active',
            displayLabel: desired.label,
            channelLabel: desired.channel,
            events: desired.events,
        },
        request: {
            method: managementRequest.method,
            route: managementRequest.route,
            noNetwork: true,
            liveDeliveryEnabled,
            canSend: managementRequest.canSend,
            bodyPreview: managementRequest.bodyPreview,
            queryPreview: managementRequest.queryPreview,
        },
        dryRun: {
            requiredBeforeLive: true,
            testRoute: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/<destination_id>/test',
            latestTestStatus: proofRow?.lifecycle.lastTest.status || null,
            latestTestRequestId: proofRow?.lifecycle.lastTest.requestId || null,
            latestTestAuditEventId: proofRow?.lifecycle.lastTest.auditEventId || null,
        },
        deliveryContext: {
            alertId: null,
            caseId: null,
            casePath: null,
            watchlistTerm: null,
            sourceFamily: null,
            provenanceIds: { captureIds: [], sourceIds: [], primaryCaptureId: null },
            workflowStatus: 'destination_mutation',
            routeUrl: managementRequest.route,
            appliesToAlertDelivery: false,
        },
        audit: {
            expectedAction: managementRequest.expectedAuditAction,
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateDestinationId,
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
        },
        denial: {
            denied: blockingCodes.length > 0,
            blockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        noNetwork: true,
        externalSendEnabled: false,
    }
}

function adminProofBlocker(
    code: DwmWebhookDestinationAdminProofBlockerCode,
    message: string,
    destinationId: string | null = null,
    retryable = false
) {
    return makeWebhookBlockerWithFields(code, message, destinationId, { retryable })
}

function destinationAdminProofBlockers({
    health,
    latestOrgAlert,
    latestSent,
    latestFailedOrSkipped,
}: {
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    latestOrgAlert: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestSent: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
    latestFailedOrSkipped: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'][number] | null
}) {
    const blockers: ReturnType<typeof adminProofBlocker>[] = []
    if (!health.enabled) {
        blockers.push(adminProofBlocker('destination_disabled', 'Destination is disabled.', health.destinationId))
    }
    if (!health.lastTest.requestId || (health.lastTest.status !== 'dry_run' && health.lastTest.status !== 'delivered')) {
        blockers.push(adminProofBlocker('no_verified_dry_run', 'Destination has no successful dry-run/test delivery.', health.destinationId))
    }
    if (!health.redactedEndpoint.endpointHash || !health.redactedEndpoint.endpointHint) {
        blockers.push(adminProofBlocker('no_live_endpoint', 'Destination has no stored webhook endpoint reference.', health.destinationId))
    }
    if (!health.latestAuditEventId && health.auditEventIds.length === 0) {
        blockers.push(adminProofBlocker('audit_missing', 'Destination has no linked webhook audit event.', health.destinationId))
    }
    if (!health.ready && health.enabled) {
        blockers.push(adminProofBlocker('destination_unhealthy', 'Destination health is blocked or retrying.', health.destinationId, health.retry.retryable))
    }
    if (!latestOrgAlert) {
        blockers.push(adminProofBlocker('missing_org_alert_context', 'No org alert delivery or replay has been recorded for this destination.', health.destinationId))
    }
    if (latestSent) {
        blockers.push(adminProofBlocker('dedupe_already_delivered', 'A delivery has already been sent for the latest destination dedupe context.', health.destinationId))
    }
    if (latestFailedOrSkipped && !latestFailedOrSkipped.attempts.retryable && latestFailedOrSkipped.status !== 'queued') {
        blockers.push(adminProofBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', health.destinationId))
    }
    return uniqueWebhookBlockers(blockers)
}

function destinationAdminProofSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean }
        retry: { retryable: boolean }
        dedupe: { duplicateKeyCount: number, alreadyDelivered: boolean }
        replay: { replayAttemptCount: number }
    }>,
    operations: ReturnType<typeof buildDwmWebhookDeliveryOperations>['recentDeliveries'],
    liveDeliveryEnabled: boolean
) {
    return {
        destinationCount: proofs.length,
        activeDestinationCount: proofs.filter(proof => proof.enabled).length,
        readyDestinationCount: proofs.filter(proof => proof.health.ready).length,
        blockedDestinationCount: proofs.filter(proof => !proof.health.ready).length,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        replayDestinationCount: proofs.filter(proof => proof.replay.replayAttemptCount > 0).length,
        dedupeDeliveredCount: proofs.filter(proof => proof.dedupe.alreadyDelivered).length,
        duplicateDedupeDestinationCount: proofs.filter(proof => proof.dedupe.duplicateKeyCount > 0).length,
        recentDeliveryCount: operations.length,
        liveDeliveryEnabled,
    }
}

function webhookProductProgressSummary(
    proofs: Array<{
        enabled: boolean
        health: { ready: boolean, adminProofBlockers: ReturnType<typeof adminProofBlocker>[] }
        retry: { retryable: boolean }
        deliveryOperations: { latestOrgAlert: unknown }
    }>,
    liveDeliveryEnabled: boolean,
    blockers: ReturnType<typeof adminProofBlocker>[]
) {
    const activeDestinationCount = proofs.filter(proof => proof.enabled).length
    const deliveryReadyCount = proofs.filter(proof => proof.enabled && proof.health.ready && proof.deliveryOperations.latestOrgAlert).length
    const blockerCodes = [...new Set(blockers.map(blocker => blocker.code))]
    return {
        schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1',
        status: activeDestinationCount > 0 && deliveryReadyCount > 0 && !blockerCodes.includes('permission_denied') ? 'ready' : 'needs_action',
        destinationCount: proofs.length,
        activeDestinationCount,
        deliveryReadyCount,
        retryEligibleCount: proofs.filter(proof => proof.retry.retryable).length,
        liveDeliveryEnabled,
        blockerCodes,
        href: '/automation?setup=dwm',
    }
}
