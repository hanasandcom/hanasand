'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'
import type { AIWorkbenchInitialData } from '@/components/ai/workbench/initialData'
import { AIPageNotices } from './AIPageNotices'
import { usePromptPortal } from '@/components/ai/workbench/usePromptPortal'
import { mergeConversationMessages, parseConversationProviderPreferences, setConversationProvider, type AssistantProvider } from '@/components/ai/workbench/providerSelection'

type AIPageMode = 'landing' | 'workspace' | 'compact'
const PROVIDER_STORAGE_KEY = 'hanasand.ai.provider-by-conversation.v1'

export default function AIPageClient({
    mode = 'landing',
    canUseChatGPT = false,
    ...initialData
}: AIWorkbenchInitialData & {
    mode?: AIPageMode
    canUseChatGPT?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const ai = useAiWorkbench(initialData)
    const [providersByConversation, setProvidersByConversation] = useState<Record<string, AssistantProvider>>({})
    const [mobileChatsOpen, setMobileChatsOpen] = useState(false)
    const portal = usePromptPortal(canUseChatGPT, ai.activeConversation)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const showWorkspaceRail = mode !== 'landing'
    const activeConversationId = ai.activeConversation?.id || ''
    const provider = activeConversationId ? providersByConversation[activeConversationId] || 'hanasand' : 'hanasand'
    const usingChatGPT = canUseChatGPT && provider === 'chatgpt'
    const visibleConversation = useMemo(() => {
        if (!ai.activeConversation || !portal.chatGPTConversation) return ai.activeConversation
        return {
            ...ai.activeConversation,
            messages: mergeConversationMessages(ai.activeConversation.messages, portal.chatGPTConversation.messages),
        }
    }, [ai.activeConversation, portal.chatGPTConversation])

    useEffect(() => {
        try {
            setProvidersByConversation(parseConversationProviderPreferences(window.localStorage.getItem(PROVIDER_STORAGE_KEY)))
        } catch { /* Keep the default provider when saved preferences are unavailable. */ }
    }, [])

    async function sendPrompt() {
        if (!usingChatGPT) return ai.sendPrompt(visibleConversation?.messages)
        if (await portal.submit(ai.composer.trim())) ai.setComposer('')
    }

    function changeProvider(value: 'hanasand' | 'chatgpt') {
        if (!activeConversationId) return
        const updated = setConversationProvider(providersByConversation, activeConversationId, value)
        setProvidersByConversation(updated)
        try { window.localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(updated)) } catch { /* Keep the current-session choice. */ }
        if (value === 'hanasand') portal.setFiles(null)
    }

    function mutatePrompt(action: 'edit' | 'delete' | 'reorder', id: string, extra: Record<string, unknown> = {}) {
        const item = portal.items.find(candidate => candidate.id === id)
        if (item) void portal.mutate(action, item, extra)
    }

    function selectConversation(id: string) {
        ai.selectConversation(id)
        if (mode === 'workspace' && pathname !== `/ai/${id}`) {
            router.push(`/ai/${id}`)
        }
    }

    return (
        <div className='h-full enterprise-console relative w-full overflow-hidden bg-ui-canvas text-ui-text'>
            <div className='flex h-full min-h-0 flex-col'>
                <div className={`grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden ${showWorkspaceRail ? (detailsOpen ? 'lg:grid-cols-[14rem_minmax(0,1fr)_22rem]' : 'lg:grid-cols-[14rem_minmax(0,1fr)]') : ''}`}>
                    <div className='hidden min-h-0 lg:block'>
                        <ChatSidebar
                            activeConversationId={ai.activeConversationId}
                            archivedConversations={ai.archivedConversations}
                            conversations={ai.filteredConversations}
                            search={ai.search}
                            setSearch={ai.setSearch}
                            onArchiveConversation={ai.archiveConversation}
                            onDeleteConversation={ai.deleteConversation}
                            onNewConversation={() => { void ai.createNewConversation(); setMobileChatsOpen(false) }}
                            onRenameConversation={ai.renameConversation}
                            onSelectConversation={id => { selectConversation(id); setMobileChatsOpen(false) }}
                        />
                    </div>

                    <ChatPane
                        activeConversation={visibleConversation}
                        clients={ai.clients}
                        composer={ai.composer}
                        isConnected={ai.isConnected}
                        isAuthenticated={initialData.isAuthenticated}
                        participants={ai.participants}
                        readOnly={ai.activeConversation?.collaboration?.role === 'reviewer'}
                        provider={provider}
                        canUseChatGPT={canUseChatGPT}
                        promptPriority={portal.priority}
                        promptFiles={portal.files}
                        promptBusy={portal.busy}
                        promptError={usingChatGPT ? portal.error : ''}
                        showWorkspaceDetails={showWorkspaceRail}
                        workspaceDetailsOpen={detailsOpen}
                        onToggleWorkspaceDetails={() => setDetailsOpen(previous => !previous)}
                        onToggleMobileChats={() => setMobileChatsOpen(previous => !previous)}
                        onProviderChange={changeProvider}
                        onPromptPriorityChange={portal.setPriority}
                        onPromptFilesChange={portal.setFiles}
                        onRefreshPrompts={portal.refresh}
                        onEditPrompt={id => { const item = portal.items.find(candidate => candidate.id === id); if (item) portal.edit(item) }}
                        onDeletePrompt={id => mutatePrompt('delete', id)}
                        onMovePrompt={(id, direction) => mutatePrompt('reorder', id, { direction })}
                        onComposerChange={ai.setComposer}
                        onSend={sendPrompt}
                    />

                    {showWorkspaceRail && detailsOpen ? (
                        <>
                            <button type='button' aria-label='Close repository details' onClick={() => setDetailsOpen(false)} className='absolute inset-0 z-30 bg-ui-scrim/60 lg:hidden' />
                            <div className='absolute inset-y-0 right-0 z-40 h-full w-[min(22rem,100%)] min-w-0 overflow-hidden p-2 shadow-2xl lg:relative lg:inset-auto lg:z-auto lg:col-span-1 lg:w-full lg:p-0 lg:shadow-none'>
                                <WorkspacePane
                                    activeConversation={ai.activeConversation}
                                    importedRepos={ai.importedRepos}
                                    importInput={ai.importInput}
                                    githubToken={ai.githubToken}
                                    importError={ai.importError}
                                    importPending={ai.importPending}
                                    collaborationError={ai.collaborationError}
                                    initialShares={ai.initialShares}
                                    syncingRepoId={ai.syncingRepoId}
                                    activeShareTree={ai.activeShareTree}
                                    selectedRepoFilePath={ai.selectedRepoFilePath}
                                    selectedShareFileContent={ai.selectedShareFileContent}
                                    selectedShareContent={ai.selectedShareContent}
                                    deployments={ai.deployments}
                                    releases={ai.releases}
                                    deployQuota={ai.deployQuota}
                                    availableVmTargets={ai.availableVmTargets}
                                    deployPending={ai.deployPending}
                                    collaboratorPending={ai.collaboratorPending}
                                    currentUserId={ai.currentUserId}
                                    rollbackPendingId={ai.rollbackPendingId}
                                    onClose={() => setDetailsOpen(false)}
                                    onAttachRepo={ai.attachRepo}
                                    onAttachShare={ai.attachShare}
                                    onImportInputChange={ai.setImportInput}
                                    onGitHubTokenChange={ai.setGitHubToken}
                                    onImportRepo={ai.importRepo}
                                    onRefreshRepo={ai.refreshRepo}
                                    onRevokeRepoCredential={ai.revokeRepoCredential}
                                    onScaffoldStarter={ai.scaffoldStarter}
                                    onStartDeployment={ai.startDeployment}
                                    onInviteCollaborator={(input) => ai.inviteCollaborator(input.userId, input.role)}
                                    onRollbackRelease={ai.rollbackRelease}
                                    onRemoveCollaborator={ai.removeCollaborator}
                                    onSelectRepoFile={ai.selectRepoFile}
                                    onSelectShareFile={ai.selectShareFile}
                                />
                            </div>
                        </>
                    ) : null}
                </div>

                {mobileChatsOpen ? <div className='absolute inset-0 z-40 lg:hidden'>
                    <button type='button' aria-label='Close chats' onClick={() => setMobileChatsOpen(false)} className='absolute inset-0 bg-ui-scrim/60' />
                    <div className='absolute inset-y-0 left-0 w-[min(19rem,85vw)] shadow-2xl'>
                        <ChatSidebar
                            activeConversationId={ai.activeConversationId}
                            archivedConversations={ai.archivedConversations}
                            conversations={ai.filteredConversations}
                            search={ai.search}
                            setSearch={ai.setSearch}
                            onArchiveConversation={ai.archiveConversation}
                            onDeleteConversation={ai.deleteConversation}
                            onNewConversation={() => { void ai.createNewConversation(); setMobileChatsOpen(false) }}
                            onRenameConversation={ai.renameConversation}
                            onSelectConversation={id => { selectConversation(id); setMobileChatsOpen(false) }}
                        />
                    </div>
                </div> : null}

                {usingChatGPT ? null : <AIPageNotices
                    statusNotice={ai.statusNotice}
                    resumeNotice={ai.resumeNotice}
                    onDismissResumeNotice={() => ai.setResumeNotice(null)}
                />}

            </div>
        </div>
    )
}
