import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = read('dashboard/cases/[id]/case-detail-client.tsx')
const data = read('dashboard/cases/[id]/case-detail/useCaseDetailData.ts')
const actions = read('dashboard/cases/[id]/case-detail/useCaseDetailActions.ts')
const model = read('dashboard/cases/[id]/case-detail/model.ts')
const constants = read('dashboard/cases/[id]/case-detail/constants.ts')
const ui = [
    read('dashboard/cases/[id]/case-detail/CaseEvidenceTimeline.tsx'),
    read('dashboard/cases/[id]/case-detail/CaseDeliveryPanels.tsx'),
    read('dashboard/cases/[id]/case-detail/CaseActionPanel.tsx'),
    read('dashboard/cases/[id]/case-detail/CaseDetailWorkspace.tsx'),
    read('dashboard/cases/[id]/case-detail/CaseHeader.tsx'),
    read('dashboard/cases/[id]/case-detail/presentation.tsx'),
].join('\n')
const pageSource = read('dashboard/cases/[id]/page.tsx')
const deliveryRouteSource = read('api/findings/webhooks/deliver/route.ts')

test('DWM case detail preserves scoped data, evidence selection, and receiver traceability', () => {
    assert.match(client, /initialDetail\?: CaseDetail/)
    assert.match(data, /loading: !initialDetail/)
    assert.match(data, /detail: initialDetail/)
    assert.match(data, /fetch\(`\/api\/cases\/\$\{encodeURIComponent\(caseId\)\}\$\{query\}`/)
    assert.match(data, /shape: 'full'/)
    assert.match(data, /reportCaseId: caseId/)
    assert.match(data, /thirdPartyReport === true && row\.reportCaseId === caseId/)
    assert.match(data, /destinationRowsFromApi\(destinationPayload\)/)
    assert.match(data, /receiverReceiptRowsFromApi\(receiverPayload\)/)
    assert.match(data, /setSelectedDestinationId\(previous => related\.destinations\.some\(destination => destination\.id === previous\) \? previous : ''\)/)
    assert.match(data, /setSelectedEvidenceIds\(previous => previous\.filter\(id => availableIds\.includes\(id\)\)\)/)
    assert.match(model, /DWM_CASE_REPORT_MAX_EVIDENCE/)
    assert.match(model, /safeEvidenceExcerpt\(row\.safeExcerpt \|\| row\.excerpt/)
    assert.match(ui, /data-dwm-case-evidence-mobile-list='true'/)
    assert.match(ui, /data-dwm-case-evidence-mobile-row='true'/)
    assert.match(ui, /data-dwm-case-evidence-desktop-table='true'/)
    assert.match(ui, /id='dwm-case-actions' data-dwm-case-action-dock/)
    assert.match(ui, /notifyCustomer=\{workflowControls\.notifyCustomer\}/)
    assert.match(actions, /async function notifyCustomer\(\)/)
    assert.match(constants, /DWM_CASE_EVIDENCE_PREVIEW_ROWS = 6/)
    assert.match(ui, /evidence\.slice\(0, DWM_CASE_EVIDENCE_PREVIEW_ROWS\)/)
    assert.match(ui, /Select all/)
    assert.match(ui, /Analyst actions/)
    assert.match(ui, /Case and evidence report/)
    assert.match(ui, /Hanasand receiver receipt/)
    assert.match(client, /receipt\.idempotencyKey === latestDelivery\?\.idempotencyKey/)
    assert.match(client, /receipt\.destinationId === \(latestDelivery\?\.webhookDestinationId \|\| latestDelivery\?\.destinationId\)/)
    assert.match(client, /deliveries\.some\(delivery => delivery\.id === receipt\.deliveryId && delivery\.status === 'delivered'\)/)
    assert.match(model, /Exact report retry is available at/)
    assert.match(ui, /data-dwm-webhook-action-blocker='true'/)
    assert.match(model, /Webhook delivery needs a linked alert before it can be tested or sent\./)
    assert.match(ui, /Manage destination/)
    assert.match(ui, /Delivery history/)
    assert.match(ui, /Test STIX report/)
    assert.match(ui, /Retry exact report/)
})

test('DWM case actions keep durable payload and report delivery contracts', () => {
    assert.match(actions, /method: 'PATCH'/)
    assert.match(actions, /confirmResolutionId: caseRecord\?\.resolution\?\.id/)
    assert.match(actions, /resolutionMethod: 'ai'/)
    assert.match(actions, /idempotencyKey: `dashboard-case:\$\{caseId\}/)
    assert.match(actions, /No durable case update was returned\./)
    assert.match(actions, /deliveryMode: 'dry_run'/)
    assert.match(actions, /No durable notification record was returned\./)
    assert.match(actions, /deliveryId: retryDeliveryId/)
    assert.match(actions, /reportFormat: 'stix'/)
    assert.match(actions, /evidenceIds: selectedEvidenceIds/)
    assert.match(actions, /destinationId: selectedDestinationId/)
    assert.match(actions, /delivery\.status === 'failed' \|\| delivery\.status === 'skipped'/)
    assert.match(actions, /delivery\.status !== 'delivered'/)
    assert.match(ui, /Export JSON report/)
    assert.match(ui, /Export STIX 2\.1/)
    assert.match(ui, /data-dwm-case-action-blockers='true'/)
    assert.match(model, /function actionUnavailableReasons/)
    assert.match(client, /compactCaseReference\(scopedOrganizationId, 'Org'\)/)
    assert.match(client, /compactCaseReference\(scopedAlertId, 'Alert'\)/)
})

test('DWM case detail uses the authenticated tenant proxy and server resolves report exports', () => {
    assert.doesNotMatch(pageSource, /loadCaseDetail/)
    assert.doesNotMatch(pageSource, /loadCaseExport/)
    assert.match(pageSource, /cookieStore\.get\('id'\)/)
    assert.match(pageSource, /cookieStore\.get\('access_token'\)/)
    assert.match(deliveryRouteSource, /reportUrl\.searchParams\.set\('report', 'true'\)/)
    assert.match(deliveryRouteSource, /if \(deliveryId && organizationId\)/)
    assert.match(deliveryRouteSource, /body: JSON\.stringify\(\{ organizationId, orgId: organizationId, tenantId: organizationId, deliveryId \}\)/)
    assert.match(deliveryRouteSource, /`\/v1\/cases\/\$\{encodeURIComponent\(reportRequest\.value\.caseId\)\}\/export`/)
    assert.match(deliveryRouteSource, /report_destination_required/)
    assert.match(deliveryRouteSource, /report_duplicate_evidence_selection/)
    assert.match(deliveryRouteSource, /evidenceIds\.length > 25/)
})

function read(path: string) {
    return readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')
}
