import type { AnalystCaseDetailProofInput } from '@/utils/productProgress/readiness'
import type { DwmDeliveryItem, DwmOrganizationSummary } from '@/app/dashboard/operatorConsoleModel'
import type { DashboardSourceProofProxyPayload } from '@/utils/productProgress/payloadTypes'
import { isDurableDelivered } from '@/utils/productProgress/readiness'

export type FetchResult = {
    ok: boolean
    status: number
    json?: unknown
    error?: string
}

export type ProductProgressRequest = {
    nextUrl: { origin: string, searchParams: Pick<URLSearchParams, 'get'> }
    headers: Pick<Headers, 'get'>
}

export function sourceProxyReady(input: DashboardSourceProofProxyPayload) {
    return Boolean(input.ok && input.endpoints?.sourceInventory?.ok)
}

export type DwmWebhookProductProgressProof = {
    schemaVersion: 'dwm.webhook.destination_admin_product_progress.v1'
    status?: string
    destinationCount?: number
    activeDestinationCount?: number
    deliveryReadyCount?: number
    retryEligibleCount?: number
    liveDeliveryEnabled?: boolean
    blockerCodes?: string[]
    href?: string
}

export function productProgressRoutes(query: string) {
    const encoded = encodeURIComponent(query)
    return {
        productProgress: '/api/product-progress',
        publicTiProvenance: query ? `/api/ti/search?q=${encoded}&limit=10` : undefined,
        helpdeskAudit: '/api/backend/admin/support/access-recovery',
        deployProbe: '/api/status',
        sourceProxy: `/api/ti/scraper/control?q=${encoded}`,
        entitlement: '/api/findings/entitlements/readiness',
        organizationReadiness: '/api/organizations/:id/alert-readiness',
        orgAlertExport: '/api/findings/watchlists',
        webhookHealth: '/api/organizations/:id/webhooks',
        dashboardAlerts: '/api/findings/alerts',
        alertGenerationReadiness: '/api/findings/alerts/generation-readiness',
        cases: '/api/cases',
        organizations: '/api/organizations',
        watchlists: '/api/findings/watchlists',
        operations: '/api/findings/operations',
        dwmProduct: '/api/findings/product',
        deliveries: '/api/findings/webhooks/deliveries',
        organizationWebhooks: '/api/organizations/:id/webhooks',
        supportRecovery: '/api/backend/admin/support/access-recovery',
        adminAuditEvents: '/api/backend/admin/audit-events?limit=50',
    }
}

export async function fetchInternalJson(request: ProductProgressRequest, route: string): Promise<FetchResult> {
    try {
        const target = new URL(route, internalFrontendOrigin(request))
        copyScopedParams(request, target)
        const response = await fetch(target, {
            cache: 'no-store',
            headers: forwardedHeaders(request),
            signal: AbortSignal.timeout(3000),
        })
        const text = await response.text()
        return {
            ok: response.ok,
            status: response.status,
            json: text ? JSON.parse(text) as unknown : undefined,
        }
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

function internalFrontendOrigin(request: ProductProgressRequest) {
    return process.env.FRONTEND_INTERNAL_ORIGIN
        || process.env.NEXT_INTERNAL_ORIGIN
        || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:3000' : request.nextUrl.origin)
}

function copyScopedParams(request: ProductProgressRequest, target: URL) {
    for (const name of ['organizationId', 'tenantId', 'userEmail', 'userId', 'actor']) {
        const value = request.nextUrl.searchParams.get(name)
        if (value && !target.searchParams.has(name)) target.searchParams.set(name, value)
    }
}

function forwardedHeaders(request: ProductProgressRequest) {
    const headers = new Headers()
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    for (const name of ['authorization', 'x-tenant-id', 'x-organization-id']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    return headers
}

export function normalizeSourceProxy(result: FetchResult, query: string, generatedAt: string): DashboardSourceProofProxyPayload {
    if (result.ok && result.json && typeof result.json === 'object') {
        return result.json as DashboardSourceProofProxyPayload
    }
    return {
        ok: false,
        generatedAt,
        query,
        baseConfigured: false,
        error: {
            code: result.status ? 'source_proxy_http_error' : 'source_proxy_fetch_failed',
            message: result.error || `Source proxy returned HTTP ${result.status}.`,
        },
    }
}

export function rows(value: unknown[] | undefined) {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : []
}

export function selectCaseForProductProgress(alerts: Array<Record<string, unknown>>, cases: Array<Record<string, unknown>>, deliveries: DwmDeliveryItem[]) {
    const deliveryAlertIds = new Set(deliveries.filter(row => isDurableDelivered(row.status)).map(row => row.alertId).filter(Boolean))
    const selectedAlert = alerts.find(row => row.id && deliveryAlertIds.has(String(row.id)))
        || alerts.find(row => row.id)
    if (!selectedAlert?.id) return undefined
    return cases.find(row => row.id && row.alertId === selectedAlert.id && !['closed', 'false_positive', 'suppressed'].includes(String(row.status || '')))
}

export function analystCaseDetailProof(fetch: FetchResult, route: string): AnalystCaseDetailProofInput {
    const payload = fetch.json as {
        schemaVersion?: string
        access?: { readOnly?: boolean, canMutate?: boolean }
        case?: {
            id?: string
            alertId?: string
            status?: string
            assignedOwner?: string
            updatedAt?: string
            createdAt?: string
        }
        timeline?: unknown[]
        proofLedger?: { generatedAt?: string }
    } | undefined
    return {
        route,
        fetchOk: fetch.ok,
        fetchStatus: fetch.status,
        fetchError: fetch.error,
        schemaVersion: payload?.schemaVersion,
        caseId: payload?.case?.id,
        alertId: payload?.case?.alertId,
        status: payload?.case?.status,
        assignedOwner: payload?.case?.assignedOwner,
        updatedAt: payload?.case?.updatedAt || payload?.case?.createdAt,
        readOnly: payload?.access?.readOnly,
        canMutate: payload?.access?.canMutate,
        timelineCount: rows(payload?.timeline).length,
        proofTimestamp: payload?.case?.updatedAt || payload?.case?.createdAt || payload?.proofLedger?.generatedAt,
    }
}

export function uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)))
}

export function selectOrganization(payload: unknown, request: ProductProgressRequest, activeOrganization?: string): DwmOrganizationSummary | undefined {
    const organizations = rows((payload as { organizations?: unknown[] } | undefined)?.organizations) as DwmOrganizationSummary[]
    const requestedId = request.nextUrl.searchParams.get('organizationId') || request.headers.get('x-organization-id') || activeOrganization || ''
    return organizations.find(item => item.id === requestedId)
}


export function stringsFrom(input: unknown) {
    return Array.isArray(input) ? input.filter(Boolean).map(String) : []
}

export function stringOrUndefined(input: unknown) {
    return typeof input === 'string' && input.trim() ? input : undefined
}

export function latestTimestamp(values: string[]) {
    return values
        .filter(value => !Number.isNaN(new Date(value).getTime()))
        .sort()
        .at(-1)
}
