import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'

export async function runOrganizationSettingsContract(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, authHeaders, parseBody, assertOrganizationTenantIdentity } = ctx
    const { organization } = journey

    const memberSettingsUpdateResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: { ...authHeaders('org_smoke_member', 'member-token'), 'x-request-id': 'smoke-member-settings-denied' },
        payload: { alertVisibilityPolicy: 'admins' },
    }, 403)
    const memberSettingsDenied = parseBody(memberSettingsUpdateResponse.body).settingsMutationDenial
    assert.equal(memberSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
    assertOrganizationTenantIdentity(memberSettingsDenied, organization.id)
    assert.equal(memberSettingsDenied.actorId, 'org_smoke_member')
    assert.equal(memberSettingsDenied.actorRole, 'reader')
    assert.deepEqual(memberSettingsDenied.attemptedFields, ['alertVisibilityPolicy'])
    assert.equal(memberSettingsDenied.denialReason, 'role_not_allowed')
    assert.deepEqual(memberSettingsDenied.allowedRoles, ['owner', 'admin'])
    assert.deepEqual(memberSettingsDenied.readableRoles, ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'])
    assert.ok(memberSettingsDenied.editableFields.includes('defaultWebhookPolicy'))
    assert.ok(memberSettingsDenied.editableFields.includes('alertVisibilityPolicy'))
    assert.equal(memberSettingsDenied.memberCanReadSettings, true)
    assert.equal(memberSettingsDenied.memberCanUpdateSettings, false)
    assert.equal(memberSettingsDenied.viewerCanReadSettings, true)
    assert.equal(memberSettingsDenied.viewerCanUpdateSettings, false)
    assert.equal(memberSettingsDenied.nonmemberEnumeration, false)
    assert.ok(memberSettingsDenied.safeFields.includes('attemptedFields'))
    assert.ok(memberSettingsDenied.noLeakFields.includes('destination.secret'))
    assert.equal(memberSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
    assert.equal(memberSettingsDenied.requestId, 'smoke-member-settings-denied')
    assert.equal(memberSettingsDenied.proofCommand, 'cd api && bun scripts/smoke-organizations-api.ts')

    const viewerSettingsUpdateResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: { ...authHeaders('org_smoke_viewer', 'viewer-token'), 'x-request-id': 'smoke-viewer-settings-denied' },
        payload: { defaultWebhookPolicy: 'disabled' },
    }, 403)
    const viewerSettingsDenied = parseBody(viewerSettingsUpdateResponse.body).settingsMutationDenial
    assert.equal(viewerSettingsDenied.schemaVersion, 'organization.settings_mutation_denial.v1')
    assert.equal(viewerSettingsDenied.organizationId, organization.id)
    assert.equal(viewerSettingsDenied.actorId, 'org_smoke_viewer')
    assert.equal(viewerSettingsDenied.actorRole, 'reader')
    assert.deepEqual(viewerSettingsDenied.attemptedFields, ['defaultWebhookPolicy'])
    assert.equal(viewerSettingsDenied.denialReason, 'role_not_allowed')
    assert.equal(viewerSettingsDenied.viewerCanReadSettings, true)
    assert.equal(viewerSettingsDenied.viewerCanUpdateSettings, false)
    assert.equal(viewerSettingsDenied.nonmemberEnumeration, false)
    assert.equal(viewerSettingsDenied.serviceLogAction, 'organization_settings_mutation_denied')
    assert.equal(viewerSettingsDenied.requestId, 'smoke-viewer-settings-denied')

    const adminSettingsResponse = await apiRequest({
        method: 'PUT',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
        payload: {
            name: 'Smoke Shared Operations',
            slug: 'shared-ops',
            defaultWebhookPolicy: 'manual_selection',
            alertVisibilityPolicy: 'admins',
            retentionDays: 180,
            auditSafeMetadata: { region: 'EU', plan: 'team' },
        },
    }, 200)
    const adminSettings = parseBody(adminSettingsResponse.body)
    assert.equal(adminSettings.organization.name, 'Smoke Shared Operations')
    assert.equal(adminSettings.organization.slug, 'shared-ops')
    assert.equal(adminSettings.settings.defaultWebhookPolicy, 'manual_selection')
    assert.equal(adminSettings.settings.alertVisibilityPolicy, 'admins')
    assert.equal(adminSettings.settings.lifecycleStatus, 'active')
    assert.equal(adminSettings.settings.retentionDays, 180)
    assert.deepEqual(adminSettings.settings.auditSafeMetadata, { region: 'EU', plan: 'team' })
    assert.equal(adminSettings.permissions.canEdit, true)

    const memberReadUpdatedOrganizationResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const memberReadUpdatedOrganization = parseBody(memberReadUpdatedOrganizationResponse.body).organization
    assert.equal(memberReadUpdatedOrganization.name, 'Smoke Shared Operations')
    assert.equal(memberReadUpdatedOrganization.slug, 'shared-ops')
    assert.equal(memberReadUpdatedOrganization.role, 'reader')
    assert.equal(memberReadUpdatedOrganization.settings.defaultWebhookPolicy, 'manual_selection')
    assert.equal(memberReadUpdatedOrganization.settings.alertVisibilityPolicy, 'admins')
    assert.equal(memberReadUpdatedOrganization.settings.lifecycleStatus, 'active')
    const memberReadLifecycle = parseBody(memberReadUpdatedOrganizationResponse.body).lifecycleReadiness
    assert.equal(memberReadLifecycle.actorRole, 'reader')
    assert.equal(memberReadLifecycle.memberRoleReadiness.ownerCanMutate, false)
    assert.equal(memberReadLifecycle.memberRoleReadiness.adminCanMutate, false)
    assert.equal(memberReadLifecycle.memberRoleReadiness.memberCanReadAndExport, true)

    for (const [userId, token, canEdit] of [
        ['org_smoke_member', 'member-token', false],
        ['org_smoke_viewer', 'viewer-token', false],
    ] as const) {
        const readSettingsResponse = await apiRequest({
            method: 'GET',
            url: `/api/organizations/${organization.id}/settings`,
            headers: authHeaders(userId, token),
        }, 200)
        const readableSettings = parseBody(readSettingsResponse.body)
        assert.equal(readableSettings.settings.defaultWebhookPolicy, 'manual_selection')
        assert.equal(readableSettings.settings.alertVisibilityPolicy, 'admins')
        assert.equal(readableSettings.permissions.canEdit, canEdit)
        assert.equal(readableSettings.lifecycleReadiness.supportVisibility.mode, 'redacted_summary_only')
    }

    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/settings`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 404)

}
