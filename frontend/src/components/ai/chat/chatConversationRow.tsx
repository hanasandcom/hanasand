'use client'

import { useCallback, useRef, useState } from 'react'
import { Archive, ArchiveRestore, Copy, ExternalLink, Eye, EyeOff, FolderOpen, GitBranch, List, Pencil, Pin, PinOff, Share2, Trash2 } from 'lucide-react'
import { ChatContextMenu, type ChatContextMenuItem } from './chatContextMenu'
import conversationTitle from '@/utils/ai/conversationTitle'

type Props = {
    conversation: AIConversation
    repository: AIImportedRepo | null
    active: boolean
    archived: boolean
    onArchive: (id: string, archived: boolean) => void
    onSelect: (id: string) => void
    onPatch: (id: string, patch: Partial<AIConversation>) => void
    onRename: (conversation: AIConversation) => void
    onDelete: (conversation: AIConversation) => void
    onBranch: (conversation: AIConversation) => void
    onLabel: (conversation: AIConversation, kind: 'project' | 'section') => void
    setStatusNotice: (notice: string | null) => void
}

export function ChatConversationRow({
    conversation,
    repository,
    active,
    archived,
    onArchive,
    onSelect,
    onPatch,
    onRename,
    onDelete,
    onBranch,
    onLabel,
    setStatusNotice,
}: Props) {
    const [menu, setMenu] = useState<{ x: number, y: number } | null>(null)
    const [tooltip, setTooltip] = useState<{ left: number, top: number } | null>(null)
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeMenu = useCallback(() => setMenu(null), [])
    const title = conversationTitle(conversation.title)
    const metadata = conversation.workspaceMeta || {}
    const isPinned = Boolean(metadata.sidebarPinnedAt)
    const isUnread = Boolean(metadata.sidebarUnreadAt)
    const branch = repository?.branch || null
    const repositoryName = repository?.fullName || repository?.name || null
    const organization = [metadata.sidebarProject, metadata.sidebarSection].filter((value): value is string => typeof value === 'string').join(' · ')

    function patchMeta(updates: Record<string, unknown>) {
        onPatch(conversation.id, { workspaceMeta: { ...conversation.workspaceMeta, ...updates } })
    }

    function openMenu(x: number, y: number) {
        setMenu({
            x: Math.max(8, Math.min(x, window.innerWidth - 240)),
            y: Math.max(8, Math.min(y, window.innerHeight - 440)),
        })
    }

    function showTooltip(element: HTMLElement) {
        const rect = element.getBoundingClientRect()
        setTooltip({
            left: Math.max(8, Math.min(rect.right + 8, window.innerWidth - 296)),
            top: Math.max(8, Math.min(rect.top, window.innerHeight - 128)),
        })
    }

    async function copy(text: string, notice: string) {
        try {
            await navigator.clipboard.writeText(text)
            setStatusNotice(notice)
        } catch {
            setStatusNotice('Couldn’t copy to clipboard. Check browser permissions and try again.')
        }
    }

    function select(action: () => void) {
        return () => {
            action()
            setMenu(null)
        }
    }

    const menuItems: ChatContextMenuItem[] = [
        { label: 'Rename', icon: <Pencil />, onSelect: select(() => onRename(conversation)) },
        { label: isPinned ? 'Unpin' : 'Pin', icon: isPinned ? <PinOff /> : <Pin />, onSelect: select(() => patchMeta({ sidebarPinnedAt: isPinned ? null : new Date().toISOString() })) },
        { label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? <Eye /> : <EyeOff />, onSelect: select(() => patchMeta({ sidebarUnreadAt: isUnread ? null : new Date().toISOString() })) },
        { label: '', separator: true, onSelect: () => {} },
        { label: 'Move to project…', icon: <FolderOpen />, onSelect: select(() => onLabel(conversation, 'project')) },
        ...(metadata.sidebarProject ? [{ label: 'Remove from project', onSelect: select(() => patchMeta({ sidebarProject: null })) }] : []),
        { label: 'Move to section…', icon: <List />, onSelect: select(() => onLabel(conversation, 'section')) },
        ...(metadata.sidebarSection ? [{ label: 'Remove from section', onSelect: select(() => patchMeta({ sidebarSection: null })) }] : []),
        { label: '', separator: true, onSelect: () => {} },
        { label: 'Branch in new chat', icon: <GitBranch />, onSelect: select(() => onBranch(conversation)) },
        { label: 'Share chat link', icon: <Share2 />, onSelect: select(() => void copy(new URL(`/ai/${conversation.id}`, window.location.origin).toString(), 'Chat link copied.')) },
        { label: 'Copy chat', icon: <Copy />, onSelect: select(() => void copy(formatTranscript(conversation), 'Chat copied.')) },
        { label: 'Open in new tab', icon: <ExternalLink />, onSelect: select(() => { window.open(`/ai/${conversation.id}`, '_blank', 'noopener,noreferrer') }) },
        { label: '', separator: true, onSelect: () => {} },
        { label: archived ? 'Restore' : 'Archive', icon: archived ? <ArchiveRestore /> : <Archive />, onSelect: select(() => onArchive(conversation.id, !archived)) },
        { label: 'Delete chat…', icon: <Trash2 />, danger: true, onSelect: select(() => onDelete(conversation)) },
    ]

    return (
        <div
            className={`group relative flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${active ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'} ${isUnread ? 'font-semibold text-ui-text' : ''}`}
            onMouseEnter={(event) => showTooltip(event.currentTarget)}
            onMouseLeave={() => setTooltip(null)}
            onContextMenu={(event) => { event.preventDefault(); openMenu(event.clientX, event.clientY) }}
            onPointerDown={(event) => {
                if (event.pointerType === 'touch') longPressRef.current = setTimeout(() => openMenu(event.clientX, event.clientY), 650)
            }}
            onPointerUp={() => { if (longPressRef.current) clearTimeout(longPressRef.current); longPressRef.current = null }}
            onPointerLeave={() => { if (longPressRef.current) clearTimeout(longPressRef.current); longPressRef.current = null }}
        >
            <button
                type='button'
                aria-current={active ? 'page' : undefined}
                aria-keyshortcuts='Shift+F10'
                aria-label={`${title}. ${organization ? `${organization}. ` : ''}Right-click or press Shift+F10 for chat actions.`}
                title={[title, repositoryName, branch ? `Branch: ${branch}` : null, organization || null].filter(Boolean).join('\n')}
                onClick={() => { onSelect(conversation.id); if (isUnread) patchMeta({ sidebarUnreadAt: null }) }}
                onFocus={(event) => showTooltip(event.currentTarget)}
                onBlur={() => setTooltip(null)}
                onKeyDown={(event) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        openMenu(rect.left, rect.bottom)
                    }
                }}
                className='min-w-0 flex-1 truncate rounded-md py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ui-primary'
            >
                <span className='block truncate'>{title}</span>
            </button>
            {isUnread ? <span aria-label='Unread' title='Unread' className='h-2 w-2 shrink-0 rounded-full bg-ui-primary' /> : null}
            <div className='flex shrink-0 items-center gap-0.5'>
                <MiniButton label={isPinned ? `Unpin ${title}` : `Pin ${title}`} icon={isPinned ? <PinOff /> : <Pin />} onClick={() => patchMeta({ sidebarPinnedAt: isPinned ? null : new Date().toISOString() })} />
                <MiniButton label={archived ? `Restore ${title}` : `Archive ${title}`} icon={archived ? <ArchiveRestore /> : <Archive />} onClick={() => onArchive(conversation.id, !archived)} />
            </div>
            {tooltip ? <div className='pointer-events-none fixed z-40 w-72 rounded-lg border border-ui-border bg-ui-panel p-3 text-ui-text shadow-xl' style={tooltip} role='tooltip'>
                <div className='truncate text-sm font-semibold'>{title}</div>
                {repositoryName ? <div className='mt-1 truncate text-xs text-ui-muted'>⌂ {repositoryName}</div> : null}
                {branch ? <div className='mt-1 flex min-w-0 items-center gap-1 truncate text-xs text-ui-muted'><GitBranch className='h-3 w-3 shrink-0' /><span className='truncate'>{branch}</span></div> : null}
                {organization ? <div className='mt-1 truncate text-xs text-ui-muted'>{organization}</div> : null}
            </div> : null}
            {menu ? <ChatContextMenu title={title} position={menu} items={menuItems} onClose={closeMenu} /> : null}
        </div>
    )
}

function formatTranscript(conversation: AIConversation) {
    return conversation.messages
        .map((message) => `${message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'Tool'}:\n${message.content}`)
        .join('\n\n')
}

function MiniButton({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) {
    return <button
        type='button'
        aria-label={label}
        title={label}
        onClick={(event) => { event.stopPropagation(); onClick() }}
        className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition-colors hover:bg-ui-panel hover:text-ui-text focus-visible:bg-ui-panel focus-visible:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary'
    >
        <span className='[&>svg]:h-3.5 [&>svg]:w-3.5'>{icon}</span>
    </button>
}
