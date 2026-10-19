import type { ProductProgressReadinessPayload } from './payloadTypes'
import type { ProductProgressEndpointInput } from './readinessInputTypes'
import { chooseDashboardAlert, chooseDeliveryForAlert, sourceProxyHealth, sourceProxyHasFreshWorker } from './readinessSelection'
import { currentCommit, actionNeededPublicTi, actionNeededOrgAlertExport, actionNeededDwmProduct, entitlementReadiness, webhookHealthFromDeliveries } from './readinessDefaults'
import { dashboardEvidenceFromRows, analystWorkflowFromRows } from './readinessEvidence'

export { isDurableDelivered } from './readinessSelection'
export type { AnalystCaseDetailProofInput, DwmAlertGenerationReadinessInput, ProductProgressEndpointInput } from './readinessInputTypes'

export function buildProductProgressPayload(input: ProductProgressEndpointInput): ProductProgressReadinessPayload {
    const checkedAt = input.checkedAt || input.generatedAt
    const alert = chooseDashboardAlert(input.alerts || [], input.deliveries || [])
    const delivery = alert ? chooseDeliveryForAlert(alert.id, input.deliveries || []) : undefined
    const sourceProxyReady = sourceProxyHasFreshWorker(input.sourceProxy)
    const deployProbeFresh = Boolean(input.deploy?.status === 'ready' && input.deploy.latestProbeAt)
    const deployBlockers = input.deploy?.status === 'ready' && deployProbeFresh
        ? []
        : input.deploy?.blockers?.length
            ? input.deploy.blockers
            : ['No external deploy probe has confirmed this product-progress endpoint after deploy.']

    return {
        schemaVersion: 'product.progress.readiness.v1',
        generatedAt: input.generatedAt,
        checkedAt,
        routes: input.routes,
        publicTiProvenance: input.publicTiProvenance || actionNeededPublicTi(input.routes.publicTiProvenance || input.routes.productProgress || '/api/product-progress', checkedAt),
        deployProbe: {
            schemaVersion: 'product.deploy_probe.readiness.v1',
            status: input.deploy?.status === 'ready' && deployProbeFresh ? 'ready' : 'needs_action',
            checkedAt,
            source: input.deploy?.source || input.routes.deployProbe || input.routes.productProgress || '/api/product-progress',
            href: '/status',
            deployedCommit: input.deploy?.deployedCommit || currentCommit(),
            frontendHealthy: input.deploy?.frontendHealthy ?? true,
            apiHealthy: input.deploy?.apiHealthy ?? false,
            scraperHealthy: input.deploy?.scraperHealthy ?? sourceProxyHealth(input.sourceProxy),
            latestProbeAt: input.deploy?.latestProbeAt,
            dashboardAlertId: input.deploy?.dashboardAlertId || alert?.id,
            deliveryId: input.deploy?.deliveryId || delivery?.id,
            ledgerPath: input.deploy?.ledgerPath,
            blockers: deployBlockers,
            ownerLane: 'integration',
            unavailableReason: input.deploy?.status === 'ready' && deployProbeFresh ? undefined : 'missing_live_deploy_probe',
            staleAfterSeconds: input.deploy?.staleAfterSeconds || 600,
            proofTimestamp: input.deploy?.latestProbeAt || checkedAt,
            expectedDashboardRowId: 'deploy_probe',
            integrationProbeHint: input.deploy?.integrationProbeHint || 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
            backendProofContractVersion: input.deploy?.backendProofContractVersion || 'product.deploy_probe.readiness.v1',
            detail: input.deploy?.detail || (input.deploy?.status === 'ready' && deployProbeFresh
                ? `Deploy probe loaded for ${input.deploy.deployedCommit || 'current build'}.`
                : 'Deploy check is available only after a live probe records the deployed commit and service health.'),
        },
        sourceProxy: input.sourceProxy || {
            ok: false,
            generatedAt: checkedAt,
            query: input.query,
            baseConfigured: false,
            error: { code: 'source_proxy_needs_connection', message: 'Source proxy response is not connected to this console view.' },
        },
        orgAlertExport: input.orgAlertExport || actionNeededOrgAlertExport(input.routes.orgAlertExport || input.routes.productProgress || '/api/product-progress', checkedAt),
        webhookHealth: input.webhookHealth || webhookHealthFromDeliveries(input.routes.webhookHealth || input.routes.productProgress || '/api/product-progress', checkedAt, input.deliveries || []),
        entitlement: entitlementReadiness(input.entitlement, input.routes.entitlement || input.routes.productProgress || '/api/product-progress', checkedAt),
        dwmProduct: input.dwmProduct || actionNeededDwmProduct(input.routes.dwmProduct || input.routes.productProgress || '/api/product-progress', checkedAt),
        alertGeneration: input.alertGeneration,
        dashboardEvidence: dashboardEvidenceFromRows({
            checkedAt,
            route: input.routes.dashboardAlerts || '/dashboard',
            alert,
            delivery,
            alertGeneration: input.alertGeneration,
            sourceProxyReady,
            deployProbeFresh,
        }),
        analystWorkflow: analystWorkflowFromRows({
            checkedAt,
            route: input.routes.cases || '/api/cases',
            alert,
            cases: input.cases || [],
            caseDetail: input.caseDetail,
        }),
    }
}


export type { ProductProgressReadinessPayload } from './payloadTypes'
