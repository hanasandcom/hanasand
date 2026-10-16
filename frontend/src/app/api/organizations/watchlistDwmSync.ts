import { cookies } from 'next/headers'
import { bearerToken, arrayOfStrings, numberValue, objectValue, parseJsonObject, stringValue, type JsonRecord } from './watchlistDwmValues'
import { buildDwmWatchlistMirrorPayloads, type DwmWatchlistMirrorPayload } from './watchlistDwmPayload'
import { buildDwmWatchlistMirrorAlertPreview } from './watchlistDwmPreview'

export { buildDwmWatchlistMirrorAlertPreview } from './watchlistDwmPreview'
export type { DwmWatchlistMirrorAlertPreview } from './watchlistDwmPreview'

type MirrorResult = {
    ok: boolean
    status: number
    rebuildStatus: string
    watchlistId: string
    watchlistStatus: string
    savedAlertCount: number
    alertIds: string[]
    sourceFamilies: string[]
    matchedTerms: string[]
    error?: unknown
}

export async function mirrorOrganizationWatchlistToDwm(request: Request, organizationId: string, organizationPayload: JsonRecord) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const mirrorPayloads = buildDwmWatchlistMirrorPayloads({ organizationId, organizationPayload })
    if (!base) return { ok: false, skipped: true, reason: 'ti_scraper_api_base_unset', mirrorPayloads }
    if (!mirrorPayloads.length) return { ok: false, skipped: true, reason: 'missing_watchlist_item', mirrorPayloads: [] }

    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('access_token')?.value || bearerToken(request.headers.get('authorization')) || ''
        const id = cookieStore.get('id')?.value || request.headers.get('id') || ''
        const authHeaders = {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        }
        return await mirrorOrganizationWatchlistToDwmResult({ base, organizationId, mirrorPayloads, authHeaders })
    } catch (error) {
        const first = mirrorPayloads[0]
        return {
            ok: false,
            status: 502,
            watchlistId: first.id,
            watchlistStatus: first.status,
            savedAlertCount: 0,
            alertIds: [],
            sourceFamilies: [],
            matchedTerms: [],
            error: { code: 'dwm_watchlist_mirror_failed', message: error instanceof Error ? error.message : String(error) },
        }
    }
}

export async function mirrorOrganizationWatchlistToDwmResult(input: {
    base: string
    organizationId: string
    mirrorPayloads: DwmWatchlistMirrorPayload[]
    authHeaders?: Record<string, string>
    fetchImpl?: typeof fetch
}) {
    const fetchImpl = input.fetchImpl ?? fetch
    const mirrors = []
    for (const mirrorPayload of input.mirrorPayloads) {
        const response = await fetchImpl(new URL('/v1/dwm/watchlists', input.base), {
            method: 'POST', cache: 'no-store',
            headers: { 'content-type': 'application/json', 'x-tenant-id': input.organizationId, 'x-organization-id': input.organizationId, ...input.authHeaders },
            body: JSON.stringify(mirrorPayload), signal: AbortSignal.timeout(12000),
        })
        const payload = parseJsonObject(await response.text())
        const watchlist = objectValue(payload.watchlist)
        const alertRebuild = objectValue(payload.alertRebuild)
        const rebuildStatus = typeof alertRebuild?.status === 'string' ? alertRebuild.status.toLowerCase() : response.ok ? 'completed' : 'failed'
        const alertIds = arrayOfStrings(alertRebuild?.alertIds)
        const savedAlertCount = numberValue(alertRebuild?.savedAlertCount) ?? 0
        const ok = response.ok && !['failed', 'error', 'unavailable', 'queued', 'running', 'pending'].includes(rebuildStatus) && savedAlertCount > 0 && alertIds.length > 0
        const hasCompletedAlerts = response.ok && rebuildStatus === 'completed' && Number(alertRebuild?.savedAlertCount ?? 0) > 0
        mirrors.push({
            ok, status: response.status, rebuildStatus,
            watchlistId: stringValue(watchlist?.id) ?? mirrorPayload.id,
            watchlistStatus: mirrorPayload.status, savedAlertCount, alertIds,
            sourceFamilies: arrayOfStrings(alertRebuild?.sourceFamilies),
            matchedTerms: arrayOfStrings(alertRebuild?.matchedTerms),
            error: hasCompletedAlerts ? undefined : payload.error ?? rebuildError(response.ok, rebuildStatus),
        })
    }
    return summarizeMirrorResults(input, mirrors, fetchImpl)
}

function rebuildError(responseOk: boolean, status: string) {
    const message = !responseOk ? 'DWM watchlist sync failed.'
        : ['queued', 'running', 'pending'].includes(status) ? 'Watchlist sync is still waiting for persisted alert results.'
            : 'Watchlist sync completed without a persisted alert match.'
    return { code: responseOk ? `dwm_alert_rebuild_${status}` : 'dwm_watchlist_mirror_failed', message }
}

async function summarizeMirrorResults(input: {
    base: string
    organizationId: string
    authHeaders?: Record<string, string>
}, mirrors: MirrorResult[], fetchImpl: typeof fetch) {
    const first = mirrors[0]
    const alertIds = Array.from(new Set(mirrors.flatMap(item => item.alertIds)))
    const firstAlert = alertIds[0] ? await fetchDwmAlertPreview(input.base, alertIds[0], input.organizationId, input.authHeaders ?? {}, fetchImpl) : undefined
    const allOk = mirrors.every(item => item.ok)
    return {
        ok: allOk,
        status: allOk ? first.status : 502,
        rebuildStatus: mirrors.find(item => item.rebuildStatus !== 'completed')?.rebuildStatus ?? 'completed',
        watchlistId: first.watchlistId,
        watchlistStatus: first.watchlistStatus,
        savedAlertCount: mirrors.reduce((total, item) => total + item.savedAlertCount, 0),
        alertIds,
        sourceFamilies: Array.from(new Set(mirrors.flatMap(item => item.sourceFamilies))),
        matchedTerms: Array.from(new Set(mirrors.flatMap(item => item.matchedTerms))),
        firstAlert, mirrors, error: mirrors.find(item => item.error)?.error,
    }
}

async function fetchDwmAlertPreview(base: string, alertId: string, organizationId: string, authHeaders: Record<string, string>, fetchImpl: typeof fetch = fetch) {
    const target = new URL(`/v1/dwm/alerts/${encodeURIComponent(alertId)}`, base)
    target.searchParams.set('tenantId', organizationId)
    target.searchParams.set('organizationId', organizationId)
    const response = await fetchImpl(target, {
        cache: 'no-store', headers: { 'x-tenant-id': organizationId, 'x-organization-id': organizationId, ...authHeaders },
        signal: AbortSignal.timeout(12000),
    }).catch(() => null)
    if (!response?.ok) return undefined
    return buildDwmWatchlistMirrorAlertPreview(parseJsonObject(await response.text()))
}
