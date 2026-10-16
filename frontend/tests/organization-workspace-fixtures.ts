export const fixtureOrganization = {
    id: 'org_acme',
    slug: 'acme-security',
    name: 'Acme Security',
    tenantId: 'tenant_acme',
    role: 'owner',
    status: 'active',
    memberCount: 2,
}

export const fixtureViewerOrganization = {
    id: 'org_contoso',
    slug: 'contoso',
    name: 'Contoso',
    tenantId: 'tenant_contoso',
    role: 'viewer',
    status: 'active',
    memberCount: 8,
}

export const fixtureMembers = [
    { userId: 'owner_acme', email: 'owner@acme.test', name: 'Acme Owner', role: 'owner', status: 'active', joinedAt: '2026-07-01T10:00:00.000Z' },
    { userId: 'analyst_acme', email: 'analyst@acme.test', name: 'Acme Analyst', role: 'member', status: 'active', joinedAt: '2026-07-02T10:00:00.000Z' },
    { userId: 'viewer_acme', email: 'viewer@acme.test', name: 'Acme Viewer', role: 'viewer', status: 'active', joinedAt: '2026-07-03T10:00:00.000Z' },
]

export const fixtureInvites = [
    { id: 'invite_acme_admin', email: 'admin@acme.test', role: 'admin', status: 'pending', createdAt: '2026-07-03T10:00:00.000Z', expiresAt: '2026-07-10T10:00:00.000Z', acceptancePath: '/organizations/invites/invite_acme_admin' },
    { id: 'invite_acme_former', email: 'former@acme.test', role: 'member', status: 'revoked', createdAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-09T10:00:00.000Z', acceptancePath: '/organizations/invites/invite_acme_former' },
]

export const fixtureWatchlists = [
    { id: 'watch_acme_domain', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'domain', value: 'acme.com', status: 'active', notes: 'Customer-owned domain', createdBy: 'owner_acme', updatedBy: 'owner_acme', updatedAt: '2026-07-01T09:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_domain', webhookEndpointHint: 'discord...acme', webhookEndpointHash: 'wh_hash_acme', webhookUrlConfigured: true },
    { id: 'watch_acme_vendor', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'Okta', status: 'paused', notes: 'Identity provider', createdBy: 'analyst_acme', updatedBy: 'analyst_acme', updatedAt: '2026-07-01T08:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_vendor' },
    { id: 'watch_acme_retired', organizationId: 'org_acme', tenantId: 'tenant_acme', kind: 'vendor', value: 'RetiredVendor', status: 'archived', notes: 'Retired supplier', createdBy: 'owner_acme', updatedBy: 'owner_acme', updatedAt: '2026-07-01T07:00:00.000Z', alertGenerationRef: 'org_acme:watch_acme_retired' },
]

export const fixtureContosoWatchlists = [
    { id: 'watch_contoso_domain', organizationId: 'org_contoso', tenantId: 'tenant_contoso', kind: 'domain', value: 'contoso.io', notes: 'Contoso domain monitoring', status: 'active', createdBy: 'viewer_contoso', updatedBy: 'viewer_contoso', createdAt: '2026-07-04T10:00:00.000Z', updatedAt: '2026-07-04T11:00:00.000Z', alertGenerationRef: 'org_contoso:watch_contoso_domain' },
]

export const fixtureDestinations = [
    { id: 'dest_acme_discord', name: 'SOC Discord', kind: 'discord', status: 'active', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', deliveryReady: true, createdAt: '2026-07-03T12:00:00.000Z', updatedAt: '2026-07-03T12:10:00.000Z' },
    { id: 'dest_acme_backup', name: 'Backup Webhook', kind: 'webhook', status: 'paused', endpointHint: 'webhook...backup', endpointHash: 'wh_hash_backup', deliveryReady: false, createdAt: '2026-07-03T11:00:00.000Z', updatedAt: '2026-07-03T11:10:00.000Z' },
]

export const fixtureAlerts = [
    { id: 'dwm_alert_acme', title: 'Acme credential exposure', severity: 'high', status: 'reviewing', watchlistItemId: 'watch_acme_domain', updatedAt: '2026-07-04T09:00:00.000Z' },
]

export const fixtureCases = [
    { id: 'case_acme_1', title: 'Credential exposure review', status: 'open', assignedOwner: 'analyst_acme', updatedAt: '2026-07-04T09:30:00.000Z' },
]

export const fixtureDeliveries = [
    { id: 'delivery_acme_1', alertId: 'dwm_alert_acme', caseId: 'case_acme_1', organizationId: 'org_acme', tenantId: 'tenant_acme', watchlistId: 'watch_acme_domain', webhookDestinationId: 'dest_acme_discord', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', requestId: 'req_acme_1', auditEventId: 'audit_acme_1', dedupeKey: 'dedupe_acme_1', attemptedAt: '2026-07-04T10:30:00.000Z', dryRun: true, payloadHash: 'payload_hash_acme', status: 'failed', httpStatus: 400, attemptCount: 2, nextRetryAt: '2026-07-04T10:45:00.000Z', deliveryKind: 'discord', errorClass: 'discord_validation_error', error: 'Discord rejected the request: invalid embeds.', responseSummary: 'Discord rejected the request: invalid embeds.', sanitizedPayloadPreview: { title: 'Acme credential exposure', descriptionPreview: 'High severity exposure for acme.com from dark web source.', fields: [{ name: 'Organization', valuePreview: 'Acme Security' }, { name: 'Watchlist', valuePreview: 'acme.com' }, { name: 'Severity', valuePreview: 'high' }, { name: 'Source family', valuePreview: 'darkweb' }], context: { orgName: 'Acme Security', alertTitle: 'Acme credential exposure', alertId: 'dwm_alert_acme', severity: 'high', sourceFamily: 'darkweb', evidenceCount: 2, evidenceTimestamp: '2026-07-04T09:20:00.000Z', watchlistName: 'acme.com', watchlistId: 'watch_acme_domain', matchReason: 'Customer-owned domain matched leaked credential context.', deliveryState: 'failed', casePath: '/cases/case_acme_1?alertId=dwm_alert_acme' } } },
    ...Array.from({ length: 14 }, (_, index) => ({ id: `delivery_acme_extra_${index}`, alertId: `dwm_alert_extra_${index}`, organizationId: 'org_acme', tenantId: 'tenant_acme', watchlistId: 'watch_acme_domain', webhookDestinationId: 'dest_acme_discord', endpointHint: 'discord...acme', endpointHash: 'wh_hash_acme', requestId: `req_acme_extra_${index}`, auditEventId: `audit_acme_extra_${index}`, dedupeKey: `dedupe_acme_extra_${index}`, attemptedAt: `2026-07-04T10:${String(index).padStart(2, '0')}:00.000Z`, dryRun: true, payloadHash: `payload_hash_extra_${index}`, status: 'dry_run', httpStatus: 204, attemptCount: 1, deliveryKind: 'discord' })),
]
