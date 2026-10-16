import { ledger, receiverAudits, state } from './dwm-webhook-report-retry-state.ts'

export function writeReceiverReceipt(sql: string, params: unknown[]) {
    if (sql.includes('INSERT INTO dwm_webhook_audit_events') && sql.includes('\'receiver.accepted\'')) {
        if (state.receiverDestinationStatus !== 'active' || params[4] !== state.receiverDestinationEndpointHash) return { rows: [] }
        if (receiverAudits.some(row => row.id === params[0])) return { rows: [] }
        const row = {
            id: params[0], owner_id: 'owner_1', actor_id: null, org_id: params[1], destination_id: params[2],
            delivery_id: null, action: 'receiver.accepted', metadata: JSON.parse(String(params[3])),
            created_at: '2026-07-24T10:00:01.000Z',
        }
        receiverAudits.push(row)
        return { rows: [row] }
    }
    if (sql.includes('UPDATE dwm_webhook_audit_events') && sql.includes('metadata->>\'receiverTargetHash\'')) {
        if (state.failReceiptBind) throw new Error('simulated receipt bind failure')
        const deliveries = [...(state.persistedDelivery ? [state.persistedDelivery] : []), ...ledger]
        const row = receiverAudits.find(candidate => candidate.org_id === params[1]
            && candidate.destination_id === params[2]
            && candidate.metadata.idempotencyKey === params[3]
            && candidate.metadata.payloadHash === params[4]
            && candidate.metadata.receiverTargetHash === params[5]
            && (candidate.delivery_id === null || priorFailedDelivery(candidate, params, deliveries)))
        if (!row) return { rows: [] }
        row.delivery_id = params[0]
        return { rows: [{ id: row.id }] }
    }
}

export function writeDelivery(sql: string, params: unknown[]) {
    if (!sql.includes('INSERT INTO dwm_webhook_deliveries')) return
    const skipped = sql.includes('\'skipped\'')
    const row = skipped ? {
        id: params[0], destination_id: params[1], owner_id: params[2], org_id: params[3], alert_id: params[4],
        event_type: params[5], status: 'skipped', dry_run: Boolean(params[6]), endpoint_hint: params[7],
        endpoint_hash: params[8], payload_hash: params[9], payload: JSON.parse(String(params[10])),
        response_status: null, response_body: null, error: params[11], error_class: params[12],
        attempt_count: params[13], next_retry_at: null, idempotency_key: params[14], watchlist_id: params[15],
        watchlist_name: params[16], route: params[17], case_path: params[18], attempted_at: null,
        completed_at: null, delivered_at: null, created_at: new Date().toISOString(),
    } : {
        id: params[0], destination_id: params[1], owner_id: params[2], org_id: params[3], alert_id: params[4],
        event_type: params[5], status: params[6], dry_run: Boolean(params[7]), endpoint_hint: params[8],
        endpoint_hash: params[9], payload_hash: params[10], payload: JSON.parse(String(params[11])),
        response_status: params[12], response_body: params[13], error: params[14], error_class: params[15],
        attempt_count: params[16], next_retry_at: params[17], idempotency_key: params[18], watchlist_id: params[19],
        watchlist_name: params[20], route: params[21], case_path: params[22], attempted_at: params[23],
        completed_at: params[24], delivered_at: params[25], created_at: new Date().toISOString(),
    }
    ledger.push(row)
    state.insertedDelivery = row
    return { rows: [row] }
}

function priorFailedDelivery(candidate: any, params: unknown[], deliveries: Array<Record<string, any>>) {
    return params[6] === 'delivered' && deliveries.some(prior => prior.id === candidate.delivery_id
        && prior.org_id === params[1] && prior.destination_id === params[2] && prior.status === 'failed'
        && !prior.dry_run && prior.idempotency_key === params[3] && prior.payload_hash === params[4]
        && prior.endpoint_hash === params[5])
}
