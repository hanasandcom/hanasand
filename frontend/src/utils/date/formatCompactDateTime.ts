export default function formatCompactDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
