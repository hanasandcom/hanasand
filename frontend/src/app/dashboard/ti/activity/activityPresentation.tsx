export function relativeAge(value: string) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'checking'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}
