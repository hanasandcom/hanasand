export function backendTargetBase(pathSegments: string[], apiUrl: string, aiUrl: string, logsApiUrl?: string, allowDirectLogs = true) {
    if (pathSegments[0] === 'ai') return { url: aiUrl, directLogsRead: false }
    const supportedLogRuleHitRead = pathSegments[0] === 'rules' && (
        (pathSegments.length === 2 && pathSegments[1] === 'hits')
        || (pathSegments.length === 3 && ['hits', 'storage-estimate'].includes(pathSegments[2]))
    )
    const supportedLogsRead = supportedLogRuleHitRead || (pathSegments[0] === 'logs' && (
        (pathSegments.length === 2 && ['search', 'realtime', 'services', 'metrics', 'tuning', 'errors'].includes(pathSegments[1]))
        || (pathSegments.length === 3 && pathSegments[1] === 'services' && pathSegments[2] === 'summary')
        || (pathSegments.length === 3 && pathSegments[1] === 'metrics' && pathSegments[2] === 'public')
        || (pathSegments.length === 3 && pathSegments[1] === 'tuning' && pathSegments[2] === 'refresh')
    ))
    if (allowDirectLogs && supportedLogsRead && logsApiUrl?.trim()) {
        return { url: logsApiUrl.trim().replace(/\/+$/, ''), directLogsRead: true }
    }
    return { url: apiUrl, directLogsRead: false }
}

export function applyOrganizationId(target: URL, organizationId?: string | null) {
    if (organizationId && !target.searchParams.has('organizationId')) target.searchParams.set('organizationId', organizationId)
    return target
}
