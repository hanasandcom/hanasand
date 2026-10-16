import type { ProductReadinessExternalState } from '@/utils/productProgress/sourceGrowthTypes'
import type { DwmDeliveryItem, DwmOrganizationSummary, DwmOrganizationWebhookDestination, OperatorScope } from './operatorConsoleTypes'
import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import { sourceGrowthReady } from '@/utils/productProgress/readinessDetails'

export type ProductReadinessInput = {
    backendConfigured: boolean
    scope: OperatorScope
    organization?: DwmOrganizationSummary
    activeWebhooks: DwmOrganizationWebhookDestination[]
    activeMemberCount: number
    pendingInviteCount: number
    activeWatchlistCount: number
    termCount: number
    activeWebhookCount: number
    latestWatchlistAt?: string
    latestWebhookAt?: string
    sourceCoverage?: {
        sourceCount: number
        activeSourceCount: number
        captureCount: number
        watchlistMatchCount: number
        latestRunStatus?: string
        latestRunAt?: string
    }
    liveAlertCount: number
    liveAlertIds: string[]
    dashboardAlertDelivery?: DwmDeliveryItem
    latestDelivery?: DwmDeliveryItem
    externalReadiness?: ProductReadinessExternalState
}

export function createProductReadinessContext(input: ProductReadinessInput) {
    const organizationStatus: WorkbenchProductReadinessItem['status'] = !input.backendConfigured
        ? 'unavailable'
        : input.organization && input.activeMemberCount ? 'ready' : 'blocked'
    const watchlistStatus: WorkbenchProductReadinessItem['status'] = input.activeWatchlistCount && input.termCount ? 'ready' : 'needs_action'
    const sourceStatus: WorkbenchProductReadinessItem['status'] = !input.sourceCoverage
        ? 'unavailable'
        : input.sourceCoverage.activeSourceCount > 0 ? 'ready' : 'blocked'
    const alertStatus: WorkbenchProductReadinessItem['status'] = input.liveAlertCount > 0 ? 'ready' : input.activeWatchlistCount && input.sourceCoverage?.activeSourceCount ? 'needs_action' : 'blocked'
    const deliveryStatus: WorkbenchProductReadinessItem['status'] = input.dashboardAlertDelivery
        ? 'ready'
        : input.activeWebhookCount ? 'needs_action' : 'blocked'
    const readinessCheckedAt = new Date().toISOString()

    const publicTiProvenance = input.externalReadiness?.publicTiProvenance
    const helpdeskAudit = input.externalReadiness?.helpdeskAudit
    const deployProbe = input.externalReadiness?.deployProbe
    const sourceGrowth = input.externalReadiness?.sourceGrowth
    const dwmProduct = input.externalReadiness?.dwmProduct
    const orgAlertExport = input.externalReadiness?.orgAlertExport
    const webhookHealth = input.externalReadiness?.webhookHealth
    const dashboardEvidence = input.externalReadiness?.dashboardEvidence
    const analystWorkflow = input.externalReadiness?.analystWorkflow
    const alertGeneration = input.externalReadiness?.alertGeneration
    const entitlement = input.externalReadiness?.entitlement
    const sourceGrowthStatus: WorkbenchProductReadinessItem['status'] = sourceGrowthReady(sourceGrowth)
        ? 'ready'
        : sourceGrowth ? sourceGrowth.status === 'blocked' ? 'blocked' : 'needs_action' : 'unavailable'

    return { input, organizationStatus, watchlistStatus, sourceStatus, alertStatus, deliveryStatus, readinessCheckedAt, publicTiProvenance, helpdeskAudit, deployProbe, sourceGrowth, dwmProduct, orgAlertExport, webhookHealth, dashboardEvidence, analystWorkflow, alertGeneration, entitlement, sourceGrowthStatus }
}

export type ProductReadinessContext = ReturnType<typeof createProductReadinessContext>
