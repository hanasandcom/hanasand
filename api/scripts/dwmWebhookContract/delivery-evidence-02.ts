/* eslint-disable @typescript-eslint/no-unused-vars -- fixture values are consumed by later sequential modules */
import { webhooks, context as ctx } from './runtime.ts'
const { buildDwmWebhookDeliveryEvidence } = webhooks
const { evidenceRows, replayEvidence, replayWorkflowAlert } = ctx

const orgEvidence = ctx.orgEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { orgId: 'org_contract' } })
const destinationEvidence = ctx.destinationEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { destinationId: 'destination_live_contract' } })
const casePathEvidence = ctx.casePathEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { casePath: replayWorkflowAlert.casePath } })
const caseActionEvidence = ctx.caseActionEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { caseActionId: replayWorkflowAlert.caseActionId } })
const caseActionPathEvidence = ctx.caseActionPathEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { caseActionPath: replayWorkflowAlert.caseActionPath } })
const dedupeEvidence = ctx.dedupeEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { dedupeKey: 'dwm_dedupe_replay_contract' } })
const idempotencyEvidence = ctx.idempotencyEvidence = buildDwmWebhookDeliveryEvidence({ deliveries: evidenceRows, filters: { dedupeKey: replayEvidence?.idempotencyKey } })
