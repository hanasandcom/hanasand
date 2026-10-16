import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmAlertDeliveryPayload } = webhooks
const { replayContext, replayPlan, replayWorkflowAlert, replayWorkflowBefore, secret, updatedDeliveryContext, updatedPayload, updatedPlan, updatedSerialized, updatedTemplate } = ctx

expect(updatedPlan.skippedDestinations.some(item => item.id === 'destination_created_contract' && item.reason === 'event_not_subscribed'), 'Alert-updated dispatch should skip destinations that only subscribe to created alerts.', updatedPlan)
expect(updatedDeliveryContext.replay === false && updatedSerialized.includes('dwm.alert.updated:org_contract:destination_update_contract:dwm_dedupe_replay_contract'), 'Alert-updated Discord payload should use update-scoped idempotency without marking replay.', updatedPayload)
expect(updatedSerialized.includes('Workflow') && updatedSerialized.includes('updated') && !updatedSerialized.includes(secret), 'Alert-updated Discord payload should expose workflow context without leaking secrets.', updatedPayload)
expect(updatedTemplate.templateId === 'dwm.discord.alert_update.v1' && updatedTemplate.ready === true && (updatedTemplate.workflow as Record<string, unknown>).update === true, 'Alert-updated Discord payload should expose an update template contract.', updatedTemplate)
expect(JSON.stringify(replayWorkflowAlert) === replayWorkflowBefore, 'Replay dispatch/payload builders should not mutate alert workflow state.', replayWorkflowAlert)

const duplicateReplayPayload = ctx.duplicateReplayPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: replayPlan.selectedDestinations[0].id,
        kind: 'discord',
        name: replayPlan.selectedDestinations[0].name,
        org_id: replayPlan.orgId,
    },
    eventType: replayPlan.eventType,
    deliveryId: 'delivery_replay_duplicate_contract',
    alert: replayPlan.alert,
}) as Record<string, unknown>
const duplicateReplayContext = ctx.duplicateReplayContext = duplicateReplayPayload._hanasand as Record<string, unknown>
expect(duplicateReplayContext.idempotencyKey === replayContext.idempotencyKey, 'Duplicate replay payloads should keep the same alert/dedupe idempotency key.', duplicateReplayPayload)
