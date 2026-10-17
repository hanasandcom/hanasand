import type { buildDwmWebhookAlertDeliveryProof } from './alert-delivery-proof.ts'
import type { buildAlertDeliveryProofBlockers } from './alert-delivery-proof-blockers.ts'

type ProofInput = Parameters<typeof buildDwmWebhookAlertDeliveryProof>[0]
type BlockerSummary = ReturnType<typeof buildAlertDeliveryProofBlockers>

export function buildAlertDeliveryProofStatuses({
    customerSetup,
    alertDestinationReadiness,
    recordedDeliveryCount,
    blockingCodes,
    alertScopedBlockingCodes,
}: Pick<ProofInput, 'customerSetup' | 'alertDestinationReadiness'> & Pick<BlockerSummary,
    'recordedDeliveryCount' | 'blockingCodes' | 'alertScopedBlockingCodes'
>) {
    const status = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : blockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'
    const alertScopedStatus = customerSetup.status === 'permission_denied'
        ? 'permission_denied'
        : alertScopedBlockingCodes.length > 0
            ? 'blocked'
            : recordedDeliveryCount > 0
                ? 'recorded'
                : alertDestinationReadiness.ready
                    ? 'ready'
                    : 'needs_setup'
    return { status, alertScopedStatus }
}
