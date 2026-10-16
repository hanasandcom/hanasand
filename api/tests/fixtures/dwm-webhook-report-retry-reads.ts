import { ledger, receiverAudits, state } from './dwm-webhook-report-retry-state.ts'

export function readDeliveryRows(sql: string, params: unknown[]) {
    const deliveries = [...(state.persistedDelivery ? [state.persistedDelivery] : []), ...ledger]
    if (sql.includes('FROM dwm_webhook_deliveries') && sql.includes('WHERE id = $1')) {
        return { rows: deliveries.filter(row => row.id === params[0] && row.org_id === params[1]) }
    }
    if (sql.includes('SELECT COUNT(*)::INT AS count')) {
        return { rows: [{
            count: deliveries.filter(row => row.org_id === params[0]
                && row.destination_id === params[1]
                && row.idempotency_key === params[2]
                && !row.dry_run && row.attempted_at).length,
        }] }
    }
    if (sql.includes('FROM dwm_webhook_destinations') && sql.includes('WHERE id = $1')) {
        if (params[0] === state.missingDestinationId) return { rows: [] }
        return { rows: [destinationRow()] }
    }
    if (sql.includes('FROM dwm_webhook_destinations') && sql.includes('status <> \'archived\'')) {
        return { rows: state.orgDestinations }
    }
    if (sql.includes('AND status IN (\'delivered\', \'failed\')')) {
        return { rows: deliveries.filter(row => row.org_id === params[0]
            && row.destination_id === params[1] && row.idempotency_key === params[2]
            && ['delivered', 'failed'].includes(row.status) && !row.dry_run && row.attempted_at)
            .sort((left, right) => String(right.attempted_at).localeCompare(String(left.attempted_at))).slice(0, 1) }
    }
    if (sql.includes('AND status = \'delivered\'')) {
        return { rows: deliveries.filter(row => row.org_id === params[0]
            && row.destination_id === params[1] && row.idempotency_key === params[2]
            && row.status === 'delivered' && !row.dry_run && row.attempted_at).slice(-1) }
    }
}

export function readReceiverAudits(sql: string, params: unknown[]) {
    if (!sql.includes('FROM dwm_webhook_audit_events') || !sql.includes('action = \'receiver.accepted\'')) return
    const matching = receiverAudits.filter(row => {
        if (params.length !== 5) return row.id === params[0] && row.org_id === params[1] && row.destination_id === params[2]
        if (row.org_id !== params[0]) return false
        if (sql.includes('destination_id = $2') && params[1] !== null && row.destination_id !== params[1]) return false
        if (sql.includes('delivery_id = $3') && params[2] !== null
            && row.delivery_id !== params[2] && row.metadata.deliveryId !== params[2]) return false
        if (sql.includes('metadata->>\'reportCaseId\' = $4') && params[3] !== null && row.metadata.reportCaseId !== params[3]) return false
        if (sql.includes('metadata->>\'reportExportChecksum\' = $5') && params[4] !== null
            && row.metadata.reportExportChecksum !== params[4]) return false
        return true
    })
    return { rows: matching.map(row => ({
        ...row,
        receiver_destination_status: state.receiverDestinationStatus,
        receiver_destination_endpoint_hash: state.receiverDestinationEndpointHash,
    })) }
}

function destinationRow() {
    return {
        id: 'destination_1', owner_id: 'owner_1', org_id: 'org_1', name: 'Receiver', kind: 'webhook',
        endpoint_encrypted: 'https://receiver.example/hook', endpoint_hint: 'receiver.example/...',
        endpoint_hash: state.destinationEndpointHash, status: 'active', events: ['dwm.alert.updated'],
        created_by: 'owner_1', last_tested_at: null, last_test_status: null, last_test_error: null,
        last_test_http_status: null, last_delivery_at: null, created_at: '2026-07-23T10:00:00.000Z',
        updated_at: '2026-07-23T10:00:00.000Z',
    }
}
