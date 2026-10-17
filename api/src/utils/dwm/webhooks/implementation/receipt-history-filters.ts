import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { type DwmWebhookDeliveryAttemptState } from './webhook-contract-types.ts'
import { type buildDwmWebhookDeliveryTransitionReceipt } from './delivery-transition-receipt.ts'
import { type retryQueueBlocker } from './retry-queue-blocker.ts'
import { buildReceiptHistoryQuery } from './receipt-history-query.ts'
import { buildReceiptHistoryRows } from './receipt-history-rows.ts'

export function buildDwmWebhookReceiptHistoryFilters({
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
    const { normalizedFilters, queryPreview } = buildReceiptHistoryQuery(filters)
    const rows = buildReceiptHistoryRows(receipts)
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
