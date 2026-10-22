export function backendTargetBase(pathSegments: string[], apiUrl: string, aiUrl: string, logsApiUrl?: string, allowDirectLogs = true) {
    if (pathSegments[0] === 'ai') return { url: aiUrl, directLogsRead: false }
    const supportedLogsRead = pathSegments[0] === 'logs' && (
        (pathSegments.length === 2 && ['search', 'realtime', 'services', 'metrics', 'tuning'].includes(pathSegments[1]))
        || (pathSegments.length === 3 && pathSegments[1] === 'services' && pathSegments[2] === 'summary')
        || (pathSegments.length === 3 && pathSegments[1] === 'metrics' && pathSegments[2] === 'public')
        || (pathSegments.length === 3 && pathSegments[1] === 'tuning' && pathSegments[2] === 'refresh')
    )
    if (allowDirectLogs && supportedLogsRead && logsApiUrl?.trim()) {
        return { url: logsApiUrl.trim().replace(/\/+$/, ''), directLogsRead: true }
    }
    return { url: apiUrl, directLogsRead: false }
}

export function applyOrganizationId(target: URL, organizationId?: string | null) {
    if (organizationId && !target.searchParams.has('organizationId')) target.searchParams.set('organizationId', organizationId)
    return target
}
