import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { buildProductReadiness } from '../src/app/dashboard/productReadinessModel.ts'
import type { ProductReadinessExternalState } from '../src/utils/productProgress/sourceGrowthTypes.ts'
import { checkedAt, externalReadiness, productInput } from './helpers/productReadinessFixtures.ts'

test('degraded external proofs preserve status, metadata, blockers, and actions', () => {
    const readiness: ProductReadinessExternalState = {
        ...externalReadiness,
        entitlement: {
            schemaVersion: 'dwm.entitlement.readiness.v1', status: 'blocked', checkedAt,
            proofTimestamp: checkedAt, unavailableReason: 'organization_role_denied',
            blockers: ['The selected role cannot view DWM alerts.'],
        },
        orgAlertExport: {
            schemaVersion: 'organization.watchlist_alert_terms_export.v1', status: 'needs_action', checkedAt,
            proofTimestamp: checkedAt, organizationId: 'org-1', activeTermCount: 2,
            canGenerateAlerts: false, unavailableReason: 'alert_terms_not_exportable',
            blockers: ['Organization alert-term export is waiting on active terms.'],
        },
        sourceGrowth: {
            schemaVersion: 'dwm.source_inventory.v1', status: 'blocked', checkedAt,
            proofTimestamp: checkedAt, unavailableReason: 'source_worker_blocked',
            workerStatus: 'blocked', workerLastRunAt: checkedAt, activeSourceRows: 3,
            collectionReadyRows: 1, endToEndWorkflow: {
                status: 'blocked', schemaVersion: 'workflow.packet.v1', lastVerifiedAt: checkedAt,
                stepCount: 8, readyStepCount: 5, blockedStepCount: 3, missingFieldCount: 2,
            },
        },
        analystWorkflow: {
            schemaVersion: 'analyst.workflow.readiness.v1', status: 'needs_action', checkedAt,
            proofTimestamp: checkedAt, unavailableReason: 'case_detail_not_readable',
            caseId: 'case-degraded', alertId: 'alert-1', caseStatus: 'open', assignedOwner: 'analyst@example.test',
            caseDetailReady: false, caseDetailRoute: '/api/cases/case-degraded', caseDetailTimelineCount: 0,
            blockers: ['Case detail is not readable yet.'],
        },
        alertGeneration: {
            schemaVersion: 'dwm.alert_generation_readiness.v1', status: 'needs_action', checkedAt,
            proofTimestamp: checkedAt, candidateCount: 3, captureRefCount: 5, matchedCandidateCount: 2,
            missingRouteCandidateCount: 1, generationEvidenceWindowReady: false,
            generationEvidenceWindowCaptureCount: 4, generationEvidenceWindowSourceFamilies: ['forum', 'paste'],
            latestEvidenceAt: checkedAt, blockers: ['Generation evidence window is incomplete.'],
        },
        dashboardEvidence: {
            schemaVersion: 'dashboard.alert_evidence.readiness.v1', status: 'needs_action', checkedAt,
            proofTimestamp: checkedAt, unavailableReason: 'missing_matching_delivery',
            alertId: 'alert-1', deliveryId: 'delivery-1', visibleInDashboard: true,
            deliveryEvidenceMatched: false, sourceProxyReady: true, deployProbeFresh: true,
            blockers: ['Delivery evidence does not match the visible alert.'],
        },
        webhookHealth: {
            schemaVersion: 'dwm.webhook_health.readiness.v1', status: 'blocked', checkedAt,
            proofTimestamp: checkedAt, unavailableReason: 'webhook_destination_blocked',
            destinationCount: 2, activeDestinationCount: 0, deliveryReadyCount: 0,
            latestDeliveryAt: checkedAt, blockers: ['No active delivery destination is ready.'],
        },
    }
    const rows = buildProductReadiness(productInput({ externalReadiness: readiness }))
    const row = (id: string) => rows.find(item => item.id === id)!

    assert.equal(row('entitlement_readiness').status, 'blocked')
    assert.equal(row('org_alert_export').status, 'needs_action')
    assert.equal(row('source_inventory_probe').status, 'blocked')
    assert.equal(row('analyst_workflow').status, 'needs_action')
    assert.equal(row('dashboard_evidence').status, 'needs_action')
    assert.equal(row('webhook_health').status, 'blocked')

    for (const id of ['entitlement_readiness', 'org_alert_export', 'source_inventory_probe', 'analyst_workflow', 'dashboard_evidence', 'webhook_health']) {
        const proof = row(id)
        assert.ok(proof.unavailableReason, `${id} unavailable reason`)
        assert.equal(proof.proofTimestamp, checkedAt, `${id} proof timestamp`)
        assert.ok((proof.staleAfterSeconds || 0) > 0, `${id} stale threshold`)
        assert.equal(proof.expectedDashboardRowId, id)
        assert.ok(proof.integrationProbeHint, `${id} probe hint`)
        assert.ok(proof.backendProofContractVersion, `${id} contract version`)
        assert.ok((proof.blockerCount || 0) > 0, `${id} blocker count`)
        assert.ok(proof.actions?.length, `${id} operator actions`)
    }

    assert.equal(row('analyst_workflow').unavailableReason, 'case_detail_not_readable')
    assert.equal(row('analyst_workflow').caseId, 'case-degraded')
    assert.equal(row('analyst_workflow').caseDetailHref, '/api/cases/case-degraded')
    assert.ok(row('analyst_workflow').actions?.find(action => action.id === 'record_case_note')?.disabledReason)
    assert.equal(row('source_inventory_probe').workerStatus, 'blocked')
    assert.equal(row('source_inventory_probe').collectionReadyRows, 1)
    assert.equal(row('end_to_end_workflow').endToEndWorkflowBlockedStepCount, 3)
    assert.equal(row('dashboard_evidence').candidateCount, 3)
    assert.equal(row('dashboard_evidence').generationEvidenceWindowCaptureCount, 4)
    assert.deepEqual(row('dashboard_evidence').generationEvidenceWindowSourceFamilies, ['forum', 'paste'])
    assert.equal(row('dashboard_evidence').latestEvidenceAt, checkedAt)
    assert.equal(row('webhook_health').destinationCount, 2)
    assert.equal(row('webhook_health').activeDestinationCount, 0)
    assert.ok(row('webhook_health').actions?.some(action => action.id === 'send_queued_alerts'))
})
