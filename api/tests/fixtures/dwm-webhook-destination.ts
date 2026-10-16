import type { DwmWebhookDestinationRow } from '../../src/utils/dwm/webhooks.ts'

export function dwmWebhookDestinationRow(): DwmWebhookDestinationRow {
    return {
        id: 'destination_1',
        owner_id: 'owner_1',
        org_id: 'org_1',
        name: 'Receiver',
        kind: 'webhook',
        endpoint_encrypted: 'https://receiver.example/hook',
        endpoint_hint: 'receiver.example/...',
        endpoint_hash: 'endpoint_hash_1',
        status: 'active',
        events: ['dwm.alert.updated'],
        created_by: 'owner_1',
        last_tested_at: null,
        last_test_status: null,
        last_test_error: null,
        last_test_http_status: null,
        last_delivery_at: null,
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-10-01T10:00:00.000Z',
    }
}
