import type {
    DwmWebhookAuditRow,
    DwmWebhookDeliveryRow,
    DwmWebhookDestinationRow,
} from './webhookDestinationTypes.ts'
import { controlledReceiverEndpointHashes } from './webhookTransport.ts'
import { decryptWebhookTarget } from './webhookDestinationSecrets.ts'

export function toDwmWebhookDestination(row: DwmWebhookDestinationRow) {
    const target = decryptWebhookTarget(row.endpoint_encrypted)
    return {
        id: row.id,
        ownerId: row.owner_id,
        orgId: row.org_id,
        name: row.name,
        kind: row.kind,
        endpointHint: row.endpoint_hint,
        endpointHash: row.endpoint_hash,
        status: row.status,
        events: row.events,
        createdBy: row.created_by,
        lastTestedAt: row.last_tested_at,
        lastTestStatus: row.last_test_status,
        lastTestError: row.last_test_error,
        lastTestHttpStatus: row.last_test_http_status,
        lastDeliveryAt: row.last_delivery_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        signingConfigured: Boolean(target.signingSecret) || controlledReceiverEndpointHashes().includes(row.endpoint_hash),
    }
}

export function toDwmWebhookDelivery(row: DwmWebhookDeliveryRow) {
    const delivery = {
        id: row.id,
        destinationId: row.destination_id,
        ownerId: row.owner_id,
        orgId: row.org_id,
        alertId: row.alert_id,
        eventType: row.event_type,
        status: row.status,
        dryRun: row.dry_run,
        endpointHint: row.endpoint_hint,
        endpointHash: row.endpoint_hash,
        payloadHash: row.payload_hash,
        payload: row.payload,
        responseStatus: row.response_status,
        responseBody: row.response_body,
        error: row.error,
        errorClass: row.error_class,
        attemptCount: row.attempt_count ?? null,
        nextRetryAt: row.next_retry_at,
        idempotencyKey: row.idempotency_key,
        watchlistId: row.watchlist_id,
        watchlistName: row.watchlist_name,
        route: row.route,
        casePath: row.case_path,
        attemptedAt: row.attempted_at,
        completedAt: row.completed_at,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
        auditEventId: row.audit_event_id ?? null,
        auditAction: row.audit_action ?? null,
        auditActorId: row.audit_actor_id ?? null,
        reportValidation: row.report_validation ?? null,
        reportExportChecksum: row.report_export_checksum ?? null,
        reportCaseId: row.report_case_id ?? null,
    }
    return {
        ...delivery,
        ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    }
}

export function toDwmWebhookAuditEvent(row: DwmWebhookAuditRow) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        actorId: row.actor_id,
        orgId: row.org_id,
        destinationId: row.destination_id,
        deliveryId: row.delivery_id,
        action: row.action,
        metadata: row.metadata,
        createdAt: row.created_at,
    }
}
