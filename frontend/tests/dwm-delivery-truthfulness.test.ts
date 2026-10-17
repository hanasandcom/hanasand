import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDeliveryActions } from '../src/app/dashboard/findings/workflow-delivery-actions'
import { createEvidenceActions } from '../src/app/dashboard/findings/workflow-evidence-actions'
import { DeliveryPanel } from '../src/app/dashboard/findings/delivery-panel'
import { deliverySummaryLabel, stateLabel, webhookReady } from '../src/app/dashboard/findings/case-format'
import { webhookDeliveryResultMessage } from '../src/app/dashboard/ti/workbench/modules/actionMessages'
import { DeliveryEvidenceRows } from '../src/app/dashboard/ti/workbench/modules/alertEvidence'
import type { DeliveryItem } from '../src/app/dashboard/findings/types'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'

function delivery(status: string, dryRun = false): DeliveryItem {
    return {
        id: status, alertId: 'alert', endpointHash: 'hash', dedupeKey: status,
        attemptedAt: '2026-01-01T00:00:00Z', payloadHash: 'payload', status, dryRun,
    }
}

test('delivery summaries count only non-dry-run delivered rows as successful', () => {
    assert.equal(stateLabel('false_positive'), 'false positive')
    assert.equal(deliverySummaryLabel([]), 'Not tested')
    assert.equal(deliverySummaryLabel([delivery('delivered')]), '1 delivered')
    assert.equal(deliverySummaryLabel([delivery('dry_run', true)]), '1 tested')
    assert.equal(deliverySummaryLabel([delivery('failed')]), '1 failed')
    assert.equal(deliverySummaryLabel([delivery('queued')]), '1 attempted')
    assert.equal(deliverySummaryLabel([delivery('delivered', true)]), '1 attempted')
    assert.equal(webhookReady('1 delivered'), true)
    assert.equal(webhookReady('1 tested'), true)
    assert.equal(webhookReady('1 attempted'), false)
})

test('delivery panel does not show a dry run as the last successful delivery', () => {
    const html = renderToStaticMarkup(createElement(DeliveryPanel, {
        organizationId: 'org-1', alert: undefined,
        deliveries: [delivery('delivered', true)], busyAction: null,
        onTest: async() => {}, onSend: async() => {},
    }))
    assert.match(html, /Last success/)
    assert.match(html, />Not recorded<\/p>/)
})

test('workbench delivery messages require durable delivery evidence', () => {
    assert.equal(webhookDeliveryResultMessage({}), 'No durable delivery result was returned.')
    assert.equal(webhookDeliveryResultMessage({ deliveries: [
        { id: 'delivery-1', status: 'delivered' }, { id: 'delivery-2', status: 'dry_run' },
    ] }), 'Webhook delivery result: delivery-1:delivered, delivery-2:dry_run.')
})

test('workbench delivery evidence shows dry runs as review and actual deliveries as ready', () => {
    const selected = { id: 'alert-1', kind: 'dwm_alert' } as never
    const render = (status: string) => renderToStaticMarkup(createElement(DeliveryEvidenceRows, {
        deliveries: [{ id: `delivery-${status}`, alertId: 'alert-1', status, endpointHash: 'endpoint', payloadHash: 'payload', attemptedAt: '2026-10-15T10:00:00Z' } as never],
        selected,
    }))

    const dryRun = render('dry_run')
    const delivered = render('delivered')
    assert.match(dryRun, /bg-ui-raised px-2 py-0\.5 text-\[11px\] font-semibold text-ui-primary/)
    assert.match(dryRun, />dry run<\/span>/)
    assert.match(delivered, /bg-ui-success\/10 px-2 py-0\.5 text-\[11px\] font-semibold text-ui-success/)
    assert.match(delivered, />delivered<\/span>/)
})

test('delivery action reports durable customer delivery and refreshes scoped data', async() => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string, init?: RequestInit }> = []
    const result: unknown[] = []
    const routes: unknown[] = []
    let refreshed = 0
    globalThis.fetch = (async(input, init) => {
        calls.push({ url: String(input), init })
        return Response.json({ deliveries: [{ id: 'delivery-1', status: 'delivered' }] })
    }) as typeof fetch

    try {
        const actions = createDeliveryActions({
            scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
            webhookUrl: ' https://hooks.example.test ', webhookConfigured: true,
            setBusyAction() {}, setResult(value) { result.push(value) }, setLastRoute(value) { routes.push(value) },
        } as never, 2, () => { refreshed++ })
        await actions.deliverWebhooks()
    } finally {
        globalThis.fetch = originalFetch
    }

    assert.equal(calls[0].url, '/api/findings/webhooks/deliver')
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        tenantId: 'tenant-1', organizationId: 'org-1', limit: 25, webhookUrl: 'https://hooks.example.test',
    })
    assert.deepEqual(result.at(-1), { ok: true, message: '1 event delivered to the configured destination.' })
    assert.deepEqual(routes.at(-1), {
        label: 'Webhook delivery', watchTerms: 2, deliveryAttempts: 1, deliveryState: 'delivered',
    })
    assert.equal(refreshed, 1)
})

test('dry-run and missing delivery results never report delivery success', async() => {
    const originalFetch = globalThis.fetch
    const result: unknown[] = []
    let refreshed = 0
    const payloads = [
        { deliveries: [{ id: 'dry-1', status: 'delivered', dryRun: true }] },
        { deliveries: [] },
    ]
    globalThis.fetch = (async() => Response.json(payloads.shift())) as typeof fetch

    try {
        const actions = createDeliveryActions({
            scope: { tenantId: 'tenant-1' }, webhookUrl: '', webhookConfigured: false,
            setBusyAction() {}, setResult(value) { result.push(value) }, setLastRoute() {},
        } as never, 0, () => { refreshed++ })
        await actions.deliverWebhooks()
        await actions.deliverWebhooks()
    } finally {
        globalThis.fetch = originalFetch
    }

    assert.deepEqual(result, [
        null,
        { ok: false, message: 'Webhook delivery recorded a dry-run; no customer notification was sent.' },
        null,
        { ok: false, message: 'No durable delivery result was returned.' },
    ])
    assert.equal(refreshed, 1)
})

test('public evidence case handoff reports a webhook dry run without claiming delivery', async() => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string, body: unknown }> = []
    const replies: Record<string, unknown> = {
        '/api/findings/exposure-claims/ingest': { accepted: 1 },
        '/api/findings/alerts/rebuild': { savedAlertCount: 1, alerts: [{ id: 'alert-1', company: 'Acme' }] },
        '/api/findings/alerts/alert-1/case-handoff': { case: { id: 'case-1' } },
        '/api/findings/webhooks/deliver': { deliveries: [{ id: 'dry-1', status: 'delivered', dryRun: true }] },
    }
    globalThis.fetch = (async(input, init = {}) => {
        const url = String(input)
        calls.push({ url, body: JSON.parse(String(init.body)) })
        return Response.json(replies[url])
    }) as typeof fetch
    let result: unknown
    let route: unknown
    let destination = ''
    let savedTerms = ''
    let navigated = ''

    try {
        const actions = createEvidenceActions({
            scope: { tenantId: 'tenant-1', organizationId: 'org-1' }, organizationId: 'org-1',
            terms: 'acme.com', webhookUrl: 'https://hooks.example.test', webhookConfigured: true,
            claimActor: 'Researcher', claimCompany: 'Acme', claimData: 'Credentials exposed', claimUrl: 'https://source.example.test/report',
            setClaimUrl(value) { destination = value }, setTerms(value) { savedTerms = value }, setSourceTarget() {}, setBusyAction() {},
            setResult(value) { result = value }, setLastRoute(value) { route = value }, refreshWorkspace() {},
            navigateToCase(path) { navigated = path },
        } as never, async() => ({ ok: true, message: '' }))
        await actions.openCaseFromPublicAdvisory()
    } finally {
        globalThis.fetch = originalFetch
    }

    assert.equal(calls.at(-1)?.url, '/api/findings/webhooks/deliver')
    assert.deepEqual(calls.at(-1)?.body, {
        tenantId: 'tenant-1', organizationId: 'org-1', alertId: 'alert-1', caseId: 'case-1',
        limit: 1, dryRun: true, webhookUrl: 'https://hooks.example.test', attachToWatchlist: true,
    })
    assert.deepEqual(route, {
        label: 'Metadata case', watchTerms: 2, captureCount: 1, alertCount: 1, alertId: 'alert-1', caseId: 'case-1',
        caseHref: '/cases/case-1?organizationId=org-1&alertId=alert-1&route=public_advisory',
        deliveryAttempts: 1, deliveryState: 'dry-run recorded',
    })
    assert.deepEqual(result, {
        ok: false, message: 'Collected 1 public incident report, opened case-1. Dry-run delivery recorded; no customer notification was sent.',
        actionHref: '/findings/actions?org=org-1', actionLabel: 'Configure delivery',
    })
    assert.equal(destination, '')
    assert.equal(savedTerms, 'acme.com\nAcme')
    assert.equal(navigated, '/cases/case-1?organizationId=org-1&alertId=alert-1&route=public_advisory')
})
