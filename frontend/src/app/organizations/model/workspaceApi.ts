import { apiErrorMessage, objectValue } from './labels'
import { sanitizeOrganizationDisplayCopy } from './textSafety'
import type { ApiError, DwmAlertBridgeResult } from '../types/activity'

export async function requestJson<T = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    const response = await fetch(url, { ...init, headers, cache: 'no-store' })
    const payload = await safeJson(response)
    if (!response.ok) {
        const error = new Error(apiErrorMessage(payload, response.status)) as ApiError
        error.status = response.status
        const code = objectValue(objectValue(payload)?.error)?.code
        if (typeof code === 'string') error.code = code
        throw error
    }
    return payload as T
}

async function safeJson(response: Response): Promise<unknown> {
    try { return await response.json() } catch { return {} }
}

export function watchlistMutationMessage(bridge: DwmAlertBridgeResult | undefined, fallback: string) {
    if (!bridge) return fallback
    if (bridge.schemaVersion === 'organization.watchlist_projection_receipt.v1') {
        const status = bridge.projection?.status
        if (bridge.projection?.reason === 'no_changed_items') return `${fallback} No watchlist changes needed synchronization. Events were not rebuilt.`
        if (status === 'synchronized' || status === 'unchanged') return `${fallback} Monitoring synchronized. Events were not rebuilt.`
        return { message: `${fallback} Monitoring synchronization ${status === 'pending' ? 'is pending' : 'did not complete'}. Events were not rebuilt.`, warning: true }
    }
    if (bridge.skipped) return { message: `${fallback} Event sync skipped: ${humanizeBridgeReason(bridge.reason)}.`, warning: true }
    if (bridge.savedAlertCount && bridge.savedAlertCount > 0) {
        const firstAlert = bridge.firstAlert
        const matched = firstAlert?.matchedTerm || bridge.matchedTerms?.[0]
        const family = firstAlert?.sourceFamily || bridge.sourceFamilies?.[0]
        const evidence = firstAlert?.evidenceCount
        const route = firstAlert?.recommendedRoute
        return [
            fallback,
            `${bridge.savedAlertCount} event${bridge.savedAlertCount === 1 ? '' : 's'} generated`,
            matched ? `term ${matched}` : undefined,
            family ? `source ${family}` : undefined,
            evidence ? `${evidence} evidence item${evidence === 1 ? '' : 's'}` : undefined,
            route ? `action ${route}` : undefined,
        ].filter(Boolean).join(' · ') + '.'
    }
    if (bridge.ok) {
        const terms = bridge.matchedTerms?.length ? ` for ${bridge.matchedTerms.join(', ')}` : ''
        return `${fallback} No matching captures found${terms}.`
    }
    return { message: `${fallback} Event sync did not complete${bridge.reason ? `: ${humanizeBridgeReason(bridge.reason)}` : ''}.`, warning: true }
}

function humanizeBridgeReason(value: unknown) {
    return sanitizeOrganizationDisplayCopy(String(value || 'unavailable').replace(/_/g, ' ')) || 'unavailable'
}
