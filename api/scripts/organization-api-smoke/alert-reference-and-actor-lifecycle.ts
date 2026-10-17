import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { assertAlertReferenceReadiness } from './alert-reference-readiness.ts'
import { assertAlertReferenceViewerAccess } from './alert-reference-viewer-access.ts'
import { assertAlertActorLifecycle } from './alert-actor-lifecycle.ts'

export async function runAlertReferenceAndActorLifecycle(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await assertAlertReferenceReadiness(ctx, journey)
    await assertAlertReferenceViewerAccess(ctx, journey)
    await assertAlertActorLifecycle(ctx, journey)
}
