import { safeEvidenceExcerpt } from '@/utils/dwm/display'

export function sanitizeWorkbenchCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(/hanasand-live-status-\d+/gi, 'Hanasand live org')
        .replace(/hanasand-live-status/gi, 'Hanasand live org')
        .replace(/generation status/gi, 'generation status')
        .replace(/alertability status/gi, 'alertability status')
        .replace(/customer process status/gi, 'customer process status')
        .replace(/worker status/gi, 'worker status')
        .replace(/audit status/gi, 'audit trail')
        .replace(/status/gi, 'status')
        .replace(/readiness/gi, 'status')
        .replace(/receipt delivery/gi, 'delivery history')
        .replace(/receipt/gi, 'delivery')
}

export function safeWorkbenchDetail(value: string | undefined) {
    return safeEvidenceExcerpt(value || 'Safe excerpt is being prepared from this evidence.')
}
