'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
    const rowRef = useRef<HTMLDivElement>(null)
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeMenu = useCallback(() => setMenu(null), [])
    const title = conversationTitle(conversation.title)
    const metadata = conversation.workspaceMeta || {}
    const isPinned = Boolean(metadata.sidebarPinnedAt)
    const isUnread = Boolean(metadata.sidebarUnreadAt)
    const branch = repository?.branch || null
    const repositoryName = repository?.fullName || repository?.name || null
    const organization = [metadata.sidebarProject, metadata.sidebarSection].filter((value): value is string => typeof value === 'string').join(' · ')

    const patchMeta = useCallback((updates: Record<string, unknown>) => {
        onPatch(conversation.id, { workspaceMeta: { ...conversation.workspaceMeta, ...updates } })
    }, [conversation.id, conversation.workspaceMeta, onPatch])

    useEffect(() => {
        if (!active) return

        function handleShortcuts(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.repeat || !rowRef.current?.getClientRects().length) return
            const target = event.target
            if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return

            const key = event.key.toLowerCase()
            let shortcut: 'rename' | 'pin' | 'read' | 'archive' | null = null
            if (event.altKey && !event.shiftKey) {
                if (key === 'r') shortcut = 'rename'
                if (key === 'p') shortcut = 'pin'
            } else if (event.shiftKey && !event.altKey) {
                if (key === 'u') shortcut = 'read'
                if (key === 'a') shortcut = 'archive'
            }
            if (!shortcut) return

            event.preventDefault()
            if (shortcut === 'rename') onRename(conversation)
            if (shortcut === 'pin') patchMeta({ sidebarPinnedAt: isPinned ? null : new Date().toISOString() })
            if (shortcut === 'read') patchMeta({ sidebarUnreadAt: isUnread ? null : new Date().toISOString() })
            if (shortcut === 'archive') onArchive(conversation.id, !archived)
        }

        document.addEventListener('keydown', handleShortcuts)
        return () => document.removeEventListener('keydown', handleShortcuts)
    }, [active, archived, conversation, isPinned, isUnread, onArchive, onRename, patchMeta])

    function openMenu(x: number, y: number) {
        setMenu({
            x: Math.max(8, Math.min(x, window.innerWidth - 296)),
            y: Math.max(8, Math.min(y, window.innerHeight - 440)),
        })
    }

    function showTooltip(element: HTMLElement) {
        const rect = element.getBoundingClientRect()
        setTooltip({
            left: Math.max(8, Math.min(rect.right + 8, window.innerWidth - 392)),
            top: Math.max(8, Math.min(rect.top, window.innerHeight - 224)),
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
        { label: 'Rename', icon: <Pencil />, shortcut: '⌥⌘R', onSelect: select(() => onRename(conversation)) },
        { label: isPinned ? 'Unpin' : 'Pin', icon: isPinned ? <PinOff /> : <Pin />, shortcut: '⌥⌘P', onSelect: select(() => patchMeta({ sidebarPinnedAt: isPinned ? null : new Date().toISOString() })) },
        { label: isUnread ? 'Mark as read' : 'Mark as unread', icon: isUnread ? <Eye /> : <EyeOff />, shortcut: '⇧⌘U', onSelect: select(() => patchMeta({ sidebarUnreadAt: isUnread ? null : new Date().toISOString() })) },
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
        { label: archived ? 'Restore' : 'Archive', icon: archived ? <ArchiveRestore /> : <Archive />, shortcut: '⇧⌘A', onSelect: select(() => onArchive(conversation.id, !archived)) },
        { label: 'Delete chat…', icon: <Trash2 />, danger: true, onSelect: select(() => onDelete(conversation)) },
    ]

    return (
        <div
            ref={rowRef}
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
                aria-keyshortcuts='Shift+F10 Meta+Alt+R Control+Alt+R Meta+Alt+P Control+Alt+P Shift+Meta+U Shift+Control+U Shift+Meta+A Shift+Control+A'
                aria-describedby={tooltip ? `chat-title-tooltip-${conversation.id}` : undefined}
                aria-label={`${title}. ${repositoryName ? `${repositoryName}. ` : ''}${branch ? `Branch: ${branch}. ` : ''}${organization ? `${organization}. ` : ''}Right-click or press Shift+F10 for chat actions.`}
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
            <div className='flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100'>
                <MiniButton label={isPinned ? `Unpin ${title}` : `Pin ${title}`} icon={isPinned ? <PinOff /> : <Pin />} onClick={() => patchMeta({ sidebarPinnedAt: isPinned ? null : new Date().toISOString() })} />
                <MiniButton label={archived ? `Restore ${title}` : `Archive ${title}`} icon={archived ? <ArchiveRestore /> : <Archive />} onClick={() => onArchive(conversation.id, !archived)} />
            </div>
            {tooltip ? <div id={`chat-title-tooltip-${conversation.id}`} className='pointer-events-none fixed z-40 max-h-[min(18rem,calc(100dvh-1rem))] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-ui-border/90 bg-ui-panel/95 px-4 py-3 text-ui-text shadow-[0_16px_48px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl' style={tooltip} role='tooltip'>
                <div className='break-words text-base font-semibold leading-snug'>{title}</div>
                {repositoryName ? <div className='mt-2 break-words text-xs leading-5 text-ui-muted'>⌂ {repositoryName}</div> : null}
                {branch ? <div className='mt-1 flex min-w-0 items-start gap-1 text-xs leading-5 text-ui-muted'><GitBranch className='mt-1 h-3 w-3 shrink-0' /><span className='break-all'>{branch}</span></div> : null}
                {organization ? <div className='mt-1 break-words text-xs leading-5 text-ui-muted'>{organization}</div> : null}
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
