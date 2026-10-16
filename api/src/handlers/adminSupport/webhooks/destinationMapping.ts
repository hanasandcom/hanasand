export function toSupportWebhookDestination(row: Record<string, unknown>) {
    return {
        schemaVersion: 'support.organization.webhook_destination.v1',
        id: row.id,
        organizationId: row.org_id,
        ownerId: row.owner_id,
        createdBy: row.created_by,
        name: row.name,
        kind: row.kind,
        status: row.status,
        endpointHint: row.endpoint_hint || null,
        endpointFingerprintPresent: Boolean(row.endpoint_fingerprint_present),
        events: Array.isArray(row.events) ? row.events : [],
        lastTestedAt: row.last_tested_at || null,
        lastTestStatus: row.last_test_status || null,
        lastTestErrorPresent: Boolean(row.last_test_error_present),
        lastTestHttpStatus: row.last_test_http_status || null,
        lastDeliveryAt: row.last_delivery_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        redacted: true,
        forbiddenFieldsExcluded: ['endpoint_encrypted', 'endpoint_url', 'secret', 'token', 'authorization'],
    }
}
