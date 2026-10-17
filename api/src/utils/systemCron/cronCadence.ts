export function cronCadenceSeconds(schedule: string) {
    const parts = schedule.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const minute = parts[0]
    if (parts.slice(1).some(field => field !== '*')) return null
    if (minute === '*') return 60
    const every = minute.match(/^\*\/(\d+)$/)
    if (!every) return null
    const intervalMinutes = Number(every[1])
    return intervalMinutes > 0 && intervalMinutes <= 60 && 60 % intervalMinutes === 0
        ? intervalMinutes * 60
        : null
}
