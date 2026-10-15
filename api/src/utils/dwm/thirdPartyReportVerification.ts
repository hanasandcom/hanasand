import { validateOutboundThirdPartyReport } from './thirdPartyReport.ts'

export async function canonicalThirdPartyReportForDelivery(input: {
    submittedReport: unknown
    organizationId: string
    alertId: unknown
    dedupeKey: unknown
    actorId: string
    authorization?: string
}, fetcher: typeof fetch = fetch) {
    const submitted = validateOutboundThirdPartyReport(input.submittedReport, {
        organizationId: input.organizationId,
        alertId: input.alertId,
        dedupeKey: input.dedupeKey,
    })
    if (!submitted.valid || !submitted.report) {
        return { status: 400, code: 'invalid_third_party_report', error: submitted.error || 'The submitted report is invalid.' }
    }

    const policy = submitted.report.reportPolicy as Record<string, unknown>
    const caseId = clean(policy.caseId)
    const alertId = clean(policy.alertId)
    const evidenceIds = Array.isArray(policy.evidenceIds) ? policy.evidenceIds.map(clean).filter(Boolean) : []
    const format = clean(policy.format) === 'hanasand-json' ? 'json' : 'stix'
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is not configured.' }
    }

    let url: URL
    try {
        url = new URL(`${base}/v1/cases/${encodeURIComponent(caseId)}/export`)
    } catch {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is not configured.' }
    }
    url.searchParams.set('organizationId', input.organizationId)
    url.searchParams.set('alertId', alertId)
    url.searchParams.set('report', 'true')
    url.searchParams.set('format', format)
    for (const evidenceId of evidenceIds) url.searchParams.append('evidenceId', evidenceId)
    let response: Response
    try {
        response = await fetcher(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'x-hanasand-service-token': token,
                'x-organization-id': input.organizationId,
                id: input.actorId,
                ...(input.authorization ? { authorization: input.authorization } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(20_000),
        })
    } catch {
        return { status: 503, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is temporarily unavailable.' }
    }
    let payload: Record<string, unknown>
    try {
        payload = await response.json() as Record<string, unknown>
    } catch {
        return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification returned an invalid response.' }
    }
    if (!response.ok) {
        if (response.status >= 500) {
            return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification is temporarily unavailable.' }
        }
        return {
            status: response.status >= 400 && response.status < 500 ? response.status : 502,
            code: 'canonical_third_party_report_rejected',
            error: 'Canonical report verification rejected the requested case evidence.',
        }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { status: 502, code: 'third_party_report_verification_unavailable', error: 'Canonical report verification returned an invalid response.' }
    }

    const canonicalPolicy = payload.reportPolicy as Record<string, unknown>
    const canonicalChecksum = clean(payload.exportChecksum)
    const canonical = validateOutboundThirdPartyReport(payload, {
        organizationId: input.organizationId,
        alertId,
        dedupeKey: canonicalChecksum,
    })
    const exactSelection = clean(canonicalPolicy.caseId) === caseId
        && clean(canonicalPolicy.alertId) === alertId
        && clean(canonicalPolicy.format) === clean(policy.format)
        && JSON.stringify(canonicalPolicy.evidenceIds) === JSON.stringify(evidenceIds)
    if (!canonical.valid || !canonical.report || !exactSelection) {
        return { status: 502, code: 'canonical_third_party_report_invalid', error: canonical.error || 'The canonical report did not match the requested case evidence.' }
    }
    if (canonicalChecksum !== clean(submitted.report.exportChecksum)) {
        return { status: 409, code: 'third_party_report_checksum_mismatch', error: 'The submitted report checksum does not match the canonical case export.' }
    }
    return { status: 200, report: canonical.report }
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
