import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from './_organizationApiProxy'
import { parseJsonObject } from './watchlistDwmValues'
import { mirrorOrganizationWatchlistToDwm } from './watchlistDwmSync'

type MutationMethod = 'POST' | 'PUT' | 'DELETE'

export async function proxyOrganizationWatchlistMutation(request: NextRequest, path: string, input: { method: MutationMethod, organizationId: string }) {
    const response = await proxyOrganizationApiRequest(request, path, {
        method: input.method,
        forwardImpersonation: false,
    })
    const organizationPayload = parseJsonObject(await response.text())
    if (!response.ok) {
        return NextResponse.json(organizationPayload, { status: response.status, headers: { 'cache-control': 'no-store' } })
    }

    const dwmAlertBridge = await mirrorOrganizationWatchlistToDwm(request, input.organizationId, organizationPayload)
    const result = buildOrganizationWatchlistResponse(organizationPayload, response.status, dwmAlertBridge)
    return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } })
}

export function buildOrganizationWatchlistResponse(organizationPayload: Record<string, unknown>, organizationStatus: number, dwmAlertBridge: { ok?: boolean, rebuildStatus?: unknown }) {
    if (dwmAlertBridge.ok) return {
        body: { ...organizationPayload, dwmAlertBridge },
        status: organizationStatus,
    }
    const rebuildStatus = 'rebuildStatus' in dwmAlertBridge && typeof dwmAlertBridge.rebuildStatus === 'string'
        ? dwmAlertBridge.rebuildStatus
        : 'failed'
    const completedEmpty = rebuildStatus === 'completed'
    const pending = ['queued', 'running', 'pending'].includes(rebuildStatus)
    return {
        body: {
            ...organizationPayload,
            error: {
                code: completedEmpty ? 'dwm_alert_rebuild_empty' : pending ? 'dwm_alert_rebuild_pending' : 'dwm_watchlist_sync_failed',
                message: completedEmpty
                    ? 'The watchlist term was saved, but no persisted alert matched the retained evidence.'
                    : pending
                        ? 'The watchlist term was saved; DWM alert rebuilding is still in progress.'
                        : 'The watchlist term was saved, but DWM sync failed. Sync the saved term again to reconcile it.',
            },
            retryable: !completedEmpty,
            dwmAlertBridge,
        },
        status: completedEmpty ? organizationStatus : pending ? 202 : 502,
    }
}
