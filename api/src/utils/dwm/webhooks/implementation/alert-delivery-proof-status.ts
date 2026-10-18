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
    const statusFor = (codes: typeof blockingCodes) => {
        if (customerSetup.status === 'permission_denied') return 'permission_denied'
        if (codes.length > 0) return 'blocked'
        if (recordedDeliveryCount > 0) return 'recorded'
        return alertDestinationReadiness.ready ? 'ready' : 'needs_setup'
    }

    return {
        status: statusFor(blockingCodes),
        alertScopedStatus: statusFor(alertScopedBlockingCodes),
    }
}
