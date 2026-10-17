export function formatLocalDateTime(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}
