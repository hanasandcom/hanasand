import assert from 'node:assert/strict'
import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { assertReadinessOverview } from './assert-readiness-overview.ts'
import { assertReadinessWorkerProofs } from './assert-readiness-worker-proofs.ts'
import { assertReadinessMemberLifecycle, assertReadinessInviteLifecycle } from './assert-readiness-lifecycle-proofs.ts'
import { assertReadinessWorkspaceProofs, assertReadinessUiAuditProofs, assertReadinessSharedWatchlist } from './assert-readiness-operational-proofs.ts'
import { assertMemberAlertCaseDenial, assertMemberPortalVisibility } from './assert-member-visibility.ts'
import { assertAdminPortalAdapter, assertAdminWorkflowState, assertAdminReadiness } from './assert-admin-visibility.ts'
import { assertAdminQueueCaseVisibility, assertAdminPersistenceReadiness } from './assert-admin-downstream-contracts.ts'

export async function runAlertReadinessAndCaseVisibility(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    const { apiRequest, orgUtils, watchlists, authHeaders, parseBody, assertOrganizationTenantIdentity, organizationSummary } = ctx
    const { organization } = journey
    const assertionContext = { organization, assertOrganizationTenantIdentity }

    const readinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 200)
    const readiness = journey.readiness = parseBody(readinessResponse.body).alertReadiness
    assertReadinessOverview(readiness, assertionContext)
    assertReadinessWorkerProofs(readiness, assertionContext)
    assertReadinessMemberLifecycle(readiness)
    assertReadinessInviteLifecycle(readiness, assertionContext)
    assertReadinessWorkspaceProofs(readiness, assertionContext)
    assertReadinessUiAuditProofs(readiness, assertionContext)
    assertReadinessSharedWatchlist(readiness, assertionContext)
    const memberPortalVisibility = orgUtils.organizationAnalystPortalVisibilityAdapter(readiness.sharedWatchlistDownstreamProof, readiness.downstreamAuthorization)
    assertMemberPortalVisibility(memberPortalVisibility, readiness, assertionContext)

    const memberAlertCaseVisibilityResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-case-visibility?requestId=smoke-member-alert-case-denied`,
        headers: authHeaders('org_smoke_member', 'member-token'),
    }, 403)
    const memberAlertCaseVisibility = parseBody(memberAlertCaseVisibilityResponse.body).alertCaseVisibility
    assertMemberAlertCaseDenial(memberAlertCaseVisibility, assertionContext)

    await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-case-visibility`,
        headers: authHeaders('org_smoke_outsider', 'outsider-token'),
    }, 404)

    const adminReadinessResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-readiness`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const adminReadiness = parseBody(adminReadinessResponse.body).alertReadiness
    assertAdminReadiness(adminReadiness)

    const adminAlertCaseVisibilityResponse = await apiRequest({
        method: 'GET',
        url: `/api/organizations/${organization.id}/alert-case-visibility`,
        headers: authHeaders('org_smoke_admin', 'admin-token'),
    }, 200)
    const adminAlertCaseVisibility = journey.adminAlertCaseVisibility = parseBody(adminAlertCaseVisibilityResponse.body).alertCaseVisibility
    assertAdminPortalAdapter(adminAlertCaseVisibility, adminReadiness, assertionContext)
    assertAdminWorkflowState(adminAlertCaseVisibility, adminReadiness, assertionContext)
    assertAdminQueueCaseVisibility(adminAlertCaseVisibility, adminReadiness, assertionContext)
    assertAdminPersistenceReadiness(adminAlertCaseVisibility, assertionContext)

    const adapterContract = orgUtils.organizationWatchlistAlertGenerationContract(
        organizationSummary(organization.id, 'member'),
        [...watchlists.values()].filter(item => item.organization_id === organization.id && !item.archived_at)
    )
    assert.deepEqual(adapterContract, readiness.alertGenerationBridge)
}
