import type { PublicTiHandoffAction, PublicTiHandoffDecodeFailureCode, PublicTiHandoffDecodeResult, PublicTiHandoffPayload } from './actorWorkbenchTypes'
import { PUBLIC_TI_HANDOFF_ACTIONS } from './actorWorkbenchTypes'

export function selectedPayloadForAction(action: PublicTiHandoffAction, payloads: PublicTiHandoffPayload['actionPayloads']) {
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) return payloads.alertRebuild
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.case) return payloads.case
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.enrichment) return payloads.enrichment
    return payloads.watchlist
}

export function labelForHandoffAction(action: PublicTiHandoffAction) {
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist) return 'Create Watchlist'
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild) return 'Rebuild Alerts'
    if (action === PUBLIC_TI_HANDOFF_ACTIONS.case) return 'Open Case'
    return 'Add Context'
}

export function normalizeHandoffAction(value: string | null | undefined): PublicTiHandoffAction | null {
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.watchlist || value === 'watchlist') return PUBLIC_TI_HANDOFF_ACTIONS.watchlist
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild || value === 'alert_rebuild') return PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.case || value === 'case') return PUBLIC_TI_HANDOFF_ACTIONS.case
    if (value === PUBLIC_TI_HANDOFF_ACTIONS.enrichment || value === 'enrichment') return PUBLIC_TI_HANDOFF_ACTIONS.enrichment
    return null
}

export function decodeMaybeURIComponent(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value.trim().startsWith('{') ? value : null
    }
}

export function failure(code: PublicTiHandoffDecodeFailureCode, message: string): PublicTiHandoffDecodeResult {
    return { ok: false, code, message, reasonCodes: [code] }
}

export function readPayloadQuery(payloads: PublicTiHandoffPayload['actionPayloads']) {
    return [payloads.watchlist, payloads.alertRebuild, payloads.case, payloads.enrichment]
        .map(payload => payload.query)
        .find(query => typeof query === 'string' && query.trim()) ?? ''
}

export function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
