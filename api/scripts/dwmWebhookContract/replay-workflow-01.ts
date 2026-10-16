/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmAlertDeliveryPayload, buildDwmAlertWebhookDispatchPlan, buildDwmAlertWebhookNotificationInput } = webhooks
type DwmAlertWebhookTriggerOptions = webhooks.DwmAlertWebhookTriggerOptions

const replayWorkflowAlert = ctx.replayWorkflowAlert = {
    id: 'alert_replay_contract',
    title: 'Replay Acme credential exposure',
    severity: 'high',
    company: 'Acme Security',
    domain: 'acme-security.com',
    sourceFamily: 'telegram_public',
    claimSummary: 'Replay should resend the customer notification without changing analyst workflow state.',
    matchedTerm: { value: 'acme-security.com', kind: 'domain' },
    evidenceCount: 3,
    evidence: [
        { label: 'Public channel match', detail: 'Public channel message matched acme-security.com.', capturedAt: '2026-06-28T10:40:00.000Z' },
        { label: 'Credential paste', detail: 'Paste metadata included an Acme user identity.', capturedAt: '2026-06-28T10:42:00.000Z' },
        { label: 'Case enrichment', detail: 'Source capture linked the domain to the same campaign.', capturedAt: '2026-06-28T10:44:00.000Z' },
    ],
    dedupeKey: 'dwm_dedupe_replay_contract',
    route: 'identity_response',
    casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    alertUrl: 'https://app.hanasand.local/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
    reviewState: 'needs_review',
    deliveryState: 'ready_to_send',
    replayCount: 2,
    replayedAt: '2026-06-28T10:45:00.000Z',
    confidenceScore: 87,
    confidenceReason: 'Replay confidence comes from matched public source and case enrichment.',
    caseActionId: 'case_action_replay_contract',
    caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
    workflowContext: {
        caseIdCandidate: 'case_replay_contract',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
        dedupeKey: 'dwm_dedupe_replay_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        evidenceCount: 3,
        recommendedRoute: 'identity_response',
        captureIds: ['capture_replay_contract'],
        primaryCaptureId: 'capture_replay_contract',
    },
    webhookContext: {
        alertId: 'alert_replay_contract',
        organizationId: 'org_contract',
        watchlistItemIds: ['watchlist_item_replay_contract'],
        sourceFamily: 'telegram_public',
        evidenceCount: 3,
        dedupeKey: 'dwm_dedupe_replay_contract',
        recommendedRoute: 'identity_response',
        casePath: '/v1/cases/case_replay_contract?alertId=alert_replay_contract&dedupeKey=dwm_dedupe_replay_contract',
        caseActionId: 'case_action_replay_contract',
        caseActionPath: '/v1/cases/case_replay_contract/actions/case_action_replay_contract/replay',
        provenance: {
            captureIds: ['capture_replay_contract'],
            sourceIds: ['source_replay_contract'],
            primaryCaptureId: 'capture_replay_contract',
        },
    },
    watchlist: {
        id: 'watchlist_item_replay_contract',
        name: 'Replay contract watchlist',
        terms: ['acme-security.com'],
    },
}
const replayWorkflowBefore = ctx.replayWorkflowBefore = JSON.stringify(replayWorkflowAlert)
const workflowReplayHandoff: {
    ownerId: string
    alert: Record<string, unknown>
    options: DwmAlertWebhookTriggerOptions
} = ctx.workflowReplayHandoff = {
    ownerId: 'owner_contract',
    alert: replayWorkflowAlert,
    options: {
        eventType: 'dwm.alert.replayed',
        dryRun: true,
        live: false,
        destinationId: 'destination_replay_contract',
    },
}
const replayTriggerInput = ctx.replayTriggerInput = buildDwmAlertWebhookNotificationInput(workflowReplayHandoff.alert, {
    eventType: 'dwm.alert.replayed',
    dryRun: true,
})
const targetedReplayTriggerInput = ctx.targetedReplayTriggerInput = buildDwmAlertWebhookNotificationInput(workflowReplayHandoff.alert, workflowReplayHandoff.options)
const replayPlan = ctx.replayPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: workflowReplayHandoff.ownerId,
    input: replayTriggerInput,
    destinations: [
        {
            id: 'destination_replay_contract',
            org_id: 'org_contract',
            name: 'Replay Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created', 'dwm.alert.replayed'],
        },
    ],
})
const replayPayload = ctx.replayPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: replayPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: replayPlan.selectedDestinations[0].name,
        org_id: replayPlan.orgId,
    },
    eventType: replayPlan.eventType,
    deliveryId: 'delivery_replay_contract',
    alert: replayPlan.alert,
}) as Record<string, unknown>
const replayContext = ctx.replayContext = replayPayload._hanasand as Record<string, unknown>
const replayAlertContext = ctx.replayAlertContext = replayContext.alert as Record<string, unknown>
const replayDeliveryContext = ctx.replayDeliveryContext = replayContext.delivery as Record<string, unknown>
const replayWatchlistContext = ctx.replayWatchlistContext = replayContext.watchlist as Record<string, unknown>
const replaySerialized = ctx.replaySerialized = JSON.stringify(replayPayload)

expect(replayTriggerInput.organizationId === 'org_contract', 'Replay trigger input should map organization id from webhook context.', replayTriggerInput)
expect(replayTriggerInput.watchlistItemId === 'watchlist_item_replay_contract', 'Replay trigger input should map watchlist item id from workflow context.', replayTriggerInput)
expect(replayTriggerInput.sourceFamily === 'telegram_public', 'Replay trigger input should map source family.', replayTriggerInput)
expect(replayTriggerInput.casePath === replayWorkflowAlert.casePath, 'Replay trigger input should map case path.', replayTriggerInput)
expect((replayTriggerInput.alert as Record<string, unknown>).alertUrl === replayWorkflowAlert.alertUrl, 'Replay trigger input should map alert URL/deep link.', replayTriggerInput)
expect(replayTriggerInput.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay trigger input should map dedupe key.', replayTriggerInput)
expect(targetedReplayTriggerInput.destinationId === 'destination_replay_contract' && targetedReplayTriggerInput.dryRun === true && targetedReplayTriggerInput.live === false, 'Replay handoff should accept destination selection plus dry-run/live mode.', targetedReplayTriggerInput)
expect(replayPlan.selectedDestinations.length === 1, 'Replay dispatch should select the active org destination.', replayPlan)
expect(replayPlan.eventType === 'dwm.alert.replayed', 'Replay dispatch should preserve replay event type.', replayPlan)
expect(replayAlertContext.id === 'alert_replay_contract', 'Replay payload should link to the same alert id.', replayPayload)
expect(replayDeliveryContext.replay === true, 'Replay payload should mark delivery as replay.', replayPayload)
expect(replayDeliveryContext.dedupeKey === 'dwm_dedupe_replay_contract', 'Replay payload should link to the same alert dedupe key.', replayPayload)
expect(replayDeliveryContext.casePath === replayWorkflowAlert.casePath, 'Replay payload should link to the same case path.', replayPayload)
expect(replayDeliveryContext.alertUrl === replayWorkflowAlert.alertUrl, 'Replay payload should link to the alert URL/deep link.', replayPayload)
expect(replayContext.occurredAt === '2026-06-28T10:45:00.000Z' && replaySerialized.includes('Observed at'), 'Replay payload should preserve replay event timestamp.', replayPayload)
expect(replayAlertContext.deliveryState === 'ready_to_send', 'Replay payload should preserve alert delivery state.', replayPayload)
expect((replayAlertContext.confidence as Record<string, unknown>).label === '87%' && replaySerialized.includes('Replay confidence comes from matched public source'), 'Replay payload should preserve confidence context.', replayPayload)
expect((replayDeliveryContext.workflowState as Record<string, unknown>).delivery === 'ready_to_send' && replayDeliveryContext.replayCount === 2 && replaySerialized.includes('Workflow'), 'Replay payload should expose workflow and replay markers.', replayPayload)
expect(replayWatchlistContext.id === 'watchlist_item_replay_contract', 'Replay payload should preserve watchlist context.', replayPayload)
expect(replaySerialized.includes('dwm.alert.replayed:org_contract:destination_replay_contract:dwm_dedupe_replay_contract'), 'Replay payload should use event-scoped idempotency for the same dedupe key.', replayPayload)
expect(replaySerialized.includes('Evidence summary') && replaySerialized.includes('Credential paste'), 'Replay payload should include multi-evidence summary fields.', replayPayload)

const updatedTriggerInput = ctx.updatedTriggerInput = buildDwmAlertWebhookNotificationInput(replayWorkflowAlert, {
    eventType: 'dwm.alert.updated',
    dryRun: true,
    live: false,
})
const updatedPlan = ctx.updatedPlan = buildDwmAlertWebhookDispatchPlan({
    ownerId: workflowReplayHandoff.ownerId,
    input: updatedTriggerInput,
    destinations: [
        {
            id: 'destination_update_contract',
            org_id: 'org_contract',
            name: 'Alert update Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.updated'],
        },
        {
            id: 'destination_created_contract',
            org_id: 'org_contract',
            name: 'Created only Discord',
            kind: 'discord',
            status: 'active',
            events: ['dwm.alert.created'],
        },
    ],
})
const updatedPayload = ctx.updatedPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: updatedPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: updatedPlan.selectedDestinations[0].name,
        org_id: updatedPlan.orgId,
    },
    eventType: updatedPlan.eventType,
    deliveryId: 'delivery_update_contract',
    alert: updatedPlan.alert,
}) as Record<string, unknown>
const updatedSerialized = ctx.updatedSerialized = JSON.stringify(updatedPayload)
const updatedContext = ctx.updatedContext = updatedPayload._hanasand as Record<string, unknown>
const updatedDeliveryContext = ctx.updatedDeliveryContext = updatedContext.delivery as Record<string, unknown>
const updatedTemplate = ctx.updatedTemplate = updatedContext.discordTemplate as Record<string, unknown>
expect(updatedTriggerInput.eventType === 'dwm.alert.updated' && updatedTriggerInput.dryRun === true && updatedTriggerInput.live === false, 'Alert-updated trigger input should preserve dry-run/no-network delivery mode.', updatedTriggerInput)
expect(updatedPlan.eventType === 'dwm.alert.updated' && updatedPlan.selectedDestinations.map(item => item.id).join(',') === 'destination_update_contract', 'Alert-updated dispatch should select only destinations subscribed to update events.', updatedPlan)
