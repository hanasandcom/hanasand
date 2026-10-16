export type ActivityTone = 'neutral' | 'ok' | 'watch' | 'bad'

export function ActivityStatusPill({ label, tone }: { label: string, tone: ActivityTone }) {
    const classes = activityToneClasses(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

export function activityToneClasses(tone: ActivityTone) {
    if (tone === 'ok') return { bg: 'border border-ui-success bg-ui-raised', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'border border-ui-warning bg-ui-raised', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'border border-ui-danger bg-ui-raised', text: 'text-ui-text' }
    return { bg: 'border border-ui-primary bg-ui-raised', text: 'text-ui-primary' }
}

export function relativeAge(value: string) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000))
    if (!Number.isFinite(minutes)) return 'checking'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}
