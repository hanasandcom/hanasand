import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { runInviteManagementActions } from './invite-management-actions.ts'
import { runInviteBulkAndAcceptance } from './invite-bulk-and-acceptance.ts'

export async function runInviteLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await runInviteManagementActions(ctx, journey)
    await runInviteBulkAndAcceptance(ctx, journey)
}
