import type { PublicTiProvenanceReadiness, HelpdeskAuditReadiness, DeployProbeReadiness, DwmProductSnapshotReadiness, OrganizationAlertExportReadiness, WebhookHealthReadiness, DashboardAlertEvidenceReadiness, AnalystWorkflowReadiness, EntitlementReadiness, DwmAlertGenerationReadiness } from './readinessTypes'

export function unavailablePublicTi(source: string, checkedAt: string): PublicTiProvenanceReadiness {
    return {
        schemaVersion: 'ti.public_provenance.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/ti',
        detail: 'Public TI provenance state is updating for source, evidence, and freshness status.',
        blockers: ['Public TI provenance needs a live readiness snapshot.'],
        ownerLane: 'public-ti',
        unavailableReason: 'missing_public_ti_provenance_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'public_ti_provenance',
        integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source, evidence, and freshness status.',
        backendProofContractVersion: 'ti.public_provenance.readiness.v1',
    }
}

export function unavailableHelpdesk(source: string, checkedAt: string): HelpdeskAuditReadiness {
    return {
        schemaVersion: 'support.audit.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/helpdesk',
        detail: 'Helpdesk and structured audit state is updating for recovery and audit status.',
        blockers: ['Helpdesk and audit needs a live readiness snapshot.'],
        ownerLane: 'helpdesk',
        unavailableReason: 'missing_helpdesk_audit_readiness_api',
        staleAfterSeconds: 3600,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'helpdesk_audit',
        integrationProbeHint: 'GET /api/admin/support/readiness must return structured audit and recovery queue status.',
        backendProofContractVersion: 'support.audit.readiness.v1',
    }
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
    return {
        schemaVersion: 'dwm.product_snapshot.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/findings',
        detail: 'DWM monitor state is updating for live watchlist, source, and alert status.',
        blockers: ['DWM monitor needs live watchlist, source, and alert status.'],
        ownerLane: 'dwm',
        unavailableReason: 'missing_dwm_product_snapshot',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'dwm_product_snapshot',
        integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI service.',
        backendProofContractVersion: 'dwm.product.v1',
    }
}

export function unavailableOrgAlertExport(source: string, checkedAt: string): OrganizationAlertExportReadiness {
    return {
        schemaVersion: 'organization.watchlist_alert_terms_export.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/findings',
        detail: 'Organization alert-term export state is updating for active terms and alertability.',
        blockers: ['Organization alert-term export needs an alertability snapshot.'],
        ownerLane: 'org',
        unavailableReason: 'missing_org_alert_export_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'org_alert_export',
        integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return organization alertability and active watchlist term counts.',
        backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
    }
}

export function unavailableWebhookHealth(source: string, checkedAt: string): WebhookHealthReadiness {
    return {
        schemaVersion: 'dwm.webhook_health.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/automation?setup=dwm',
        detail: 'Webhook health state is updating for destinations, tests, and deliveries.',
        blockers: ['Webhook health needs destination and delivery status.'],
        ownerLane: 'webhook',
        unavailableReason: 'missing_webhook_lifecycle_health_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'webhook_health',
        integrationProbeHint: 'GET /api/findings/webhooks must return active destination count and lifecycle health, not only delivery rows.',
        backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
    }
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
    return {
        schemaVersion: 'dwm.entitlement.readiness.v1',
        status: 'unavailable',
        checkedAt,
        source,
        href: '/findings',
        detail: 'DWM entitlement state is updating for policy and role decisions.',
        blockers: ['DWM entitlement needs policy and role status.'],
        ownerLane: 'org',
        unavailableReason: 'missing_dwm_entitlement_readiness_api',
        staleAfterSeconds: 900,
        proofTimestamp: checkedAt,
        expectedDashboardRowId: 'entitlement_readiness',
        integrationProbeHint: 'GET /api/findings/entitlements/status must return policy, checked role, allowed action, and blockers.',
        backendProofContractVersion: 'dwm.entitlement.readiness.v1',
    }
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
