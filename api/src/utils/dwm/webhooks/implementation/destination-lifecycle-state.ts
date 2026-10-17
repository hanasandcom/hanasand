import { clean, recordOrEmpty } from '../../webhookValueUtils.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { type DwmWebhookDestinationPublic, isLiveDeliveredProof } from './webhook-contract-types.ts'
import { type buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { hasTerminalDeliveryFailure } from './destination-health-attempt.ts'
import { lifecycleStateActions } from './lifecycle-state-actions.ts'

export function destinationLifecycleState({
    destination,
    health,
    audits,
    canManage,
}: {
    destination: DwmWebhookDestinationPublic | null
    health: ReturnType<typeof buildDwmWebhookDestinationHealth>[number]
    audits: ReturnType<typeof buildDwmWebhookAuditEventContracts>
    canManage: boolean
}) {
    const endpointPresent = Boolean(health.redactedEndpoint.endpointHash || health.redactedEndpoint.endpointHint)
    const latestSecretAudit = audits.find((audit) => {
        if (audit.action !== 'destination.updated') return false
        const metadata = recordOrEmpty(audit.metadata)
        return Boolean(clean(metadata.endpointHash) || clean(metadata.endpointHint) || clean(metadata.endpointUrl) || clean(metadata.webhookUrl))
    }) || null
    const latestSecretUpdateAt = latestSecretAudit?.createdAt || null
    const lastTestAt = health.lastTest.at || null
    const secretRotated = Boolean(
        latestSecretUpdateAt
        && (!lastTestAt || String(latestSecretUpdateAt).localeCompare(String(lastTestAt)) > 0)
    )
    const revokedOwner = Boolean(destination?.createdBy && destination?.ownerId && destination.createdBy !== destination.ownerId)
    const failed = health.lastTest.status === 'failed' || hasTerminalDeliveryFailure(health.lastFailure)
    const verified = isLiveDeliveredProof(health.lastTest)
    const liveVerified = verified
    const liveDeliveryUnverified = health.enabled && endpointPresent && !liveVerified
    const testRequired = health.enabled && endpointPresent && (!verified || secretRotated)
    const states = [
        health.enabled ? null : 'disabled',
        failed ? 'failed' : null,
        revokedOwner ? 'revoked_owner' : null,
        secretRotated ? 'secret_rotated' : null,
        testRequired ? 'test_required' : null,
        liveDeliveryUnverified ? 'live_delivery_unverified' : null,
        health.enabled && endpointPresent && liveVerified && !failed && !revokedOwner && !secretRotated ? 'active' : null,
    ].filter(Boolean) as string[]
    const primary = states[0] || (health.enabled ? 'test_required' : 'disabled')
    const blockers = [
        !health.enabled ? lifecycleStateBlocker('disabled', 'Destination is disabled and will not receive alert deliveries.', health.destinationId, true) : null,
        failed ? lifecycleStateBlocker('failed', 'Latest destination test or delivery failed and needs remediation before live use.', health.destinationId, true) : null,
        revokedOwner ? lifecycleStateBlocker('revoked_owner', 'Destination was created by a user who no longer owns this destination record.', health.destinationId, true) : null,
        secretRotated ? lifecycleStateBlocker('secret_rotated', 'Webhook URL or secret reference changed after the last verified dry-run test.', health.destinationId, false) : null,
        testRequired ? lifecycleStateBlocker('test_required', 'Run a no-network dry-run test before relying on this destination.', health.destinationId, false) : null,
        liveDeliveryUnverified ? lifecycleStateBlocker('live_delivery_unverified', 'A successful live delivery has not been recorded for this destination.', health.destinationId, false) : null,
    ].filter(Boolean) as ReturnType<typeof lifecycleStateBlocker>[]

    return {
        schemaVersion: 'dwm.webhook.destination_lifecycle_state.v1',
        primary,
        states: [...new Set(states)],
        active: states.includes('active'),
        disabled: states.includes('disabled'),
        failed: states.includes('failed'),
        revokedOwner: states.includes('revoked_owner'),
        secretRotated: states.includes('secret_rotated'),
        testRequired: states.includes('test_required'),
        liveDeliveryUnverified: states.includes('live_delivery_unverified'),
        liveVerified,
        verified,
        secretState: endpointPresent ? 'redacted' : 'missing',
        ownerState: revokedOwner ? 'revoked_owner' : 'current',
        owner: {
            ownerId: canManage ? destination?.ownerId || null : null,
            createdBy: canManage ? destination?.createdBy || null : null,
            actorExposed: canManage,
        },
        rotation: {
            rotatedAt: latestSecretUpdateAt,
            auditEventId: latestSecretAudit?.auditEventId || null,
            lastVerifiedTestAt: lastTestAt,
            endpointHash: health.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        blockers,
        requiredActions: lifecycleStateActions({ destinationId: health.destinationId, blockers }),
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            actorExposed: canManage,
        },
    }
}

export function lifecycleStateBlocker(
    code: 'disabled' | 'failed' | 'revoked_owner' | 'secret_rotated' | 'test_required' | 'live_delivery_unverified',
    message: string,
    destinationId: string | null,
    blocking = false
) {
    return { code, message, destinationId, blocking }
}
