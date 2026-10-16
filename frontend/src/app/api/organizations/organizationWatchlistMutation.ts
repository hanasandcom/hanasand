import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { bearerToken, parseJsonObject } from './watchlistDwmValues'
import { mirrorOrganizationWatchlistToDwm } from './watchlistDwmSync'

type MutationMethod = 'POST' | 'PUT' | 'DELETE'

export async function proxyOrganizationWatchlistMutation(request: NextRequest, path: string, input: { method: MutationMethod, organizationId: string }) {
    const bodyText = await request.text()
    const organizationResult = await forwardOrganizationMutation(request, path, input.method, bodyText)
    if (organizationResult.status < 200 || organizationResult.status >= 300) {
        return NextResponse.json(organizationResult.payload, { status: organizationResult.status, headers: { 'cache-control': 'no-store' } })
    }

    const dwmAlertBridge = await mirrorOrganizationWatchlistToDwm(request, input.organizationId, organizationResult.payload)
    const result = buildOrganizationWatchlistResponse(organizationResult.payload, organizationResult.status, dwmAlertBridge)
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

async function forwardOrganizationMutation(request: NextRequest, path: string, method: MutationMethod, bodyText: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
        const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`)
        for (const [key, value] of request.nextUrl.searchParams.entries()) target.searchParams.set(key, value)
        const response = await fetch(target, {
            method, cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-tenant-id': request.headers.get('x-tenant-id') || 'default',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(id ? { id } : {}),
            },
            body: bodyText, signal: AbortSignal.timeout(12000),
        })
        return { payload: parseJsonObject(await response.text()), status: response.status }
    } catch (error) {
        return {
            status: 502,
            payload: { error: { code: 'organization_proxy_failed', message: error instanceof Error ? error.message : String(error) } },
        }
    }
}
