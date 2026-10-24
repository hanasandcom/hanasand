'use client'

import ChatSidebar from '@/components/ai/chatSidebar'
import type useAiWorkbench from '@/components/ai/useAiWorkbench'

type Workbench = ReturnType<typeof useAiWorkbench>

export function PageChatSidebar({
    ai,
    onNewConversation,
    onSelectConversation,
    onBranchConversation,
}: {
    ai: Workbench
    onNewConversation: () => void
    onSelectConversation: (id: string) => void
    onBranchConversation: (conversation: AIConversation) => void
}) {
    return <ChatSidebar
        activeConversationId={ai.activeConversationId}
        archivedConversations={ai.archivedConversations}
        conversations={ai.filteredConversations}
        allConversations={ai.allConversations}
        repositories={ai.importedRepos}
        search={ai.search}
        setSearch={ai.setSearch}
        onArchiveConversation={ai.archiveConversation}
        onDeleteConversation={ai.deleteConversation}
        onNewConversation={onNewConversation}
        onRenameConversation={ai.renameConversation}
        onSelectConversation={onSelectConversation}
        onPatchConversation={ai.patchConversation}
        onBranchConversation={onBranchConversation}
        setStatusNotice={ai.setStatusNotice}
    />
}
