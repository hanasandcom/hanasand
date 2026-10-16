import { PUBLIC_TI_HANDOFF_QUERY_PARAM, PUBLIC_TI_HANDOFF_INTENT_PARAM } from './actorWorkbenchTypes'
import type { PublicTiHandoffDecodeResult } from './actorWorkbenchTypes'
import { decodeMaybeURIComponent, failure } from './publicTiHandoffValues'
import { validatePublicTiHandoffPayload } from './publicTiHandoffValidation'

export function encodeHandoffPayload(payload: unknown) {
    return encodeURIComponent(JSON.stringify(payload))
}

export function decodePublicTiHandoffFromUrl(value: string | URL | URLSearchParams): PublicTiHandoffDecodeResult {
    if (value instanceof URL) {
        return decodePublicTiHandoffPayload(value.searchParams.get(PUBLIC_TI_HANDOFF_QUERY_PARAM), value.searchParams.get(PUBLIC_TI_HANDOFF_INTENT_PARAM))
    }
    if (value instanceof URLSearchParams) {
        return decodePublicTiHandoffPayload(value.get(PUBLIC_TI_HANDOFF_QUERY_PARAM), value.get(PUBLIC_TI_HANDOFF_INTENT_PARAM))
    }
    try {
        const url = new URL(value, 'https://hanasand.com')
        return decodePublicTiHandoffFromUrl(url)
    } catch {
        return decodePublicTiHandoffPayload(value, undefined)
    }
}

export function decodePublicTiHandoffPayload(encoded: string | null | undefined, intent?: string | null): PublicTiHandoffDecodeResult {
    if (!encoded) return failure('missing_payload', 'No public TI handoff payload was provided.')
    const decoded = decodeMaybeURIComponent(encoded)
    if (decoded === null) return failure('malformed_json', 'The public TI handoff payload is not valid URL-encoded JSON.')
    try {
        return validatePublicTiHandoffPayload(JSON.parse(decoded), intent)
    } catch {
        return failure('malformed_json', 'The public TI handoff payload is not valid JSON.')
    }
}
