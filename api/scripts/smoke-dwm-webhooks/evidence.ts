import run from '#db'
import {
    buildDwmWebhookDeliveryEvidence,
    filterDwmWebhookDeliveryEvidenceForVisibility,
} from '#utils/dwm/webhooks.ts'
import { SmokeAlert } from './alert.ts'
import { SmokeDestination } from './destination.ts'
import { exerciseDeliveries } from './deliveries.ts'
import { endpointSecret, expect, orgId, suffix } from './state.ts'

type DeliveryResults = Awaited<ReturnType<typeof exerciseDeliveries>>

export async function verifyEvidence(destination: SmokeDestination, alert: SmokeAlert, results: DeliveryResults) {
    const evidence = buildDwmWebhookDeliveryEvidence({ deliveries: results.deliveries, auditEvents: results.auditEvents })
    const replay = evidence.find(item => item.alertId === alert.id && item.eventType === 'dwm.alert.replayed')
    const skippedLive = evidence.find(item => item.alertId === alert.id && item.status === 'skipped')
    const test = evidence.find(item => item.deliveryId === results.testDelivery.id)
    verifyEvidenceDetails(evidence, replay, skippedLive, test, destination, alert.casePath)
    verifyFiltersAndVisibility(evidence, replay, alert, destination, results)
    await verifyAuditRows()
}

function verifyEvidenceDetails(
    evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>,
    replay: ReturnType<typeof buildDwmWebhookDeliveryEvidence>[number] | undefined,
    skippedLive: ReturnType<typeof buildDwmWebhookDeliveryEvidence>[number] | undefined,
    test: ReturnType<typeof buildDwmWebhookDeliveryEvidence>[number] | undefined,
    destination: SmokeDestination,
    casePath: string,
) {
    expect(evidence.length >= 3, 'Delivery evidence view should include persisted attempts.', evidence)
    expect(replay?.destinationId === destination.id, 'Replay evidence should include destination id.', replay)
    expect(replay?.requestId && replay.requestId === replay.deliveryId, 'Replay evidence should include stable request id.', replay)
    expect(replay?.status === 'dry_run' && replay.dryRun === true && replay.live === false && replay.liveRequested === false, 'Replay evidence should distinguish dry-run replay.', replay)
    expect(replay?.replay === true, 'Replay evidence should mark replay attempts.', replay)
    expect(replay?.dedupeKey === `dwm_dedupe_${suffix}`, 'Replay evidence should expose alert dedupe key.', replay)
    expect(replay?.casePath === casePath, 'Replay evidence should expose case path.', replay)
    expect(replay?.watchlistId === 'watchlist-acme', 'Replay evidence should include watchlist id.', replay)
    expect(replay?.redactedDestination.endpointHint.includes('/api/webhooks/1234567890/...'), 'Evidence should include redacted Discord destination.', replay)
    expect(replay?.redactedDestination.endpointHash?.startsWith('endpoint_'), 'Evidence should include destination hash.', replay)
    expect(replay?.payloadHash?.startsWith('payload_'), 'Evidence should include payload hash.', replay)
    expect(replay?.auditEventId, 'Replay evidence should link to the audit event id.', replay)
    expect(replay?.auditAction === 'delivery.replayed', 'Replay evidence should expose audit action.', replay)
    expect(skippedLive?.liveRequested === true && skippedLive.live === false && skippedLive.status === 'skipped', 'Skipped live evidence should show no external send occurred.', skippedLive)
    expect(String(skippedLive?.error || '').includes('Live DWM webhook delivery is disabled'), 'Skipped live evidence should preserve safety-gate error.', skippedLive)
    expect(test?.status === 'dry_run' && test.replay === false, 'Test evidence should remain dry-run non-replay.', test)
    expect(!JSON.stringify(evidence).includes(endpointSecret), 'Delivery evidence leaked Discord endpoint secret.', evidence)
}

function verifyFiltersAndVisibility(
    evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>,
    replay: ReturnType<typeof buildDwmWebhookDeliveryEvidence>[number] | undefined,
    alert: SmokeAlert,
    destination: SmokeDestination,
    results: DeliveryResults,
) {
    const filter = (filters: Parameters<typeof buildDwmWebhookDeliveryEvidence>[0]['filters']) =>
        buildDwmWebhookDeliveryEvidence({ deliveries: results.deliveries, auditEvents: results.auditEvents, filters })
    const byOrg = filter({ orgId })
    const byWrongOrg = filter({ orgId: `${orgId}_wrong` })
    const byDestination = filter({ destinationId: destination.id })
    const byAlert = filter({ alertId: alert.id })
    const byCasePath = filter({ casePath: alert.casePath })
    const byDedupe = filter({ dedupeKey: `dwm_dedupe_${suffix}` })
    const byIdempotency = filter({ dedupeKey: replay?.idempotencyKey })
    expect(byOrg.length === evidence.length, 'Org evidence filter should include org-scoped attempts.', { byOrg, evidence })
    expect(byWrongOrg.length === 0, 'Org evidence filter should exclude wrong-org attempts.', byWrongOrg)
    expect(byDestination.length === evidence.length, 'Destination evidence filter should include all attempts for the destination.', byDestination)
    expect(byAlert.length >= 2 && byAlert.every(item => item.alertId === alert.id), 'Alert evidence filter should include replay and skipped attempts for the alert.', byAlert)
    expect(byCasePath.some(item => item.requestId === replay?.requestId), 'Case path evidence filter should include replay attempt.', byCasePath)
    expect(byDedupe.length === 1 && byDedupe[0].requestId === replay?.requestId, 'Dedupe evidence filter should isolate replay attempt.', byDedupe)
    expect(byIdempotency.length === 1 && byIdempotency[0].requestId === replay?.requestId, 'Idempotency evidence filter should isolate replay attempt.', byIdempotency)

    verifyVisibility(evidence)
}

function verifyVisibility(evidence: ReturnType<typeof buildDwmWebhookDeliveryEvidence>) {
    type Visibility = Parameters<typeof filterDwmWebhookDeliveryEvidenceForVisibility>[0]['visibility']
    const check = (role: Visibility['role'], status: Visibility['status'], userActive: boolean, policy: Visibility['alertVisibilityPolicy']) =>
        filterDwmWebhookDeliveryEvidenceForVisibility({
            evidence,
            visibility: { role, status, userActive, alertVisibilityPolicy: policy },
        })
    const member = check('member', 'active', true, 'members')
    const nonmember = check(null, null, true, 'members')
    const removed = check('admin', 'removed', true, 'members')
    const deactivated = check('owner', 'active', false, 'members')
    const memberUnderAdminPolicy = check('member', 'active', true, 'admins')
    const adminUnderAdminPolicy = check('admin', 'active', true, 'admins')
    expect(member.deliveryEvidence.length === evidence.length, 'Members visibility policy should allow active members to read evidence.', member)
    expect(nonmember.decision.reason === 'not_member' && nonmember.deliveryEvidence.length === 0, 'Visibility should deny nonmembers/wrong org.', nonmember)
    expect(removed.decision.reason === 'member_removed' && removed.deliveryEvidence.length === 0, 'Visibility should deny removed members.', removed)
    expect(deactivated.decision.reason === 'member_deactivated' && deactivated.deliveryEvidence.length === 0, 'Visibility should deny deactivated members.', deactivated)
    expect(memberUnderAdminPolicy.decision.reason === 'role_not_allowed' && memberUnderAdminPolicy.deliveryEvidence.length === 0, 'Admin-only visibility policy should deny members.', memberUnderAdminPolicy)
    expect(adminUnderAdminPolicy.decision.allowed === true && adminUnderAdminPolicy.deliveryEvidence.length === evidence.length, 'Admin-only visibility policy should allow admins.', adminUnderAdminPolicy)
}

async function verifyAuditRows() {
    const audit = await run(`
        SELECT action, metadata
        FROM dwm_webhook_audit_events
        WHERE org_id = $1
        ORDER BY created_at ASC
    `, [orgId])
    const actions = audit.rows.map((row: { action: string }) => row.action)
    expect(actions.includes('destination.created'), 'Destination create audit event missing.', actions)
    expect(actions.includes('delivery.tested'), 'Test delivery audit event missing.', actions)
    expect(actions.includes('delivery.replayed'), 'Replay delivery audit event missing.', actions)
    expect(actions.includes('delivery.skipped'), 'Skipped live delivery audit event missing.', actions)
    expect(!JSON.stringify(audit.rows).includes(endpointSecret), 'Audit metadata leaked webhook secret.', audit.rows)
}
