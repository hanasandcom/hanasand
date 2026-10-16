import run from '#db'
import type {
    DwmWebhookAuditRow,
    DwmWebhookDeliveryRow,
} from './webhookDestinationTypes.ts'
import { clean } from './webhookValueUtils.ts'
import { toDwmWebhookAuditEvent, toDwmWebhookDelivery } from './webhookDestinationModels.ts'

const deliveryAuditSelect = `
    SELECT deliveries.*,
           audit.id AS audit_event_id,
           audit.action AS audit_action,
           audit.actor_id AS audit_actor_id,
           audit.report_validation,
           audit.report_export_checksum,
           audit.report_case_id
    FROM dwm_webhook_deliveries deliveries
    LEFT JOIN LATERAL (
        SELECT id, action, actor_id,
               metadata->>'reportValidation' AS report_validation,
               metadata->>'reportExportChecksum' AS report_export_checksum,
               metadata->>'reportCaseId' AS report_case_id
        FROM dwm_webhook_audit_events
        WHERE delivery_id = deliveries.id
        ORDER BY (metadata->>'reportValidation' = 'valid') DESC NULLS LAST, created_at DESC
        LIMIT 1
    ) audit ON TRUE`

export async function listDwmWebhookDeliveries(ownerId: string, orgId?: string, filters: {
    alertId?: string
    reportCaseId?: string
    reportExportChecksum?: string
} = {}) {
    const alertId = clean(filters.alertId) || null
    const reportCaseId = clean(filters.reportCaseId) || null
    const reportExportChecksum = clean(filters.reportExportChecksum) || null
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            ${deliveryAuditSelect}
            WHERE deliveries.org_id = $1
              AND ($2::TEXT IS NULL OR deliveries.alert_id = $2)
              AND ($3::TEXT IS NULL OR (
                  audit.report_validation = 'valid'
                  AND audit.report_case_id = $3
              ))
              AND ($4::TEXT IS NULL OR audit.report_export_checksum = $4)
            ORDER BY deliveries.created_at DESC
            LIMIT 100
        `, [orgId, alertId, reportCaseId, reportExportChecksum])

        return (result.rows as DwmWebhookDeliveryRow[]).map(toDwmWebhookDelivery)
    }

    const result = await run(`
        ${deliveryAuditSelect}
        WHERE deliveries.owner_id = $1
          AND ($2::TEXT IS NULL OR deliveries.org_id = $2)
          AND ($3::TEXT IS NULL OR deliveries.alert_id = $3)
          AND ($4::TEXT IS NULL OR (
              audit.report_validation = 'valid'
              AND audit.report_case_id = $4
          ))
          AND ($5::TEXT IS NULL OR audit.report_export_checksum = $5)
        ORDER BY deliveries.created_at DESC
        LIMIT 100
    `, [ownerId, orgId || null, alertId, reportCaseId, reportExportChecksum])

    return (result.rows as DwmWebhookDeliveryRow[]).map(toDwmWebhookDelivery)
}

export async function listDwmWebhookAuditEvents(ownerId: string, orgId?: string) {
    if (orgId && orgId !== ownerId) {
        const result = await run(`
            SELECT *
            FROM dwm_webhook_audit_events
            WHERE org_id = $1
            ORDER BY created_at DESC
            LIMIT 100
        `, [orgId])

        return (result.rows as DwmWebhookAuditRow[]).map(toDwmWebhookAuditEvent)
    }

    const result = await run(`
        SELECT *
        FROM dwm_webhook_audit_events
        WHERE owner_id = $1
          AND ($2::TEXT IS NULL OR org_id = $2)
        ORDER BY created_at DESC
        LIMIT 100
    `, [ownerId, orgId || null])

    return (result.rows as DwmWebhookAuditRow[]).map(toDwmWebhookAuditEvent)
}
