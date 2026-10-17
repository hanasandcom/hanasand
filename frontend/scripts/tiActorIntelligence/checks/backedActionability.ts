import { assert } from '../assert'
import { backed } from '../fixtures/backed'
import { consumerRequestFields } from '../../../src/app/ti/consumerReadiness'

assert(backed.shouldAlert, 'Backed alert/case fixture should be alertable.')
assert(backed.relatedCases[0]?.id === 'case_1', 'Backed actionability should preserve related case IDs.')
assert(backed.handoffs.casePayload?.alertId === 'dwm_alert_1', 'Backed actionability should produce a case handoff payload.')
assert(backed.exportPayloads.case.body.alertId === 'dwm_alert_1', 'Backed case export should carry the DWM alert ID.')
assert(!backed.exportPayloads.case.blocked, 'Backed case export should be open when the case draft has no blockers.')
assert(backed.createAlertHandoff.ready, 'Backed alert handoff should be ready when watchlist context exists.')
assert(backed.caseHandoff.ready, 'Backed case handoff should be ready when the case draft has no blockers.')
assert(backed.caseHandoff.backedRoute === '/v1/cases/case_1?alertId=dwm_alert_1', 'Backed case handoff should preserve the open case route.')
assert(backed.webhookDeliveryHandoff.ready, 'Backed webhook delivery should be ready when alert, capture, and destination context exists.')
assert(backed.exportPayloads.webhookDelivery.body.alertId === 'dwm_alert_1', 'Backed webhook delivery should carry the DWM alert ID.')
assert(JSON.stringify(backed.exportPayloads.webhookDelivery.body).includes('webhook_1'), 'Backed webhook delivery should carry destination IDs.')
assert(backed.readiness.backedIds.organizationIds.includes('org_1'), 'Backed readiness should carry organization IDs.')
assert(backed.readiness.backedIds.watchlistIds.includes('watchlist_1'), 'Backed readiness should carry watchlist IDs.')
assert(backed.readiness.backedIds.alertIds.includes('dwm_alert_1'), 'Backed readiness should carry alert IDs.')
assert(backed.readiness.backedIds.casePaths.includes('/v1/cases/case_1?alertId=dwm_alert_1'), 'Backed readiness should carry case paths.')
assert(backed.readiness.backedIds.captureIds.includes('capture_1'), 'Backed readiness should carry capture IDs.')
assert(backed.readiness.backedIds.webhookDestinationIds.includes('webhook_1'), 'Backed readiness should carry webhook destination IDs.')
assert(backed.orgRelevance.watchlistIntersections.some(item =>
    item.value === 'Microsoft'
    && item.state === 'ready'
    && item.organizationId === 'org_1'
    && item.watchlistId === 'watchlist_1'
    && item.watchlistItemId === 'watch_1'
    && item.alertIds.includes('dwm_alert_1')
    && item.casePaths.includes('/v1/cases/case_1?alertId=dwm_alert_1')
    && item.captureIds.includes('capture_1')
    && item.webhookDestinationIds.includes('webhook_1')
    && item.recommendedAction === 'open_case'
), 'Backed org relevance should carry customer watchlist/source/alert/case intersections.')
assert(JSON.stringify(backed.actionPayloads.payloads.analystHandoffBundle.body).includes('watchlistIntersections'), 'Backed analyst handoff should export watchlist intersections.')
assert(backed.readiness.blockers.some(blocker => blocker.code === 'unavailable_contract' && blocker.ownerLane === 'entitlement'), 'Backed readiness should call out missing entitlement readiness when org context exists.')
assert(backed.consumerReadiness.ready, 'Backed consumer readiness should be ready when watchlist, alert, case, capture, and webhook context exist.')
assert(backed.consumerReadiness.stages.every(stage => stage.state === 'ready'), 'Backed consumer readiness stages should all be ready.')
assert(backed.consumerReadiness.bundlePreview.stages.orgWatchlist?.request?.body.watchlistId === 'watchlist_1', 'Consumer readiness should carry persisted watchlist ID for alert rebuild.')
assert(backed.consumerReadiness.bundlePreview.stages.webhookTrigger?.request?.body.idempotencyKey, 'Webhook consumer readiness should carry idempotency key.')
assert(backed.actionPayloads.payloads.watchlistAdd.body.backedIds && JSON.stringify(backed.actionPayloads.payloads.watchlistAdd.body.backedIds).includes('watchlist_1'), 'Backed watchlist action export should carry persisted watchlist IDs.')
assert(JSON.stringify(backed.actionPayloads.payloads.caseHandoff.body).includes('dwm_alert_1'), 'Backed case action export should carry related alert IDs.')
assert(JSON.stringify(backed.actionPayloads.payloads.webhookDelivery.body).includes('webhook_1'), 'Backed webhook action export should carry destination IDs.')
assert(backed.actionPayloads.payloads.webhookDelivery.blockedBy.some(blocker => blocker.code === 'unavailable_contract' && blocker.ownerLane === 'webhook'), 'Backed webhook action export should be honest when delivery readiness context is missing.')
assert(backed.actionPayloads.payloads.analystHandoffBundle.blockedBy.some(blocker => blocker.ownerLane === 'entitlement'), 'Backed analyst bundle should include entitlement-owned blockers when entitlement readiness is absent.')

const webhookStage = backed.consumerReadiness.stages.find(stage => stage.id === 'webhookTrigger')
if (!webhookStage?.request) throw new Error('Backed webhook consumer stage should include a request.')
const readyIdempotency = consumerRequestFields(webhookStage).find(field => field.label === 'Idempotency')
assert(readyIdempotency?.state === 'ready', 'Webhook consumer readiness should mark a present idempotency key ready.')
const requestBodyWithoutKey = Object.fromEntries(
    Object.entries(webhookStage.request.body).filter(([key]) => key !== 'idempotencyKey'),
)
const missingKeyStage = {
    ...webhookStage,
    request: { ...webhookStage.request, body: requestBodyWithoutKey },
}
const missingIdempotency = consumerRequestFields(missingKeyStage).find(field => field.label === 'Idempotency')
assert(missingIdempotency?.state === 'blocked', 'Webhook consumer readiness should block when its idempotency key is absent.')
