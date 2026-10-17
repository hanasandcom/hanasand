export const DWM_WEBHOOK_DELIVERY_INSERT = `
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
