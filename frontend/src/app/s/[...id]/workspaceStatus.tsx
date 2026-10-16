import type { ReactNode } from 'react'
import type { ShareConflict, SharePresenceUser } from '@/components/share/useShareCodeSocket'

export function CollaborationStatus({
    users,
    otherUsers,
    editors,
    notice,
    conflict,
    onDismissNotice,
    onUseRemote,
    onKeepMine,
}: {
    users: SharePresenceUser[]
    otherUsers: SharePresenceUser[]
    editors: SharePresenceUser[]
    notice: string | null
    conflict: ShareConflict | null
    onDismissNotice: () => void
    onUseRemote: () => void
    onKeepMine: () => void
}) {
    if (!users.length && !notice && !conflict) return null

    return (
        <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ui-border bg-ui-panel px-3 py-2 text-xs text-ui-muted shadow-lg backdrop-blur-md'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
                {otherUsers.length ? (
                    <div className='flex items-center gap-1.5'>
                        <div className='flex -space-x-1.5'>
                            {otherUsers.slice(0, 5).map(user => (
                                <span
                                    key={user.clientId}
                                    title={user.displayName}
                                    className='grid h-6 w-6 place-items-center rounded-full border border-ui-canvas text-[10px] font-bold text-ui-canvas'
                                    style={{ backgroundColor: user.color }}
                                >
                                    {initialsFor(user.displayName)}
                                </span>
                            ))}
                        </div>
                        <span className='text-[11px] text-ui-muted'>
                            {otherUsers.length === 1 ? '1 other user' : `${otherUsers.length} other users`}
                        </span>
                    </div>
                ) : users.length ? (
                    <span className='rounded-lg border border-ui-border bg-ui-raised px-2 py-1 text-[11px] text-ui-muted'>Only you here</span>
                ) : null}
                {editors.length ? (
                    <span className='rounded-lg border border-ui-primary/25 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary'>
                        {formatEditors(editors)} editing{formatCursor(editors[0])}
                    </span>
                ) : null}
                {notice && !conflict ? (
                    <button type='button' onClick={onDismissNotice} className='rounded-lg border border-ui-border bg-ui-raised px-2 py-1 text-[11px] text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-on-primary'>
                        {notice}
                    </button>
                ) : null}
            </div>
            {conflict ? (
                <div className='flex flex-wrap items-center gap-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-2 py-1.5 text-[11px] text-ui-warning'>
                    <span>{conflict.author?.displayName || 'Someone'} edited this while your change was unsaved.</span>
                    <button type='button' onClick={onUseRemote} className='rounded-md bg-ui-warning/15 px-2 py-1 font-semibold hover:bg-ui-warning/25'>Use theirs</button>
                    <button type='button' onClick={onKeepMine} className='rounded-md bg-ui-raised px-2 py-1 font-semibold hover:bg-ui-primary/10'>Keep mine</button>
                </div>
            ) : null}
        </div>
    )
}

export function StatusPill({ icon, label, tone }: {
    icon: ReactNode
    label: string
    tone: 'good' | 'warn' | 'neutral'
}) {
    const toneClass = tone === 'good'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : tone === 'warn'
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-border bg-ui-raised text-ui-muted'

    return (
        <span className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold ${toneClass}`}>
            {icon}
            {label}
        </span>
    )
}

export function normalizeTerminalStatus(status: string) {
    const normalized = status.trim().replace(/\.$/, '')
    if (!normalized) return 'Terminal unknown'
    if (normalized.toLowerCase().includes('ready')) return 'Terminal ready'
    if (normalized.toLowerCase().includes('closed')) return 'Terminal closed'
    if (normalized.toLowerCase().includes('preparing')) return 'Terminal preparing'
    if (normalized.toLowerCase().includes('connecting')) return 'Terminal connecting'
    return normalized.length > 22 ? `${normalized.slice(0, 19)}...` : normalized
}

function initialsFor(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

function formatEditors(editors: SharePresenceUser[]) {
    if (editors.length === 1) return editors[0].displayName
    if (editors.length === 2) return `${editors[0].displayName} and ${editors[1].displayName}`
    return `${editors[0].displayName} and ${editors.length - 1} others`
}

function formatCursor(user: SharePresenceUser | undefined) {
    if (!user?.cursorLine) return ''
    return ` · line ${user.cursorLine}`
}
