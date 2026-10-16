import type { ProductProgressReadinessPayload } from './payloadTypes'
import type { ProductReadinessExternalState } from './sourceGrowthTypes'
import { PRODUCT_PROGRESS_SCHEMA_VERSION } from './readinessLabels'
import { sourceGrowthReady } from './readinessDetails'
import { buildSourceProofReadinessFromProxy } from './sourceProof'
import { unavailablePublicTi, unavailableHelpdesk, unavailableDeployProbe, unavailableDwmProduct, unavailableOrgAlertExport, unavailableWebhookHealth, unavailableDashboardEvidence, unavailableAnalystWorkflow, unavailableEntitlementReadiness, unavailableAlertGenerationReadiness } from './readinessFallbacks'
import { normalizeDashboardEvidenceReadiness, normalizeAnalystWorkflowReadiness, normalizeDeployProbeReadiness, normalizeOrgAlertExportReadiness, normalizeWebhookHealthReadiness } from './readinessNormalizePrimary'
import { normalizeEntitlementReadiness, normalizeDwmProductReadiness, normalizeAlertGenerationReadiness } from './readinessNormalizeSecondary'

export function parseProductProgressReadinessPayload(input: unknown): ProductProgressReadinessPayload | null {
    if (!input || typeof input !== 'object') return null
    const payload = input as Partial<ProductProgressReadinessPayload>
    if (payload.schemaVersion !== PRODUCT_PROGRESS_SCHEMA_VERSION) return null
    if (payload.routes && typeof payload.routes !== 'object') return null
    return payload as ProductProgressReadinessPayload
}

export function buildProductProgressExternalState(input: ProductProgressReadinessPayload | null | undefined, options: {
    checkedAt: string
    staleAfterMinutes?: number
}): ProductReadinessExternalState {
    const routes = input?.routes
    const route = routes?.productProgress || 'Operations status unavailable'
    if (!input) {
        return {
            publicTiProvenance: unavailablePublicTi(route, options.checkedAt),
            helpdeskAudit: unavailableHelpdesk(route, options.checkedAt),
            deployProbe: unavailableDeployProbe(route, options.checkedAt),
            sourceGrowth: buildSourceProofReadinessFromProxy(null, {
                route: routes?.sourceProxy || '/api/ti/scraper/control',
                checkedAt: options.checkedAt,
                staleAfterMinutes: options.staleAfterMinutes,
            }),
            orgAlertExport: unavailableOrgAlertExport(route, options.checkedAt),
            webhookHealth: unavailableWebhookHealth(route, options.checkedAt),
            dashboardEvidence: unavailableDashboardEvidence(route, options.checkedAt),
            analystWorkflow: unavailableAnalystWorkflow(route, options.checkedAt),
            entitlement: unavailableEntitlementReadiness(route, options.checkedAt),
            dwmProduct: unavailableDwmProduct(route, options.checkedAt),
            alertGeneration: unavailableAlertGenerationReadiness(route, options.checkedAt),
        }
    }

    const sourceGrowth = buildSourceProofReadinessFromProxy(input.sourceProxy, {
        route: input.routes?.sourceProxy || '/api/ti/scraper/control',
        checkedAt: options.checkedAt,
        staleAfterMinutes: options.staleAfterMinutes,
    })
    const dashboardEvidence = normalizeDashboardEvidenceReadiness(input.dashboardEvidence, {
        checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
        sourceGrowthReady: sourceGrowthReady(sourceGrowth),
    })
    const deployProbe = normalizeDeployProbeReadiness(input.deployProbe, {
        checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
        staleAfterMinutes: options.staleAfterMinutes ?? 120,
        dashboardEvidence,
        route: input.routes?.deployProbe || input.routes?.productProgress || '/api/product-progress',
    })

    return {
        publicTiProvenance: input.publicTiProvenance || unavailablePublicTi(input.routes?.publicTiProvenance || route, options.checkedAt),
        helpdeskAudit: input.helpdeskAudit || unavailableHelpdesk(input.routes?.helpdeskAudit || route, options.checkedAt),
        deployProbe,
        sourceGrowth,
        orgAlertExport: normalizeOrgAlertExportReadiness(input.orgAlertExport, input.routes?.orgAlertExport || route, options.checkedAt),
        webhookHealth: normalizeWebhookHealthReadiness(input.webhookHealth, input.routes?.webhookHealth || route, options.checkedAt),
        dashboardEvidence,
        analystWorkflow: normalizeAnalystWorkflowReadiness(input.analystWorkflow, {
            checkedAt: input.checkedAt || input.generatedAt || options.checkedAt,
            dashboardEvidence,
            route: input.routes?.cases || route,
        }),
        entitlement: normalizeEntitlementReadiness(input.entitlement, input.routes?.entitlement || route, options.checkedAt),
        dwmProduct: normalizeDwmProductReadiness(input.dwmProduct, input.routes?.dwmProduct || route, options.checkedAt),
        alertGeneration: normalizeAlertGenerationReadiness(input.alertGeneration, input.routes?.alertGenerationReadiness || route, options.checkedAt),
    }
}

