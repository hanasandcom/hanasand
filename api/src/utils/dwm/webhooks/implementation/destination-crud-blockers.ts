import type { DwmWebhookDestinationInput, DwmWebhookKind } from '../../webhookDestinationTypes.ts'
import { parseBoolean, WEBHOOK_KINDS } from '../../webhookDestinationInput.ts'
import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import type { DwmWebhookDestinationCrudAction, DwmWebhookDestinationPublic } from './webhook-contract-types.ts'
import { crudBlocker } from './validate-webhook-endpoint-for-contract.ts'
import type { validateWebhookEndpointForContract } from './validate-webhook-endpoint-for-contract.ts'
import type { buildDwmWebhookDestinationAdminProof } from './destination-admin-proof.ts'

export function buildDestinationCrudBlockers({
    action,
    input,
    destination,
    rawKind,
    endpointValidation,
    normalizedOrgId,
    rawEndpoint,
    duplicate,
    canManage,
    entitlementAllowed,
    proofRow,
}: {
    action: DwmWebhookDestinationCrudAction
    input: DwmWebhookDestinationInput
    destination: DwmWebhookDestinationPublic | null
    rawKind: string
    endpointValidation: ReturnType<typeof validateWebhookEndpointForContract>
    normalizedOrgId: string
    rawEndpoint: string
    duplicate: DwmWebhookDestinationPublic | null
    canManage: boolean
    entitlementAllowed: boolean
    proofRow: ReturnType<typeof buildDwmWebhookDestinationAdminProof>['destinations'][number] | null
}) {
    const blockers: ReturnType<typeof crudBlocker>[] = []
    if (!canManage) blockers.push(crudBlocker('permission_denied', 'Only organization owners and admins can manage webhook destinations.', destination?.id || null))
    if (destination && normalizedOrgId !== destination.orgId) {
        blockers.push(crudBlocker('org_scope_mismatch', 'Webhook destinations cannot be moved between organizations. Create a new destination for the target organization.', destination.id))
    }
    if (!entitlementAllowed || parseBoolean(input.entitlementAllowed ?? input.entitlement_allowed, true) === false) {
        blockers.push(crudBlocker('entitlement_plan_denied', 'Current plan does not allow another webhook destination.', destination?.id || null))
    }
    if (endpointValidation.error && (rawEndpoint || action === 'create')) {
        blockers.push(crudBlocker('invalid_url', endpointValidation.error, destination?.id || null))
    }
    if (rawKind && !WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)) {
        blockers.push(crudBlocker('unsupported_destination_type', 'Destination type must be discord or webhook.', destination?.id || null))
    }
    if (duplicate && action === 'create') {
        blockers.push(crudBlocker('duplicate_destination', 'An active destination already uses this endpoint for the organization.', duplicate.id))
    }
    if ((action === 'update' || action === 'disable' || action === 'delete' || action === 'enable' || action === 'test') && !destination) {
        blockers.push(crudBlocker('permission_denied', 'Webhook destination is not available for this organization.', null))
    }
    if ((action === 'disable' || action === 'delete' || action === 'test') && destination?.status !== 'active') {
        blockers.push(crudBlocker('destination_disabled', 'Destination is disabled.', destination?.id || null, false, action === 'test'))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_live_endpoint')) {
        blockers.push(crudBlocker('invalid_url', 'Destination has no valid webhook URL reference.', destination?.id || null))
    }
    if ((action === 'test' || action === 'enable') && proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'no_verified_dry_run')) {
        blockers.push(crudBlocker('no_verified_dry_run', 'Destination has no verified dry-run delivery yet.', destination?.id || null, action === 'test', false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'destination_unhealthy')) {
        blockers.push(crudBlocker('unhealthy_destination', 'Destination health is blocked or retrying.', destination?.id || null, Boolean(proofRow.retry.retryable), false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'audit_missing')) {
        blockers.push(crudBlocker('audit_missing', 'Destination has no linked audit event.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'dedupe_already_delivered')) {
        blockers.push(crudBlocker('idempotency_duplicate', 'Latest destination delivery idempotency key has already been delivered.', destination?.id || null, false, false))
    }
    if (proofRow?.health.adminProofBlockers.some(blocker => blocker.code === 'retry_not_eligible')) {
        blockers.push(crudBlocker('retry_not_eligible', 'Latest failed or skipped delivery attempt is not eligible for retry.', destination?.id || null, false, false))
    }
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    return { uniqueBlockers, blocking: uniqueBlockers.filter(blocker => blocker.blocking) }
}
