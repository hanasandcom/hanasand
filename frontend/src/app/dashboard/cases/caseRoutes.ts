export function caseDetailHref(caseId: string, alertId?: string, organizationId?: string, route?: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (alertId) params.set('alertId', alertId)
    if (route) params.set('route', route)
    const query = params.toString()
    return `/cases/${encodeURIComponent(caseId)}${query ? `?${query}` : ''}`
}
