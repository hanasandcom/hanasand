import { normalizeWatchlistRequestId } from '#utils/organizations/normalization/requestValues.ts'

type MutationMetadata = { requestId?: unknown, request_id?: unknown, reason?: unknown }

export function watchlistMutationDenialContext(body?: MutationMetadata, query?: MutationMetadata) {
    return {
        requestId: normalizeWatchlistRequestId(body?.requestId ?? body?.request_id ?? query?.requestId ?? query?.request_id),
        reason: typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : null,
    }
}
