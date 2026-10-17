import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import {
    actionNeededDwmProduct, actionNeededHelpdesk, actionNeededOrgAlertExport, actionNeededPublicTi,
    entitlementReadiness, webhookHealthFromDeliveries,
} from '../src/utils/productProgress/readinessDefaults.ts'
import {
    unavailableDwmProduct, unavailableEntitlementReadiness, unavailableHelpdesk, unavailableOrgAlertExport,
    unavailablePublicTi, unavailableWebhookHealth,
} from '../src/utils/productProgress/readinessFallbacks.ts'

const checkedAt = '2026-10-17T10:00:00.000Z'
const source = '/api/product-progress'

const lanes = [
    {
        name: 'public TI', defaults: () => actionNeededPublicTi(source, checkedAt), fallback: () => unavailablePublicTi(source, checkedAt),
        schema: 'ti.public_provenance.readiness.v1', href: '/ti', staleAfterSeconds: 3600, rowId: 'public_ti_provenance', ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api', backendProofContractVersion: 'ti.public_provenance.readiness.v1',
        defaultText: ['Public TI source details need', 'Attach source, evidence'], fallbackText: ['Public TI provenance state is updating', 'Public TI provenance needs a live'],
        defaultHint: '/api/public-ti/provenance/status', fallbackHint: '/api/public-ti/provenance/readiness',
    },
    {
        name: 'helpdesk', defaults: () => actionNeededHelpdesk(source, checkedAt), fallback: () => unavailableHelpdesk(source, checkedAt),
        schema: 'support.audit.readiness.v1', href: '/helpdesk', staleAfterSeconds: 3600, rowId: 'helpdesk_audit', ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api', backendProofContractVersion: 'support.audit.readiness.v1',
        defaultText: ['Support action and audit history need', 'Connect support action history'], fallbackText: ['Helpdesk and structured audit state is updating', 'Helpdesk and audit needs a live'],
        defaultHint: '/api/admin/support/status', fallbackHint: '/api/admin/support/readiness',
    },
    {
        name: 'organization alert export', defaults: () => actionNeededOrgAlertExport(source, checkedAt), fallback: () => unavailableOrgAlertExport(source, checkedAt),
        schema: 'organization.watchlist_alert_terms_export.v1', href: '/findings', staleAfterSeconds: 900, rowId: 'org_alert_export', ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api', backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
        defaultText: ['Active organization watchlist terms need', 'Connect active organization watchlist terms'], fallbackText: ['Organization alert-term export state is updating', 'Organization alert-term export needs'],
        defaultHint: 'organizationCanGenerateAlerts', fallbackHint: 'organization alertability',
    },
    {
        name: 'DWM product', defaults: () => actionNeededDwmProduct(source, checkedAt), fallback: () => unavailableDwmProduct(source, checkedAt),
        schema: 'dwm.product_snapshot.readiness.v1', href: '/findings', staleAfterSeconds: 900, rowId: 'dwm_product_snapshot', ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot', backendProofContractVersion: 'dwm.product.v1',
        defaultText: ['Live DWM product data needs', 'Connect /api/findings/product'], fallbackText: ['DWM monitor state is updating', 'DWM monitor needs live'],
        defaultHint: 'TI backend', fallbackHint: 'TI service',
    },
    {
        name: 'webhook health', defaults: () => webhookHealthFromDeliveries(source, checkedAt, []), fallback: () => unavailableWebhookHealth(source, checkedAt),
        schema: 'dwm.webhook_health.readiness.v1', href: '/automation?setup=dwm', staleAfterSeconds: 900, rowId: 'webhook_health', ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api', backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
        defaultText: ['Delivery rows can be counted', 'Webhook owner must expose'], fallbackText: ['Webhook health state is updating', 'Webhook health needs destination'],
        defaultHint: '/api/findings/webhooks/deliveries', fallbackHint: 'not only delivery rows',
    },
    {
        name: 'entitlement', defaults: () => entitlementReadiness(undefined, source, checkedAt), fallback: () => unavailableEntitlementReadiness(source, checkedAt),
        schema: 'dwm.entitlement.readiness.v1', href: '/findings', staleAfterSeconds: 900, rowId: 'entitlement_readiness', ownerLane: 'org',
        unavailableReason: 'missing_dwm_entitlement_readiness_api', backendProofContractVersion: 'dwm.entitlement.readiness.v1',
        defaultText: ['Organization access policy is not connected', 'Connect policy, role'], fallbackText: ['DWM entitlement state is updating', 'DWM entitlement needs policy'],
        defaultHint: '/api/findings/entitlements/status', fallbackHint: '/api/findings/entitlements/status',
    },
]

test('shared readiness constructors keep lane contracts and status-specific wording', () => {
    for (const lane of lanes) {
        const snapshots = [
            { status: 'needs_action', snapshot: lane.defaults(), wording: lane.defaultText, hint: lane.defaultHint },
            { status: 'unavailable', snapshot: lane.fallback(), wording: lane.fallbackText, hint: lane.fallbackHint },
        ] as const
        for (const { status, snapshot, wording, hint } of snapshots) {
            assert.equal(snapshot.status, status, lane.name)
            assert.equal(snapshot.schemaVersion, lane.schema, lane.name)
            assert.equal(snapshot.href, lane.href, lane.name)
            assert.equal(snapshot.staleAfterSeconds, lane.staleAfterSeconds, lane.name)
            assert.equal(snapshot.expectedDashboardRowId, lane.rowId, lane.name)
            assert.equal(snapshot.ownerLane, lane.ownerLane, lane.name)
            assert.equal(snapshot.unavailableReason, lane.unavailableReason, lane.name)
            assert.equal(snapshot.backendProofContractVersion, lane.backendProofContractVersion, lane.name)
            assert.equal(snapshot.source, source, lane.name)
            assert.equal(snapshot.checkedAt, checkedAt, lane.name)
            assert.equal(snapshot.proofTimestamp, checkedAt, lane.name)
            assert.ok(snapshot.detail?.includes(wording[0]), lane.name)
            assert.ok(snapshot.blockers?.[0]?.includes(wording[1]), lane.name)
            assert.ok(snapshot.integrationProbeHint?.includes(hint), lane.name)
        }
        assert.notEqual(snapshots[0].snapshot.detail, snapshots[1].snapshot.detail, lane.name)
        assert.notDeepEqual(snapshots[0].snapshot.blockers, snapshots[1].snapshot.blockers, lane.name)
    }
})

test('webhook projection keeps delivery counts and its dynamic proof timestamp', () => {
    const deliveredAt = '2026-10-16T09:00:00.000Z'
    const result = webhookHealthFromDeliveries(source, checkedAt, [
        { status: 'delivered', attemptedAt: deliveredAt }, { status: 'sent' },
    ])
    assert.equal(result.deliveryReadyCount, 1)
    assert.equal(result.latestDeliveryAt, deliveredAt)
    assert.equal(result.proofTimestamp, deliveredAt)
    assert.equal(result.destinationCount, undefined)
    assert.equal(result.activeDestinationCount, undefined)
})
