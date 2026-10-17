import type { buildDwmWebhookDeliveryAttemptPersistenceReadModel } from './implementation/delivery-attempt-persistence-read-model.ts'
import type { buildDwmWebhookDeliveryReplayGuard } from './implementation/delivery-replay-guard.ts'
import { makeWebhookBlocker, uniqueWebhookBlockers } from '../webhookValueUtils.ts'

type DeliveryReadModel = ReturnType<typeof buildDwmWebhookDeliveryAttemptPersistenceReadModel>
type ReplayGuard = ReturnType<typeof buildDwmWebhookDeliveryReplayGuard>

export function buildDwmWebhookDeliveryReplayApiProjection(
    readModel: DeliveryReadModel,
    replayGuard: ReplayGuard,
    liveDeliveryEnabled: boolean,
) {
    const guardByIdempotencyKey = new Map(replayGuard.entries.map(entry => [entry.idempotencyKey, entry]))
    const requests = readModel.rows.map((row) => {
        const guard = guardByIdempotencyKey.get(row.idempotencyKey) || null
        const permissionBlocked = replayGuard.access.canReplay !== true
        const dryRunBlockers = [
            ...(guard?.blockers || []).filter(blocker => blocker.blocking && blocker.code !== 'live_delivery_disabled'),
            ...(permissionBlocked ? [makeWebhookBlocker('permission_denied', 'Only organization owners and admins can replay webhook deliveries.', row.destinationId, true)] : []),
        ]
        const dryRunAllowed = replayGuard.access.canReplay === true && dryRunBlockers.length === 0 && row.actionRequests.dryRunReplay.body !== null
        return {
            schemaVersion: 'dwm.webhook.delivery_replay_api_request.v1',
            deliveryId: row.deliveryId,
            requestId: row.requestId,
            destinationId: row.destinationId,
            orgId: row.orgId,
            alertId: row.alertId,
            watchlistId: row.watchlistId,
            watchlistName: row.watchlistName,
            casePath: row.casePath,
            caseActionId: row.caseActionId,
            caseActionPath: row.caseActionPath,
            dedupeKey: row.dedupeKey,
            idempotencyKey: row.idempotencyKey,
            replay: row.replay,
            status: row.status,
            redactedDestination: row.redactedDestination,
            idempotency: row.idempotency,
            replayHistory: row.replayHistory,
            latestAttempt: {
                status: row.status,
                dryRun: row.dryRun,
                live: row.live,
                attemptedAt: row.timestamps.attemptedAt,
                auditEventId: row.audit.auditEventId,
            },
            dryRunReplay: {
                route: 'POST /api/dwm/webhook-deliveries',
                canSend: dryRunAllowed,
                noNetwork: true,
                body: row.actionRequests.dryRunReplay.body,
                expectedStatus: 'dry_run',
                expectedAuditAction: 'delivery.replayed',
                blockers: uniqueWebhookBlockers(dryRunBlockers),
            },
            liveReplay: {
                route: 'POST /api/dwm/webhook-deliveries',
                canSend: guard?.guard.liveAllowed === true,
                noNetwork: !liveDeliveryEnabled,
                body: row.actionRequests.liveReplay.body,
                blockers: guard?.blockers || row.actionRequests.liveReplay.blockers,
            },
            retry: row.retry,
            audit: row.audit,
            operationLinks: row.operationLinks,
        }
    })

    return {
        schemaVersion: 'dwm.webhook.delivery_replay_api.v1',
        noNetwork: true,
        externalSendEnabled: replayGuard.externalSendEnabled,
        liveDeliveryEnabled,
        access: replayGuard.access,
        visibility: replayGuard.visibility,
        filters: readModel.filters,
        counts: {
            total: requests.length,
            dryRunReady: requests.filter(request => request.dryRunReplay.canSend).length,
            liveReady: requests.filter(request => request.liveReplay.canSend).length,
            blocked: requests.filter(request => !request.dryRunReplay.canSend).length,
            auditLinked: requests.filter(request => request.audit.auditEventId).length,
        },
        requests,
        blockers: uniqueWebhookBlockers([
            ...replayGuard.blockers,
            ...requests.flatMap(request => request.dryRunReplay.blockers),
        ]),
    }
}
