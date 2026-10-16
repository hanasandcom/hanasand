export function formatDatabaseBytes(bytes: number | null) {
    if (bytes === null || !Number.isFinite(bytes)) return '—'
    if (bytes <= 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1000 && index < units.length - 1) {
        value /= 1000
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}
