import type { PublicTiProvenanceReadiness, HelpdeskAuditReadiness, DeployProbeReadiness, DwmProductSnapshotReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness, DashboardAlertEvidenceReadiness, AnalystWorkflowReadiness, EntitlementReadiness, DwmAlertGenerationReadiness } from './readinessTypes'
import { readinessSnapshot, readinessSnapshotSpecs } from './readinessSnapshot'

export function unavailablePublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.publicTi, 'unavailable', source, checkedAt, {
        detail: 'Public TI provenance state is updating for source, evidence, and freshness status.',
        blockers: ['Public TI provenance needs a live readiness snapshot.'],
        integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source, evidence, and freshness status.',
    })
}

export function unavailableHelpdesk(source: string, checkedAt: string): HelpdeskAuditReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.helpdesk, 'unavailable', source, checkedAt, {
        detail: 'Helpdesk and structured audit state is updating for recovery and audit status.',
        blockers: ['Helpdesk and audit needs a live readiness snapshot.'],
        integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue status.',
    })
}

export function unavailableDeployProbe(source: string, checkedAt: string): DeployProbeReadiness {
    return {
        schemaVersion: 'product.deploy_probe.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/status',
        detail: 'Deploy probe state is updating for the latest health check.',
        blockers: ['Deploy probe needs a fresh health-check snapshot.'],
        ownerLane: 'integration',
        unavailableReason: 'missing_live_deploy_probe',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'deploy_probe',
        integrationProbeHint: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
        backendProofContractVersion: 'product.deploy_probe.readiness.v1',
    }
}

export function unavailableDwmProduct(source: string, checkedAt: string): DwmProductSnapshotReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.dwmProduct, 'unavailable', source, checkedAt, {
        detail: 'DWM monitor state is updating for live watchlist, source, and alert status.',
        blockers: ['DWM monitor needs live watchlist, source, and alert status.'],
        integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI service.',
    })
}

export function unavailableOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.orgAlertExport, 'unavailable', source, checkedAt, {
        detail: 'Organization alert-term export state is updating for active terms and alertability.',
        blockers: ['Organization alert-term export needs an alertability snapshot.'],
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return organization alertability and active watchlist term counts.',
    })
}

export function unavailableWebhookHealth(source: string, checkedAt: string): WebhookHealthReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.webhookHealth, 'unavailable', source, checkedAt, {
        detail: 'Webhook health state is updating for destinations, tests, and deliveries.',
        blockers: ['Webhook health needs destination and delivery status.'],
        integrationProbeHint: 'GET /api/findings/webhooks must return active destination count and lifecycle health, not only delivery rows.',
    })
}

export function unavailableDashboardEvidence(source: string, checkedAt: string): DashboardAlertEvidenceReadiness {
    return {
        schemaVersion: 'dashboard.alert_evidence.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/dashboard',
        detail: 'Dashboard alert and delivery state is updating for visible alerts and matching delivery evidence.',
        blockers: ['Dashboard evidence needs a visible alert with matching delivery evidence.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_dashboard_alert_evidence',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources is ready, and deploy probe is fresh.',
        backendProofContractVersion: 'dashboard.alert_evidence.readiness.v1',
    }
}

export function unavailableAnalystWorkflow(source: string, checkedAt: string): AnalystWorkflowReadiness {
    return {
        schemaVersion: 'analyst.workflow.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/ti/workbench',
        detail: 'Analyst case state is updating for a case linked to the visible alert.',
        blockers: ['Analyst case needs a linked case status snapshot.'],
        ownerLane: 'dashboard',
        unavailableReason: 'missing_analyst_case_readiness',
        staleAfterSeconds: 600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'analyst_workflow',
        integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst process is active.',
        backendProofContractVersion: 'analyst.workflow.readiness.v1',
    }
}

export function unavailableEntitlementReadiness(source: string, checkedAt: string): EntitlementReadiness {
    return readinessSnapshot(readinessSnapshotSpecs.entitlement, 'unavailable', source, checkedAt, {
        detail: 'DWM entitlement state is updating for policy and role decisions.',
        blockers: ['DWM entitlement needs policy and role status.'],
        integrationProbeHint: 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
    })
}

export function unavailableAlertGenerationReadiness(source: string, checkedAt: string): DwmAlertGenerationReadiness {
    return {
        schemaVersion: 'dwm.alert_generation_readiness.v1',
        status: 'needs_action',
        checkedAt,
        source,
        href: '/api/findings/alerts/generation-readiness',
        detail: 'DWM alert generation state is updating for candidates and evidence-window status.',
        blockers: ['DWM alert generation needs candidates and evidence-window status.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_alert_generation_readiness',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dashboard_evidence',
        integrationProbeHint: 'GET /api/findings/alerts/generation-readiness must return dwm.alert_generation_readiness.v1 with candidates and a generation evidence window.',
        backendProofContractVersion: 'dwm.alert_generation_readiness.v1',
    }
}
