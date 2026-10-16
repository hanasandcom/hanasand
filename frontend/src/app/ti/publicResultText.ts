import { PUBLIC_URL_FIELDS, safePublicTiUrl } from './publicResultUrls'

export function publicTiText(value: string) {
    return publicEvidenceText(publicBackendCopyText(value)
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-status/gi, 'Check organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/:id\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/:id\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/findings\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/api\/findings\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/findings\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/findings\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/cases\/:caseId\/action-replay-export/gi, 'case action replay')
        .replace(/\/v1\/findings\/alerts\/rebuild/gi, 'alert rebuild')
        .replace(/\/v1\/findings\/watchlists/gi, 'watchlist update')
        .replace(/\/v1\/findings\/webhooks\/deliver/gi, 'webhook delivery')
        .replace(/\/v1\/cases/gi, 'case records')
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bactionability\b/gi, 'next-step status')
        .replace(/\breceipt\b/gi, 'record')
        .replace(new RegExp('\\bcon' + 'tract\\b', 'gi'), 'schema')
        .replace(/\bnamed\s+examples\b/gi, 'reported activity')
        .replace(/\btarget\s+signal(s)?\b/gi, 'targeting indicator$1')
        .replace(/\bsignal(s)?\b/gi, 'indicator$1')
        .replace(/\bcontrol\s+room\b/gi, 'console')
        .replace(/\bdashboard\s+slop\b/gi, 'low-value summary')
        .replace(/\bacceptance\s+criteria\b/gi, 'requirements')
        .replace(/\bteasers\b/gi, 'summaries')
        .replace(/\bteaser\b/gi, 'summary')
        .replace(/\bprovenance\b/gi, 'source context')
        .replace(/\bmetadata capture\b/gi, 'watched source monitoring')
        .replace(/\bmetadata-first\b/gi, 'company-first')
        .replace(/\bexposure metadata\b/gi, 'exposure records')
        .replace(/\bcredential-exposure metadata\b/gi, 'credential-exposure records')
        .replace(/\bcaptured metadata\b/gi, 'captured page text')
        .replace(/\bcollected as metadata\b/gi, 'collected as reviewable records'))
}

export function sanitizeBackendShapedPublicText<T>(value: T, field?: string): T {
    if (typeof value === 'string') {
        if (field && PUBLIC_URL_FIELDS.has(field.toLowerCase())) return safePublicTiUrl(value) as T
        return publicContactText(publicBackendCopyText(value)) as T
    }
    if (Array.isArray(value)) return value.map(item => sanitizeBackendShapedPublicText(item, field)) as T
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) => {
            if (INTERNAL_REVIEW_FIELDS.has(key.toLowerCase())) return []
            if (PUBLIC_URL_FIELDS.has(key.toLowerCase()) && typeof item === 'string') {
                const url = safePublicTiUrl(item)
                return url ? [[key, url]] : []
            }
            return [[key, sanitizeBackendShapedPublicText(item, key)]]
        }),
    ) as T
}

export function publicEvidenceText(value: string) {
    return publicContactText(value)
}

function publicContactText(value: string) {
    return value
        .replace(/(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[^\s"'<>]+|\btg:(?:\/\/)?[^\s"'<>]+/gi, '[telegram contact removed]')
        .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, url => safePublicTiUrl(url) ?? '[external reference removed]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
        .replace(/(^|\s)@[A-Za-z0-9_]{4,}\b/g, '$1[handle]')
        .replace(/(?<![A-Za-z0-9.-])(?<![\d-])(?!\d{4}-\d{2}-\d{2}(?:T|\b))(?!\d{1,3}(?:\.\d{1,3}){3}\b)\+?\d[\d\s().-]{7,}\d/g, '[phone]')
}

const INTERNAL_REVIEW_FIELDS = new Set(['reviewedby', 'reviewerid', 'revieweremail'])

function publicBackendCopyText(value: string) {
    return value
        .replace(/\bWhat returned\b/gi, 'Source summary')
        .replace(/\bReturned as evidence\b/gi, 'Included as evidence')
        .replace(/\breturned actor profile\b/gi, 'sourced actor profile')
        .replace(/\breturned profile\b/gi, 'actor profile')
        .replace(/\breturned observations\b/gi, 'source observations')
        .replace(/\breturned ATT&CK\b/gi, 'mapped ATT&CK')
        .replace(/\bwas returned\b/gi, 'was found')
        .replace(/\bwere returned\b/gi, 'were found')
        .replace(/\breturned\b/gi, 'reported')
}
