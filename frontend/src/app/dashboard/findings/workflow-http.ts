import { normalizeAlertRebuildOutcome } from '@/utils/dwm/alertRebuildOutcome'
import { isRecord } from './workflow-values'

export async function postJson(path: string, body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<Record<string, unknown> & { ok: boolean, message: string }> {
    const response = await fetcher(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const error = payload.error as { message?: string } | undefined
    return {
        ...payload,
        ok: response.ok,
        message: error?.message || response.statusText,
    }
}

export async function alertRebuildFromWatchlistOrRequest(
    payload: Record<string, unknown>,
    scope: { tenantId: string, organizationId?: string },
    post: typeof postJson = postJson,
) {
    const inlineRebuild = isRecord(payload.alertRebuild) ? payload.alertRebuild : null
    if (inlineRebuild) return normalizeAlertRebuildOutcome(inlineRebuild)
    return normalizeAlertRebuildOutcome(await post('/api/findings/alerts/rebuild', scope))
}

export async function ingestPublicEvidence(
    input: { actor: string, company: string, claimedData: string, url: string },
    scope: { tenantId: string, organizationId?: string },
    post: typeof postJson = postJson,
) {
    return post('/api/findings/exposure-claims/ingest', {
        items: [{
            ...scope,
            company: input.company,
            claimedData: input.claimedData,
            sourceName: `${input.actor} public report`,
            sourceFamily: 'public_advisory',
            title: `${input.actor} reported a new issue involving ${input.company}`,
            text: `${input.actor} reported an issue involving ${input.company}. ${input.claimedData}.`,
            url: input.url || undefined,
        }],
    })
}

export function hasDurableSourceRequest(requestId: string, sourceId: string, duplicateOf: string) {
    return Boolean(requestId && (sourceId || duplicateOf))
}

export function hasDurableCase(caseId: string) {
    return Boolean(caseId)
}
