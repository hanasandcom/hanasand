import type { buildDwmWebhookReceiptHistoryFilters } from './receipt-history-filters.ts'

type Receipt = Parameters<typeof buildDwmWebhookReceiptHistoryFilters>[0]['receipts'][number]

export function buildReceiptHistoryRows(receipts: Receipt[]) {
    return receipts.map(receipt => ({
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
}
