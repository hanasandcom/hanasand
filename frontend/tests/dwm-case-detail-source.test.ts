import { strict as assert } from 'node:assert'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'
import { CaseActionPanel } from '../src/app/dashboard/cases/[id]/case-detail/CaseActionPanel'
import { findingsActionsHref } from '../src/app/dashboard/findings/findings-routes'
import type { CaseAction, CaseDetail } from '../src/app/dashboard/cases/[id]/case-detail/contracts'

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
    assert.match(ui, /href=\{findingsActionsHref\(organizationId\)\}>Manage destination/)
    assert.match(ui, /Delivery history/)
    assert.match(ui, /Test STIX report/)
    assert.match(ui, /Retry exact report/)
})

test('case delivery destination link shares findings route encoding and empty-scope behavior', () => {
    assert.equal(findingsActionsHref('org ?#&'), '/findings/actions?org=org%20%3F%23%26')
    assert.equal(findingsActionsHref(''), '/findings/actions')
})

test('case action controls render and forward owner, rationale, resolution, action, and notification callbacks', () => {
    const calls: unknown[] = []
    const action: CaseAction = { id: 'close', enabled: true }
    const props = {
        detail: { case: { id: 'case-1' } } as CaseDetail,
        actions: [action],
        readOnly: false,
        owner: 'analyst@example.test',
        setOwner: (owner: string) => calls.push(['owner', owner]),
        note: 'Review evidence',
        setNote: (note: string) => calls.push(['note', note]),
        aiResolution: false,
        setAiResolution: (enabled: boolean) => calls.push(['ai', enabled]),
        busy: null,
        message: null,
        runAction: (selected: CaseAction) => calls.push(['action', selected]),
        notifyCustomer: () => calls.push(['notify']),
    }
    const html = renderToStaticMarkup(createElement(CaseActionPanel, props))
    assert.match(html, /Analyst actions/)
    assert.match(html, /owner@company\.com/)
    assert.match(html, /analyst@example\.test/)
    assert.match(html, /Review evidence/)
    assert.match(html, /AI resolution \(when closing\) — requires human confirmation/)
    assert.match(html, /Notify dry run/)

    const tree = CaseActionPanel(props)
    const controls = elementsOfType(tree, type => type === 'input')
    const ownerInput = controls.find(element => element.props.type !== 'checkbox')
    const resolutionInput = controls.find(element => element.props.type === 'checkbox')
    const rationale = elementsOfType(tree, type => type === 'textarea')[0]
    const actionControl = elementsOfType(tree, type => typeof type === 'function' && type.name === 'ActionButton')[0]
    const notifyControl = elementsOfType(tree, type => type === 'button').find(element => hasText(element.props.children, 'Notify dry run'))
    onChange(ownerInput, { target: { value: 'new-owner@example.test' } })
    onChange(rationale, { target: { value: 'Updated rationale' } })
    onChange(resolutionInput, { target: { checked: true } })
    onClick(actionControl)
    onClick(notifyControl)
    assert.deepEqual(calls, [
        ['owner', 'new-owner@example.test'], ['note', 'Updated rationale'], ['ai', true], ['action', action], ['notify'],
    ])
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

type TestElement = { type: unknown, props: Record<string, unknown> }

function elementsOfType(node: unknown, matches: (type: unknown) => boolean): TestElement[] {
    if (Array.isArray(node)) return node.flatMap(child => elementsOfType(child, matches))
    if (!node || typeof node !== 'object' || !('type' in node) || !('props' in node)) return []
    const element = node as TestElement
    return [ ...(matches(element.type) ? [element] : []), ...elementsOfType(element.props.children, matches) ]
}

function hasText(node: unknown, text: string): boolean {
    if (node === text) return true
    if (Array.isArray(node)) return node.some(child => hasText(child, text))
    if (!node || typeof node !== 'object' || !('props' in node)) return false
    return hasText((node as TestElement).props.children, text)
}

function onChange(element: TestElement | undefined, event: { target: { value?: string, checked?: boolean } }) {
    const callback = element?.props.onChange as ((event: typeof event) => void) | undefined
    callback?.(event)
}

function onClick(element: TestElement | undefined) {
    const callback = element?.props.onClick as (() => void) | undefined
    callback?.()
}
