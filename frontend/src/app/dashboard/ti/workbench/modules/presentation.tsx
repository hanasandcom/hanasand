import type { WorkbenchCase, QueueFilter, WorkbenchWorkflowStep } from '../types'

export function workbenchSummary(cases: WorkbenchCase[]) {
    const latestCase = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    return {
        total: cases.length,
        review: cases.filter(item => /review|needs|new|pending/i.test(item.status)).length,
        highPriority: cases.filter(item => item.severity === 'critical' || item.severity === 'high').length,
        persistent: cases.filter(item => item.persistent).length,
        evidence: cases.filter(item => item.evidence.length > 0).length,
        latest: latestCase ? relativeTime(latestCase.updatedAt) : 'listening',
    }
}

export function WorkbenchStat({ icon, label: statLabel, value, detail, tone, className = '' }: { icon: React.ReactNode, label: string, value: string, detail: string, tone: 'neutral' | 'good' | 'warn', className?: string }) {
    const toneClass = tone === 'good'
        ? 'text-ui-success'
        : tone === 'warn'
            ? 'text-ui-warning'
            : 'text-ui-primary'

    return (
        <div className={`rounded-lg border border-ui-border bg-ui-panel px-3 py-2 ${className}`}>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-ui-muted'>{statLabel}</p>
                <span className={toneClass}>{icon}</span>
            </div>
            <p className='mt-2 text-lg font-semibold text-ui-text'>{value}</p>
            <p className='mt-0.5 truncate text-xs text-ui-muted'>{detail}</p>
        </div>
    )
}

export function filterCases(cases: WorkbenchCase[], filter: QueueFilter, query: string) {
    const clean = query.trim().toLowerCase()
    return cases.filter(item => {
        if (filter === 'critical' && item.severity !== 'critical') return false
        if (filter === 'high' && item.severity !== 'high') return false
        if (filter === 'persistent' && !item.persistent) return false
        if (filter === 'evidence' && item.kind !== 'source_capture') return false
        if (!clean) return true
        return `${item.title} ${item.subtitle} ${item.actor} ${item.company} ${item.matchedTerm} ${item.queue}`.toLowerCase().includes(clean)
    })
}

export function queueSummary(cases: WorkbenchCase[]) {
    const counts = new Map<string, number>()
    for (const item of cases) counts.set(item.queue, (counts.get(item.queue) ?? 0) + 1)
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
}

export function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-ui-raised/10 px-2 py-0.5 text-xs font-semibold text-ui-text'
    if (severity === 'high') return 'rounded-full bg-ui-raised/10 px-2 py-0.5 text-xs font-semibold text-ui-text'
    if (severity === 'medium') return 'rounded-full bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-primary'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-muted'
}

export function workflowStatusClass(status: WorkbenchWorkflowStep['status']) {
    if (status === 'ready') return 'rounded-full bg-ui-success/10 px-2 py-0.5 text-[11px] font-semibold text-ui-success '
    if (status === 'blocked') return 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning '
    return 'rounded-full bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-primary '
}

export function label(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'review'
    return value.replaceAll('_', ' ')
}

export function customerOperationalText(value: string) {
    return value
        .replace(/\baction_required\b/gi, 'reviewing')
        .replace(/\baction required\b/gi, 'reviewing')
        .replace(/\bneeds action\b/gi, 'reviewing')
        .replace(/\bneeds work\b/gi, 'reviewing')
        .replace(new RegExp('\\bneeds pr' + 'oof\\b', 'gi'), 'collecting evidence')
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source reference')
        .replace(new RegExp('\\bpr' + 'oof\\b', 'gi'), 'evidence')
        .replace(/\bblocked until\b/gi, 'syncing until')
        .replace(/\bblocked\b/gi, 'syncing')
        .replace(/\bblockers?\b/gi, 'follow-up')
}

export function relativeTime(value: string) {
    if (!value) return 'Time unavailable'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}

export function formatSeconds(value?: number) {
    if (!value || value <= 0) return 'checking'
    if (value < 60) return `${value}s`
    const minutes = Math.round(value / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

export function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
