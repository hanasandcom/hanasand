import { clean } from '../../webhookValueUtils.ts'
import { workflowSummary } from '../discordTemplate.ts'
import { buildIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import type { buildDwmWebhookDispatchPlanForDestinations } from '../dispatchPlanning.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import type { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { deliveryProvenanceIds } from './retry-queue-blocker.ts'

type Dispatch = ReturnType<typeof buildDwmWebhookDispatchPlanForDestinations>
type NormalizedAlert = ReturnType<typeof normalizeAlert>
type Watchlist = ReturnType<typeof normalizeWatchlist>
type AuditContracts = ReturnType<typeof buildDwmWebhookAuditEventContracts>
type Blocker = { code: string; message: string; destinationId: string | null; blocking: boolean }
type Preview = Record<string, unknown> | null

type AlertEventConsumerInput = {
    dispatch: Dispatch
    eventType: DwmAlertEventType
    dryRun: boolean
    normalizedAlert: NormalizedAlert
    watchlist: Watchlist
    firstSelectedDestination: Dispatch['selectedDestinations'][number] | null
    selectedAlertEventAuditContracts: AuditContracts
    alertEventExpectedAuditAction: string
    alertEventPreviewPayload: Preview
    alertEventPreviewEmbeds: Array<Record<string, unknown>>
    alertEventPreviewFieldNames: string[]
    alertEventRequiredDiscordFields: string[]
    alertEventMissingDiscordFields: string[]
    alertEventDiscordLimits: Record<string, boolean>
    alertEventDiscordTemplate: Record<string, unknown>
    alertEventRedactionProof: Record<string, boolean>
    alertEventRedactionValid: boolean
    ready: boolean
    uniqueBlockers: Blocker[]
    blockingCodes: string[]
}

export function buildDwmAlertEventConsumer({
    dispatch, eventType, dryRun, normalizedAlert, watchlist, firstSelectedDestination,
    selectedAlertEventAuditContracts, alertEventExpectedAuditAction, alertEventPreviewPayload,
    alertEventPreviewEmbeds, alertEventPreviewFieldNames, alertEventRequiredDiscordFields,
    alertEventMissingDiscordFields, alertEventDiscordLimits, alertEventDiscordTemplate,
    alertEventRedactionProof, alertEventRedactionValid, ready, uniqueBlockers, blockingCodes,
}: AlertEventConsumerInput) {
    return {

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

    }
}
