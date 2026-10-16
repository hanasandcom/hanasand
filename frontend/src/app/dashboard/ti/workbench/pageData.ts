import type { DwmAlert } from '@/utils/dwm/product'
import type { DwmOrganizationState } from '../../operatorConsoleModel'
import type { WorkbenchCase } from './types'
import type { WorkbenchDwmCaseListItem, WorkbenchDwmDelivery } from './pageTypes'
import { dwmAlertToWorkbenchCase } from './alertAdapter'
import { caseDashboardHref, dwmCaseToWorkbenchCase } from './pageCaseAdapter'

export const WORKBENCH_FETCH_TIMEOUT_MS = 800

export function emptyOrganizationState(): DwmOrganizationState {
    return {
        organizations: [],
        members: [],
        pendingInvites: [],
        webhooks: [],
    }
}

export async function loadDwmAlerts(): Promise<DwmAlert[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/alerts', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(WORKBENCH_FETCH_TIMEOUT_MS) })
        if (!response.ok) return []
        const payload = await response.json() as { alerts?: DwmAlert[] }
        return payload.alerts || []
    } catch {
        return []
    }
}

export async function loadDwmCases(): Promise<WorkbenchDwmCaseListItem[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/cases', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(WORKBENCH_FETCH_TIMEOUT_MS) })
        if (!response.ok) return []
        const payload = await response.json() as { cases?: WorkbenchDwmCaseListItem[] }
        return (payload.cases || []).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    } catch {
        return []
    }
}

export async function loadDwmDeliveries(): Promise<WorkbenchDwmDelivery[]> {
    const base = process.env.TI_SCRAPER_API_BASE
    if (!base) return []

    try {
        const target = new URL('/v1/dwm/webhooks/deliveries', base)
        target.searchParams.set('tenantId', 'default')
        const response = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(WORKBENCH_FETCH_TIMEOUT_MS) })
        if (!response.ok) return []
        const payload = await response.json() as { deliveries?: WorkbenchDwmDelivery[] }
        return (payload.deliveries || []).sort((a, b) => String(b.attemptedAt ?? '').localeCompare(String(a.attemptedAt ?? '')))
    } catch {
        return []
    }
}

export function attachCasesToAlerts(alerts: DwmAlert[], cases: WorkbenchDwmCaseListItem[]): DwmAlert[] {
    if (!cases.length) return alerts
    const caseByAlertId = new Map<string, WorkbenchDwmCaseListItem>()
    for (const item of cases) {
        const alertId = String(item.alertId || '')
        if (alertId) caseByAlertId.set(alertId, item)
    }
    return alerts.map(alert => {
        const caseRow = caseByAlertId.get(alert.id)
        if (!caseRow) return alert
        const caseId = String(caseRow.caseId || caseRow.id || '')
        const organizationId = caseRow.organizationId
        return {
            ...alert,
            organizationId: organizationId || (alert as DwmAlert & { organizationId?: string }).organizationId,
            caseId: caseId || (alert as DwmAlert & { caseId?: string }).caseId,
            casePath: caseId ? caseDashboardHref(caseRow) : (alert as DwmAlert & { casePath?: string }).casePath,
            assignedOwner: caseRow.assignedOwner || (alert as DwmAlert & { assignedOwner?: string }).assignedOwner,
            workflowStatus: caseRow.status || (alert as DwmAlert & { workflowStatus?: string }).workflowStatus,
            updatedAt: caseRow.updatedAt || (alert as DwmAlert & { updatedAt?: string }).updatedAt,
        } as DwmAlert
    })
}

export function attachDeliveriesToAlerts(alerts: DwmAlert[], deliveries: WorkbenchDwmDelivery[]): DwmAlert[] {
    if (!deliveries.length) return alerts
    return alerts.map(alert => ({
        ...alert,
        deliveries: deliveries.filter(delivery => delivery.alertId === alert.id),
    }))
}

export function buildWorkbenchCases(alerts: DwmAlert[], liveCases: WorkbenchDwmCaseListItem[] = []): WorkbenchCase[] {
    const alertCases = alerts.map(dwmAlertToWorkbenchCase)
    const alertIds = new Set(alerts.map(alert => alert.id))
    const linkedCaseRows = liveCases
        .filter(item => String(item.alertId || '') && !alertIds.has(String(item.alertId)))
        .map(dwmCaseToWorkbenchCase)
    return [...linkedCaseRows, ...alertCases]
        .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}
