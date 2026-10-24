'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquarePlus, Search, SquareArrowOutUpRight } from 'lucide-react'
import { ConversationList } from './chat/chatConversationList'

type ChatSidebarProps = {
    activeConversationId: string | null
    archivedConversations: AIConversation[]
    conversations: AIConversation[]
    allConversations: AIConversation[]
    repositories: AIImportedRepo[]
    search: string
    setSearch: (value: string) => void
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onNewConversation: () => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
    onPatchConversation: (id: string, patch: Partial<AIConversation>) => void
    onBranchConversation: (conversation: AIConversation) => void
    setStatusNotice: (notice: string | null) => void
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const {
        activeConversationId,
        archivedConversations,
        conversations,
        allConversations,
        repositories,
        search,
        setSearch,
        onArchiveConversation,
        onDeleteConversation,
        onNewConversation,
        onRenameConversation,
        onSelectConversation,
        onPatchConversation,
        onBranchConversation,
        setStatusNotice,
    } = props
    const [showArchived, setShowArchived] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    return (
        <aside className='flex h-full min-h-0 flex-col border-r border-ui-border bg-ui-panel p-4 text-ui-text'>
            <div className='flex items-center justify-between gap-2 pb-4'>
                <button type='button' onClick={onNewConversation} className='inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-transparent px-3 text-sm font-semibold text-ui-text transition-colors hover:bg-ui-raised'>
                    <MessageSquarePlus className='h-4 w-4' />
                    New chat
                </button>
                <div className='flex items-center gap-1'>
                    <button type='button' aria-label='Search sessions' aria-pressed={searchOpen} onClick={() => setSearchOpen((prev) => !prev)} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-ui-raised hover:text-ui-text ${searchOpen ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>
                        <Search className='h-4 w-4' />
                    </button>
                    <Link href='/s' aria-label='Open context' className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text'>
                        <SquareArrowOutUpRight className='h-4 w-4' />
                    </Link>
                </div>
            </div>

            {searchOpen ? (
                <label className='relative mb-3 block'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder='Search sessions'
                        className='w-full rounded-lg border border-ui-border bg-ui-raised py-2.5 pl-10 pr-3 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    />
                </label>
            ) : null}

            <div className='mb-2 px-1 text-xs font-medium text-ui-muted'>
                Chats
            </div>

            <ConversationList
                conversations={conversations}
                allConversations={allConversations}
                repositories={repositories}
                activeConversationId={activeConversationId}
                onArchiveConversation={onArchiveConversation}
                onDeleteConversation={onDeleteConversation}
                onRenameConversation={onRenameConversation}
                onSelectConversation={onSelectConversation}
                onPatchConversation={onPatchConversation}
                onBranchConversation={onBranchConversation}
                setStatusNotice={setStatusNotice}
            />

            <div className='mt-5 border-t border-ui-border pt-4'>
                <button type='button' onClick={() => setShowArchived((prev) => !prev)} className='flex min-h-8 w-full items-center justify-between rounded-lg px-1 text-[11px] font-semibold uppercase text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text'>
                    <span>Archived</span>
                </button>
                {showArchived ? (
                    <div className='mt-3'>
                        <ConversationList
                            conversations={archivedConversations}
                            allConversations={allConversations}
                            repositories={repositories}
                            activeConversationId={activeConversationId}
                            onArchiveConversation={onArchiveConversation}
                            onDeleteConversation={onDeleteConversation}
                            onRenameConversation={onRenameConversation}
                            onSelectConversation={onSelectConversation}
                            onPatchConversation={onPatchConversation}
                            onBranchConversation={onBranchConversation}
                            setStatusNotice={setStatusNotice}
                            archived
                        />
                    </div>
                ) : null}
            </div>
        </aside>
    )
}
