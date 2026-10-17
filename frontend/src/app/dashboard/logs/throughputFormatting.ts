export const FIVE_MINUTES = 5 * 60_000
const timeOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }

export function format(value: number) {
    return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(1)
}
export function sampleTime(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-US', timeOptions)
}
export function timeWindow(value: string) {
    const end = new Date(value)
    const start = new Date(end.getTime() - FIVE_MINUTES)
    return `${start.toLocaleString('en-US', timeOptions)} – ${end.toLocaleString('en-US', timeOptions)}`
}
export function age(value: string, now: number) {
    const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000))
    if (seconds < 60) return `Last changed ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Last changed ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Last changed ${hours}h ago`
    return `Last changed ${new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}`
}
