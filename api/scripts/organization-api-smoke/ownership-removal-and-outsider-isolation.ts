import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { assertOwnershipTransferGuards } from './ownership-transfer-guards.ts'
import { assertMemberRemovalCleanup } from './member-removal-cleanup.ts'
import { assertRemovedMemberAccess } from './removed-member-access.ts'
import { assertOutsiderOrganizationIsolation } from './outsider-organization-isolation.ts'

export async function runOwnershipRemovalAndOutsiderIsolation(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await assertOwnershipTransferGuards(ctx, journey)
    await assertMemberRemovalCleanup(ctx, journey)
    await assertRemovedMemberAccess(ctx, journey)
    await assertOutsiderOrganizationIsolation(ctx, journey)
}
