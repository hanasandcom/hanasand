import { afterEach, mock } from 'bun:test'
import { lockTails, ledger, receiverAudits, queries, resetDwmWebhookRetryState, setDatabaseRun, state } from './dwm-webhook-report-retry-state.ts'
import { readDeliveryRows, readReceiverAudits } from './dwm-webhook-report-retry-reads.ts'
import { writeDelivery, writeReceiverReceipt } from './dwm-webhook-report-retry-writes.ts'

const databaseRun = async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (isDestinationStatusTouch(sql)) return { rows: [], rowCount: 1 }
    if (isDestinationDeliveryTouch(sql)) return { rows: [], rowCount: 1 }
    if (isDeliveryAuditInsert(sql)) return { rows: [], rowCount: 1 }
    if (isReportDeliveryList(sql)) return { rows: [] }
    return readDeliveryRows(sql, params)
        ?? readReceiverAudits(sql, params)
        ?? writeReceiverReceipt(sql, params)
        ?? writeDelivery(sql, params)
        ?? unexpectedDwmWebhookQuery(sql)
}

function isDestinationStatusTouch(sql: string) {
    return sql.replace(/\s+/g, ' ').trim() === `UPDATE dwm_webhook_destinations
               SET last_tested_at = CASE WHEN $2 THEN NOW() ELSE last_tested_at END,
                   last_test_status = CASE WHEN $2 THEN $3 ELSE last_test_status END,
                   last_test_error = CASE WHEN $2 THEN $4 ELSE last_test_error END,
                   last_test_http_status = CASE WHEN $2 THEN $5 ELSE last_test_http_status END,
                   last_delivery_at = CASE WHEN $6 THEN $7::timestamptz ELSE last_delivery_at END,
                   updated_at = NOW()
             WHERE id = $1`.replace(/\s+/g, ' ').trim()
}

function isDeliveryAuditInsert(sql: string) {
    return sql.replace(/\s+/g, ' ').trim() === `INSERT INTO dwm_webhook_audit_events (
            id,
            owner_id,
            actor_id,
            org_id,
            destination_id,
            delivery_id,
            action,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`.replace(/\s+/g, ' ').trim()
}

function isDestinationDeliveryTouch(sql: string) {
    return sql.replace(/\s+/g, ' ').trim() === `UPDATE dwm_webhook_destinations
               SET last_delivery_at = $2::timestamptz,
                   updated_at = NOW()
             WHERE id = $1`.replace(/\s+/g, ' ').trim()
}

function isReportDeliveryList(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    const expected = `SELECT deliveries.*,
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
    ) audit ON TRUE
    WHERE deliveries.org_id = $1
      AND ($2::TEXT IS NULL OR deliveries.alert_id = $2)
      AND ($3::TEXT IS NULL OR (
          audit.report_validation = 'valid'
          AND audit.report_case_id = $3
      ))
      AND ($4::TEXT IS NULL OR audit.report_export_checksum = $4)
    ORDER BY deliveries.created_at DESC
    LIMIT 100`.replace(/\s+/g, ' ').trim()
    return normalized === expected
}

function unexpectedDwmWebhookQuery(sql: string): never {
    throw new Error(`Unexpected DWM webhook test SQL query:\n${sql}`)
}
setDatabaseRun(databaseRun)

mock.module('#db', () => ({
    withTransaction: async <T>(work: (query: typeof databaseRun) => Promise<T>) => {
        const ledgerLength = ledger.length
        const priorInserted = state.insertedDelivery
        const priorReceiptIds = receiverAudits.map(row => row.delivery_id)
        try {
            return await work(databaseRun)
        } catch (error) {
            ledger.splice(ledgerLength)
            state.insertedDelivery = priorInserted
            receiverAudits.forEach((row, index) => { row.delivery_id = priorReceiptIds[index] })
            throw error
        }
    },
    withDatabaseAdvisoryLock: async <T>(key: string, work: () => Promise<T>) => {
        const previous = lockTails.get(key) || Promise.resolve()
        let release = () => {}
        const current = new Promise<void>(resolve => { release = resolve })
        lockTails.set(key, previous.then(() => current))
        await previous
        try { return await work() } finally { release() }
    },
    default: databaseRun,
}))

afterEach(resetDwmWebhookRetryState)
