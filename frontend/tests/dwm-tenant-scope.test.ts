import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MonitoringOverview } from '../src/app/dashboard/findings/monitoring-overview'
import { resolveDwmRequestScope, withDwmRequestScope } from '../src/app/api/findings/_tiProxy'
import { buildAlertTimeline } from '../src/app/dashboard/ti/workbench/alertModel'
import type { RuntimeDwmAlert } from '../src/app/dashboard/ti/workbench/runtimeAlert'
import type { DwmDataHealth } from '../src/app/dashboard/findings/view-types'
import type { PortalAlert } from '../src/app/dashboard/findings/types'

const liveDataHealth: DwmDataHealth = {
    snapshot: { state: 'live', label: 'Monitoring live', detail: 'Monitoring data is available.' },
    operations: { state: 'live', label: 'Collection live', detail: 'Collection data is available.' },
    alerts: { state: 'live', label: 'Findings live', detail: 'Findings are available.' },
    deliveries: { state: 'live', label: 'Deliveries live', detail: 'Delivery data is available.' },
}

const alert: PortalAlert = {
    id: 'alert-42',
    eventType: 'darkweb.monitoring.match',
    severity: 'high',
    confidence: 0.92,
    matchedTerm: { value: 'acme.example', kind: 'domain' },
    company: 'Acme',
    artifactType: 'credential_exposure',
    sourceFamily: 'darkweb_metadata',
    sourceCount: 1,
    firstSeenAt: '2026-10-15T10:00:00.000Z',
    lastSeenAt: '2026-10-15T11:00:00.000Z',
    claimSummary: 'Acme credentials were mentioned.',
    observedMatchSummary: 'Acme credentials appeared in a retained source.',
    reviewState: 'needs_review',
    recommendedAction: 'Review the retained source and rotate exposed credentials.',
    evidence: [{
        id: 'evidence-7',
        sourceName: 'Public source report',
        sourceFamily: 'public_advisory',
        captureMode: 'public_report',
        redactionState: 'redacted',
        contentHash: 'sha256:example',
        excerpt: 'Acme staging credentials were posted in a public report.',
        observedAt: '2026-10-15T10:30:00.000Z',
    }],
    webhookDelivery: {
        recommendedRoute: 'identity_response',
        payloadHash: 'payload-hash',
        dedupeKey: 'alert-42',
    },
}

describe('DWM tenant scope', () => {
    test('derives a personal tenant from the authenticated identity', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('tenantId=another-tenant'),
            headers: new Headers({ 'x-tenant-id': 'another-tenant' }),
            body: { tenantId: 'another-tenant' },
        })

        assert.deepEqual(scope, { tenantId: 'user-123' })
    })

    test('uses one consistent organization scope for membership verification', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('organizationId=org-456'),
            headers: new Headers({ 'x-organization-id': 'org-456' }),
            body: { organizationId: 'org-456', orgId: 'org-456' },
        })

        assert.deepEqual(scope, { tenantId: 'org-456', organizationId: 'org-456' })
    })

    test('rejects conflicting organization scopes', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('organizationId=org-456'),
            headers: new Headers(),
            body: { orgId: 'org-789' },
        })

        assert.deepEqual(scope, {
            tenantId: 'user-123',
            error: 'Organization scope is inconsistent across the request.',
        })
    })

    test('verifies and rewrites scope inside evidence-ingest items', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams(),
            headers: new Headers(),
            body: { items: [{ tenantId: 'another-tenant', organizationId: 'org-456' }] },
        })

        assert.deepEqual(scope, { tenantId: 'org-456', organizationId: 'org-456' })
        assert.deepEqual(withDwmRequestScope({ items: [{ tenantId: 'another-tenant', organizationId: 'org-456', actor: 'Actor' }] }, scope), {
            tenantId: 'org-456',
            organizationId: 'org-456',
            orgId: 'org-456',
            items: [{ tenantId: 'org-456', organizationId: 'org-456', orgId: 'org-456', actor: 'Actor' }],
        })
    })

    test('keeps the legacy URL as a redirect without retaining sample pages', () => {
        const config = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8')

        assert.match(config, /source: '\/solutions\/dwm',[\s\S]*destination: '\/findings'/)
        assert.equal(existsSync(new URL('../src/app/solutions/dwm/page.tsx', import.meta.url)), false)
        assert.equal(existsSync(new URL('../src/app/solutions/dwm/pageClient.tsx', import.meta.url)), false)
        const routeMap = JSON.parse(readFileSync(new URL('../src/utils/routes/appRoutes.json', import.meta.url), 'utf8')) as [string, string][]
        assert.ok(routeMap.some(([dashboard, canonical]) => dashboard === '/dashboard/findings' && canonical === '/findings'))
        assert.equal(existsSync(new URL('../src/app/dashboard/findings/page.tsx', import.meta.url)), true)
    })

    test('renders current finding, retained evidence, and its case destination', () => {
        const markup = renderToStaticMarkup(createElement(MonitoringOverview, {
            alerts: [alert],
            dataHealth: liveDataHealth,
            organizationId: 'org-9',
            initialAlertId: alert.id,
            actionMessage: null,
            onRefresh: () => {},
            caseHref: () => '/cases/case-9?alert=alert-42&org=org-9&source=alert_queue',
        }))

        assert.match(markup, /data-finding-id="alert-42"/)
        assert.match(markup, /Acme credentials appeared in a retained source\./)
        assert.match(markup, /Public source report/)
        assert.match(markup, /Acme staging credentials were posted in a public report\./)
        assert.match(markup, /href="\/cases\/case-9\?alert=alert-42&amp;source=alert_queue&amp;org=org-9"[^>]*>Open case<\/a>/)
    })

    test('workbench timeline displays only workflow events returned with the alert', () => {
        const persistedAlert = {
            id: 'alert-42',
            eventType: 'darkweb.monitoring.match',
            severity: 'high',
            confidence: 0.92,
            matchedTerm: { value: 'acme.example', kind: 'domain' },
            company: 'Acme',
            artifactType: 'credential_exposure',
            sourceFamily: 'public_advisory',
            sourceCount: 1,
            firstSeenAt: '2026-10-15T10:00:00.000Z',
            claimSummary: 'Credentials were mentioned.',
            reviewState: 'needs_review',
            recommendedAction: 'Review the evidence.',
            evidence: [],
            webhookDelivery: { recommendedRoute: 'analyst_review', payloadHash: 'hash', dedupeKey: 'dedupe' },
            workflowEvents: [{ id: 'event-7', at: '2026-10-15T11:00:00.000Z', eventType: 'workflow.transition', toWorkflowStatus: 'investigating', note: 'Assigned to review.' }],
        } as unknown as RuntimeDwmAlert
        const timeline = buildAlertTimeline(persistedAlert, [], [], [])

        assert.deepEqual(timeline.find(item => item.id === 'event-7'), {
            id: 'event-7', at: '2026-10-15T11:00:00.000Z', title: 'workflow.transition',
            body: 'investigating · Assigned to review.',
        })
        assert.deepEqual(buildAlertTimeline({ ...persistedAlert, workflowEvents: undefined }, [], [], []).filter(item => item.id === 'event-7'), [])
    })
})
