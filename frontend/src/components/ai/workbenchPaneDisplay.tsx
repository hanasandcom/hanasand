import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'

export function Panel({
    icon,
    title,
    subtitle,
    children,
    grow = false,
}: {
    icon: React.ReactNode
    title: string
    subtitle: string
    children: React.ReactNode
    grow?: boolean
}) {
    return (
        <section className={`min-w-0 max-w-full rounded-lg bg-ui-panel p-3 outline outline-ui-border ${grow ? 'min-h-0 flex-1' : ''}`}>
            <div className='flex items-start gap-3'>
                <div className='mt-0.5 rounded-lg bg-ui-primary/12 p-2 text-ui-primary outline outline-ui-primary/18'>
                    {icon}
                </div>
                <div className='min-w-0'>
                    <div className='text-[11px] uppercase tracking-[0.18em] text-ui-muted'>{title}</div>
                    <div className='mt-1 text-sm text-ui-text'>{subtitle}</div>
                </div>
            </div>
            <div className={`mt-3 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-2 ${grow ? 'min-h-0' : ''}`}>{children}</div>
        </section>
    )
}

export function Stat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg bg-ui-raised px-3 py-2 outline outline-ui-border'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-ui-muted'>{label}</div>
            <div className='mt-1 text-sm text-ui-text'>{value}</div>
        </div>
    )
}

export function TrustItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
            <span className='mt-0.5 text-ui-primary'>{icon}</span>
            <div className='min-w-0'>
                <div className='text-[10px] uppercase tracking-[0.18em] text-ui-muted'>{label}</div>
                <div className='mt-1 leading-5'>{value}</div>
            </div>
        </div>
    )
}

export function Empty({ text }: { text: string }) {
    return (
        <div className='rounded-lg bg-ui-raised px-3 py-4 text-sm text-ui-muted outline outline-ui-border'>
            {text}
        </div>
    )
}

export function PreviewLink({ href, emptyText }: { href: string | null | undefined, emptyText: string }) {
    if (!href) {
        return <div className='mt-1 text-[11px] text-ui-muted'>{emptyText}</div>
    }

    return (
        <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-1 inline-flex max-w-full items-center gap-1 text-[11px] text-ui-primary/85 underline decoration-ui-primary/25 underline-offset-4 transition-colors hover:text-ui-primary'
            title={href}
        >
            <span className='truncate'>{href}</span>
            <ExternalLink className='h-3 w-3 shrink-0' />
        </a>
    )
}

export function ChecklistItem({ label, state }: { label: string, state: 'ready' | 'needs_input' | 'automatic' }) {
    const ready = state === 'ready' || state === 'automatic'

    return (
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-ui-raised px-2.5 py-2 text-xs text-ui-muted outline outline-ui-border'>
            <span className='min-w-0 flex-1 basis-48 wrap-break-word'>{label}</span>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${ready ? 'bg-ui-success/12 text-ui-success' : 'bg-ui-warning/12 text-ui-warning'}`}>
                {ready ? <CheckCircle2 className='h-3 w-3' /> : <AlertTriangle className='h-3 w-3' />}
                {state === 'automatic' ? 'auto' : state === 'ready' ? 'ready' : 'needed'}
            </span>
        </div>
    )
}

export function PathBadge({
    path,
    selected,
    recentPaths,
    lastChangedPath,
}: {
    path: string
    selected: boolean
    recentPaths: string[]
    lastChangedPath: string | null
}) {
    if (selected) {
        return <span className='shrink-0 rounded-full bg-ui-primary/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ui-primary'>Open</span>
    }

    if (lastChangedPath === path) {
        return <span className='shrink-0 rounded-full bg-ui-success/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ui-success'>Changed</span>
    }

    if (recentPaths.includes(path)) {
        return <span className='shrink-0 rounded-full bg-ui-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Recent</span>
    }

    return null
}

export function formatActivityTime(value: string | null) {
    if (!value) {
        return 'Unknown'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }

    return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`
}

export function formatUsageKind(kind: AIUsageEventKind) {
    switch (kind) {
        case 'conversation_created':
            return 'Conversation created'
        case 'message_written':
            return 'Message written'
        case 'deployment_started':
            return 'Launch started'
        case 'release_recorded':
            return 'Launch report recorded'
        case 'rollback_marked':
            return 'Rollback marked'
        case 'collaborator_invited':
            return 'Collaborator invited'
        case 'collaborator_removed':
            return 'Collaborator removed'
        default:
            return kind
    }
}
