import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { runMemberAccessContract } from './member-access-contract.ts'
import { runMemberRoleChanges } from './member-role-changes.ts'

export async function runMemberRoleContract(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await runMemberAccessContract(ctx, journey)
    await runMemberRoleChanges(ctx, journey)
}
