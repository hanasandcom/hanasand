import { buildProductProgressPayload } from '@/utils/productProgress/readiness'
import type { DwmDeliveryItem, DwmOrganizationWebhookDestination, DwmWatchlistSummary } from '@/app/dashboard/operatorConsoleModel'
import {
    analystCaseDetailProof, fetchInternalJson as fetchJson, normalizeSourceProxy, productProgressRoutes,
    rows, selectCaseForProductProgress, selectOrganization, sourceProxyReady,
    type FetchResult, type ProductProgressRequest,
} from './routeHelpers'
import { publicTiProvenanceReadiness } from './publicTiReadiness'
import { alertGenerationReadiness } from './alertGenerationReadiness'
import { deployProbeReadiness } from './deployReadiness'
import { entitlementReadinessFromOrganizationProof, orgAlertExportReadiness, organizationReadinessProof } from './organizationReadiness'
import { webhookHealthReadiness, webhookProductProgressProof } from './webhookReadiness'
import { dwmProductReadiness } from './dwmReadiness'

type ResponseDependencies = {
    fetchJson?: (request: ProductProgressRequest, route: string) => Promise<FetchResult>
    activeOrganizationId?: () => Promise<string | undefined>
    now?: () => string
}

export async function getProductProgressPayload(request: ProductProgressRequest, dependencies: ResponseDependencies = {}) {
    const generatedAt = dependencies.now?.() || new Date().toISOString()
    const fetchRoute = dependencies.fetchJson || fetchJson
    const query = request.nextUrl.searchParams.get('q')?.trim() || ''
    const routes = productProgressRoutes(query)
    const [sourceProxy, dwmProduct, publicTi, alerts, alertGeneration, cases, deliveries, organizations, watchlists, deployStatus] = await Promise.all([
        fetchRoute(request, routes.sourceProxy || '/api/ti/scraper/control'),
        fetchRoute(request, routes.dwmProduct || '/api/findings/product'),
        query ? fetchRoute(request, routes.publicTiProvenance || '/api/ti/search') : Promise.resolve({ ok: false, status: 400, error: 'No public intelligence query was supplied.' }),
        fetchRoute(request, routes.dashboardAlerts || '/api/findings/alerts'),
        fetchRoute(request, routes.alertGenerationReadiness || '/api/findings/alerts/generation-readiness'),
        fetchRoute(request, routes.cases || '/api/cases'),
        fetchRoute(request, routes.deliveries || '/api/findings/webhooks/deliveries'),
        fetchRoute(request, routes.organizations || '/api/organizations'),
        fetchRoute(request, routes.watchlists || '/api/findings/watchlists'),
        fetchRoute(request, routes.deployProbe || '/api/status'),
    ])
    const watchlistRows = rows((watchlists.json as { watchlists?: unknown[] } | undefined)?.watchlists) as DwmWatchlistSummary[]
    const activeOrganization = await dependencies.activeOrganizationId?.()
    const selectedOrganization = selectOrganization(organizations.json, request, activeOrganization)
    const organizationWebhooks = selectedOrganization
        ? await fetchRoute(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks`)
        : { ok: false, status: 0, error: 'No selected organization available for webhook readiness.' }
    const organizationReadiness = selectedOrganization
        ? await fetchRoute(request, `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness`)
        : { ok: false, status: 0, error: 'No selected organization available for organization readiness.' }
    const organizationProof = organizationReadinessProof(organizationReadiness)
    const alertRows = rows((alerts.json as { alerts?: unknown[] } | undefined)?.alerts)
    const deliveryRows = rows((deliveries.json as { deliveries?: unknown[] } | undefined)?.deliveries) as DwmDeliveryItem[]
    const caseRows = rows((cases.json as { cases?: unknown[] } | undefined)?.cases)
    const webhookRows = rows((organizationWebhooks.json as { destinations?: unknown[] } | undefined)?.destinations) as DwmOrganizationWebhookDestination[]
    const selectedCase = selectCaseForProductProgress(alertRows, caseRows, deliveryRows)
    const selectedCaseDetailRoute = selectedCase?.id ? `/api/cases/${encodeURIComponent(String(selectedCase.id))}` : undefined
    const selectedCaseDetail = selectedCaseDetailRoute
        ? await fetchRoute(request, selectedCaseDetailRoute)
        : { ok: false, status: 0, error: 'No selected analyst case was available for case detail readiness.' }
    const selectedCaseProof = analystCaseDetailProof(selectedCaseDetail, selectedCaseDetailRoute || '/api/cases/:id')
    const normalizedSourceProxy = normalizeSourceProxy(sourceProxy, query, generatedAt)
    return buildProductProgressPayload({
        generatedAt, checkedAt: generatedAt, query, routes,
        publicTiProvenance: publicTiProvenanceReadiness({ generatedAt, query, route: routes.publicTiProvenance || '/api/ti/search', fetch: publicTi }),
        sourceProxy: normalizedSourceProxy,
        dwmProduct: dwmProductReadiness({ generatedAt, route: routes.dwmProduct || '/api/findings/product', fetch: dwmProduct }),
        alerts: alertRows,
        alertGeneration: alertGenerationReadiness({ generatedAt, route: routes.alertGenerationReadiness || '/api/findings/alerts/generation-readiness', fetch: alertGeneration }),
        deliveries: deliveryRows, cases: caseRows, caseDetail: selectedCaseProof,
        orgAlertExport: orgAlertExportReadiness({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness` : routes.orgAlertExport || '/api/findings/watchlists',
            organization: selectedOrganization, watchlists: watchlistRows, fetchOk: watchlists.ok, fetchStatus: watchlists.status,
            fetchError: watchlists.error, readinessProof: organizationProof,
        }),
        entitlement: entitlementReadinessFromOrganizationProof({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/alert-readiness` : routes.organizationReadiness || '/api/organizations/:id/alert-readiness',
            organization: selectedOrganization, fetch: organizationReadiness, readinessProof: organizationProof,
        }),
        webhookHealth: webhookHealthReadiness({
            generatedAt,
            route: selectedOrganization ? `/api/organizations/${encodeURIComponent(selectedOrganization.id)}/webhooks` : routes.webhookHealth || '/api/organizations/:id/webhooks',
            organization: selectedOrganization, productProgress: webhookProductProgressProof(organizationWebhooks), destinations: webhookRows,
            deliveries: deliveryRows, fetchOk: organizationWebhooks.ok || webhookRows.length > 0,
            fetchStatus: organizationWebhooks.status, fetchError: organizationWebhooks.error,
        }),
        deploy: deployProbeReadiness({ generatedAt, route: routes.deployProbe || '/api/status', fetch: deployStatus, sourceProxyOk: sourceProxyReady(normalizedSourceProxy) }),
    })
}
