import { type lifecycleStateBlocker } from './destination-lifecycle-state.ts'

export function lifecycleStateActions({
    destinationId,
    blockers,
}: {
    destinationId: string
    blockers: ReturnType<typeof lifecycleStateBlocker>[]
}) {
    const codes = new Set(blockers.map(blocker => blocker.code))
    return {
        dryRunTest: codes.has('test_required') || codes.has('secret_rotated') || codes.has('failed')
            ? {
                route: `POST /api/dwm/webhook-destinations/${destinationId}/test`,
                method: 'POST',
                body: { dryRun: true, live: false },
                noNetworkDefault: true,
            }
            : null,
        updateDestination: codes.has('failed') || codes.has('revoked_owner')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                noNetworkDefault: true,
            }
            : null,
        enableDestination: codes.has('disabled')
            ? {
                route: `PATCH /api/dwm/webhook-destinations/${destinationId}`,
                method: 'PATCH',
                body: { status: 'active' },
                noNetworkDefault: true,
            }
            : null,
    }
}
