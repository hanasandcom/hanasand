export function auditTimelineLink(input: { org?: string | null, target?: string | null, request?: string | null, action?: string | null, outcome?: string | null }) {
    const params = new URLSearchParams()
    if (input.org) params.set('org', input.org)
    if (input.target) params.set('target', input.target)
    if (input.request) params.set('request', input.request)
    if (input.action) params.set('action', input.action)
    if (input.outcome) params.set('outcome', input.outcome)
    params.set('source', 'admin')
    params.set('service', 'hanasand-api')
    const query = params.toString()
    return {
        api: `/api/admin/audit-events?${query}`,
        href: `/system/impersonation?${query}`,
    }
}
