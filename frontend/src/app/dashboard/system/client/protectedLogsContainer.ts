export function isProtectedLogsContainer(name: string) {
    const normalized = name.replace(/^\/+/, '').toLowerCase()
    return normalized === 'processor'
        || normalized === 'logs'
        || normalized === 'hanasand-log-collector'
        || normalized.includes('hanasand-log-collector')
        || normalized.startsWith('logs-')
        || normalized.startsWith('logs_')
        || /(?:^|[-_])(?:logs|processor)(?:[-_]|$)/i.test(normalized)
}
