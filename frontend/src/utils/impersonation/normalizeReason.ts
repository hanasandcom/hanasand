export function normalizeImpersonationReason(reason: string) {
    return reason.trim().replace(/\s+/g, ' ')
}
