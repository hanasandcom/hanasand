type ServiceSummary = { service: string, last_seen: string, entries: number }

export function mergeLogServices<T extends ServiceSummary>(groups: readonly (readonly T[])[]): T[] {
    const services = new Map<string, T>()
    for (const service of groups.flat()) {
        const current = services.get(service.service)
        if (!current) {
            services.set(service.service, { ...service })
            continue
        }
        current.entries += Number(service.entries || 0)
        if (new Date(service.last_seen).getTime() > new Date(current.last_seen).getTime()) {
            current.last_seen = service.last_seen
        }
    }
    return [...services.values()].sort((a, b) => a.service.localeCompare(b.service))
}
