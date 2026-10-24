'use client'

import { useMemo, useState } from 'react'
import { AppConfirmDialog, AppPromptDialog } from '@/components/ui/appDialog'
import conversationTitle from '@/utils/ai/conversationTitle'
import { workspaceRepositoryId } from '@/components/ai/workbench/workspaceMetadata'
import { ChatConversationRow } from './chatConversationRow'

type LabelPrompt = { kind: 'project' | 'section', conversation: AIConversation, initialValue: string } | null

export function ConversationList({
    conversations,
    allConversations,
    repositories,
    activeConversationId,
    onArchiveConversation,
    onDeleteConversation,
    onRenameConversation,
    onSelectConversation,
    onPatchConversation,
    onBranchConversation,
    setStatusNotice,
    archived = false,
}: {
    conversations: AIConversation[]
    allConversations: AIConversation[]
    repositories: AIImportedRepo[]
    activeConversationId: string | null
    onArchiveConversation: (id: string, archived: boolean) => void
    onDeleteConversation: (id: string) => void
    onRenameConversation: (id: string, title: string) => void
    onSelectConversation: (id: string) => void
    onPatchConversation: (id: string, patch: Partial<AIConversation>) => void
    onBranchConversation: (conversation: AIConversation) => void
    setStatusNotice: (notice: string | null) => void
    archived?: boolean
}) {
    const [renamingConversation, setRenamingConversation] = useState<AIConversation | null>(null)
    const [deletingConversation, setDeletingConversation] = useState<AIConversation | null>(null)
    const [labelPrompt, setLabelPrompt] = useState<LabelPrompt>(null)
    const labels = useMemo(() => ({
        projects: distinctLabels(allConversations, 'sidebarProject'),
        sections: distinctLabels(allConversations, 'sidebarSection'),
    }), [allConversations])
    const groups = useMemo(() => groupConversations(conversations), [conversations])

    function setConversationLabel(conversation: AIConversation, kind: 'project' | 'section', value: string) {
        const key = kind === 'project' ? 'sidebarProject' : 'sidebarSection'
        onPatchConversation(conversation.id, {
            workspaceMeta: { ...conversation.workspaceMeta, [key]: value.trim() || null },
        })
    }

    if (!conversations.length) {
        return <div className='px-1 py-3 text-sm text-ui-muted'>No {archived ? 'archived' : 'active'} chats yet.</div>
    }

    return (
        <>
            <AppPromptDialog
                open={Boolean(renamingConversation)}
                title='Rename chat'
                label='Chat name'
                initialValue={renamingConversation ? conversationTitle(renamingConversation.title) : ''}
                onCancel={() => setRenamingConversation(null)}
                onConfirm={(title) => {
                    if (renamingConversation) onRenameConversation(renamingConversation.id, title)
                    setRenamingConversation(null)
                }}
            />
            <AppPromptDialog
                open={Boolean(labelPrompt)}
                title={labelPrompt?.kind === 'project' ? 'Move to project' : 'Move to section'}
                label={labelPrompt?.kind === 'project' ? 'Project name' : 'Section name'}
                initialValue={labelPrompt?.initialValue || ''}
                suggestions={labelPrompt?.kind === 'project' ? labels.projects : labels.sections}
                onCancel={() => setLabelPrompt(null)}
                onConfirm={(value) => {
                    if (labelPrompt) setConversationLabel(labelPrompt.conversation, labelPrompt.kind, value)
                    setLabelPrompt(null)
                }}
            />
            <AppConfirmDialog
                open={Boolean(deletingConversation)}
                title='Delete chat?'
                body='This permanently deletes the chat and its messages.'
                confirmLabel='Delete chat'
                tone='danger'
                onCancel={() => setDeletingConversation(null)}
                onConfirm={() => {
                    if (deletingConversation) onDeleteConversation(deletingConversation.id)
                    setDeletingConversation(null)
                }}
            />
            <div className='min-h-0 flex-1 space-y-1 overflow-y-auto pr-1'>
                {groups.map((group) => <div key={group.key} className='space-y-1'>
                    {group.label ? <div className='px-2 pt-3 text-[10px] font-semibold uppercase tracking-wide text-ui-muted'>{group.label}</div> : null}
                    {group.conversations.map((conversation) => <ChatConversationRow
                        key={conversation.id}
                        conversation={conversation}
                        repository={findRepository(conversation, repositories)}
                        active={conversation.id === activeConversationId}
                        archived={archived}
                        onArchive={onArchiveConversation}
                        onSelect={onSelectConversation}
                        onPatch={onPatchConversation}
                        onRename={setRenamingConversation}
                        onDelete={setDeletingConversation}
                        onBranch={onBranchConversation}
                        onLabel={(chat, kind) => setLabelPrompt({
                            kind,
                            conversation: chat,
                            initialValue: labelValue(chat, kind),
                        })}
                        setStatusNotice={setStatusNotice}
                    />)}
                </div>)}
            </div>
        </>
    )
}

function findRepository(conversation: AIConversation, repositories: AIImportedRepo[]) {
    const repositoryId = workspaceRepositoryId(conversation)
    return repositories.find((repository) => repository.id === repositoryId) || null
}

function labelValue(conversation: AIConversation, kind: 'project' | 'section') {
    const value = conversation.workspaceMeta?.[kind === 'project' ? 'sidebarProject' : 'sidebarSection']
    return typeof value === 'string' ? value : ''
}

function distinctLabels(conversations: AIConversation[], key: 'sidebarProject' | 'sidebarSection') {
    return Array.from(new Set(conversations
        .map((conversation) => conversation.workspaceMeta?.[key])
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))))
        .sort((a, b) => a.localeCompare(b))
}

export function groupConversations(conversations: AIConversation[]) {
    const pinned = conversations.filter((conversation) => Boolean(conversation.workspaceMeta?.sidebarPinnedAt))
    const unpinned = conversations.filter((conversation) => !conversation.workspaceMeta?.sidebarPinnedAt)
    const grouped = new Map<string, { key: string, label: string, conversations: AIConversation[] }>()
    for (const conversation of unpinned) {
        const project = labelValue(conversation, 'project')
        const section = labelValue(conversation, 'section')
        const label = section ? `${project ? `${project} / ` : ''}${section}` : project
        const key = label ? `group:${label}` : 'group:chats'
        const group = grouped.get(key) || { key, label, conversations: [] }
        group.conversations.push(conversation)
        grouped.set(key, group)
    }
    const result = [...grouped.values()].sort((a, b) => {
        if (!a.label) return -1
        if (!b.label) return 1
        return a.label.localeCompare(b.label)
    })
    if (pinned.length) result.unshift({ key: 'group:pinned', label: 'Pinned', conversations: pinned })
    return result
}
