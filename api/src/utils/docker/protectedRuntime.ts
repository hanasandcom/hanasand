const protectedRuntimeName = /(?:^|[-_])(?:logs|processor)(?:[-_]|$)/i

export function isProtectedLogsRuntime(name: string, project?: string, service?: string) {
    const normalizedName = name.replace(/^\/+/, '').toLowerCase()
    const normalizedProject = project?.toLowerCase()
    const normalizedService = service?.toLowerCase()

    return normalizedName === 'logs'
        || normalizedName === 'processor'
        || normalizedName === 'hanasand-log-collector'
        || normalizedName.includes('hanasand-log-collector')
        || protectedRuntimeName.test(normalizedName)
        || normalizedProject === 'logs'
        || normalizedProject === 'processor'
        || Boolean(normalizedService && (/^logs[-_]/i.test(normalizedService)
            || normalizedService === 'processor'
            || normalizedService === 'hanasand-log-collector'))
}
