export function isProtectedLogsContainer(name: string) {
    const normalized = name.replace(/^\/+/, '').toLowerCase()
    return normalized === 'processor'
        || normalized === 'logs'
        || normalized === 'hanasand-log-collector'
        || normalized.startsWith('logs-')
        || normalized.startsWith('logs_')
}
