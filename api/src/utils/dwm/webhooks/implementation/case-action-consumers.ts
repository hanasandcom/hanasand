import { type buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'
import { type retryQueueBlocker } from './retry-queue-blocker.ts'

type Entry = ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
type Blocker = ReturnType<typeof retryQueueBlocker>

export function buildCaseActionConsumers({
    entry,
    blockers,
    canDryRunRetry,
    caseId,
    casePath,
    dedupeKey,
    routeUrl,
    expectedAuditAction,
}: {
    entry: Entry
    blockers: Blocker[]
    canDryRunRetry: boolean
    caseId: string | null
    casePath: string | null
    dedupeKey: string | null
    routeUrl: string | null
    expectedAuditAction: string
}) {
    return {
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
        }
    }
}
