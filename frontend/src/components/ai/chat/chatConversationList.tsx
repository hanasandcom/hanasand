import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import { AppPromptDialog } from '@/components/ui/appDialog'

export function ConversationList({
    conversations,
    activeConversationId,
    onArchiveConversation,
    onDeleteConversation,
    onRenameConversation,
    onSelectConversation,
    archived = false,
}: {
    conversations: AIConversation[]
    activeConversationId: string | null
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
    archived?: boolean
}) {
    const [renamingConversation, setRenamingConversation] = useState<AIConversation | null>(null)

    if (!conversations.length) {
        return <div className='px-1 py-3 text-sm text-ui-muted'>No {archived ? 'archived' : 'active'} sessions yet.</div>
    }

    return (
        <>
            <AppPromptDialog
                open={Boolean(renamingConversation)}
                title='Rename review'
                label='Session name'
                initialValue={renamingConversation ? conversationTitle(renamingConversation.title) : ''}
                onCancel={() => setRenamingConversation(null)}
                onConfirm={(nextTitle) => {
                    if (renamingConversation) void onRenameConversation(renamingConversation.id, nextTitle)
                    setRenamingConversation(null)
                }}
            />
            <div className='min-h-0 flex-1 space-y-1 overflow-y-auto pr-1'>
                {conversations.map((conversation) => (
                    <div
                        key={conversation.id}
                        role='button'
                        tabIndex={0}
                        onClick={() => onSelectConversation(conversation.id)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                onSelectConversation(conversation.id)
                            }
                        }}
                        className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${conversation.id === activeConversationId ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                    >
                        <div className='min-w-0 flex-1 overflow-hidden'>
                            <div className='truncate text-sm'>{conversationTitle(conversation.title)}</div>
                        </div>
                        <div className='flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'>
                            <MiniButton label={`Rename ${conversationTitle(conversation.title)}`} icon={<Pencil className='h-3.5 w-3.5' />} onClick={(event) => {
                                event.stopPropagation()
                                setRenamingConversation(conversation)
                            }} />
                            <MiniButton label={archived ? `Restore ${conversationTitle(conversation.title)}` : `Archive ${conversationTitle(conversation.title)}`} icon={archived ? <ArchiveRestore className='h-3.5 w-3.5' /> : <Archive className='h-3.5 w-3.5' />} onClick={(event) => {
                                event.stopPropagation()
                                void onArchiveConversation(conversation.id, !archived)
                            }} />
                            <MiniButton label={`Delete ${conversationTitle(conversation.title)}`} danger icon={<Trash2 className='h-3.5 w-3.5' />} onClick={(event) => {
                                event.stopPropagation()
                                void onDeleteConversation(conversation.id)
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

function conversationTitle(title?: string | null) {
    const normalized = title?.trim()
    return !normalized || normalized === 'New chat' || normalized === 'New workspace review' || normalized === 'Workspace review' ? 'Review assistant' : normalized
}

function MiniButton({ label, icon, danger = false, onClick }: {
    label: string
    icon: React.ReactNode
    danger?: boolean
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
    return (
        <button type='button' aria-label={label} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${danger ? 'text-ui-text hover:bg-ui-raised/10' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>
            {icon}
        </button>
    )
}
