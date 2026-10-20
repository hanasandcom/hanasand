'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ChatPane from '@/components/ai/chatPane'
import ChatSidebar from '@/components/ai/chatSidebar'
import WorkspacePane from '@/components/ai/workspacePane'
import useAiWorkbench from '@/components/ai/useAiWorkbench'
import type { AIWorkbenchInitialData } from '@/components/ai/workbench/initialData'
import { AIPageNotices } from './AIPageNotices'
import { usePromptPortal } from '@/components/ai/workbench/usePromptPortal'

type AIPageMode = 'landing' | 'workspace' | 'compact'

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
    const [provider, setProvider] = useState<'hanasand' | 'chatgpt'>('hanasand')
    const [mobileChatsOpen, setMobileChatsOpen] = useState(false)
    const portal = usePromptPortal(canUseChatGPT, ai.activeConversation)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const showWorkspaceRail = mode !== 'landing'
    const usingChatGPT = canUseChatGPT && provider === 'chatgpt'
    const visibleConversation = usingChatGPT ? portal.chatGPTConversation : ai.activeConversation

    async function sendPrompt() {
        if (!usingChatGPT) return ai.sendPrompt()
        if (await portal.submit(ai.composer.trim())) ai.setComposer('')
    }

    function changeProvider(value: 'hanasand' | 'chatgpt') {
        setProvider(value)
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
                <div className={`grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden ${showWorkspaceRail && detailsOpen ? 'xl:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,1fr)_22rem]' : 'xl:grid-cols-[16rem_minmax(0,1fr)]'}`}>
                    <div className='hidden min-h-0 md:block'>
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
                        onModelStrategyChange={ai.setModelStrategy}
                        onPreferredModelChange={ai.setPreferredModel}
                        onSend={sendPrompt}
                    />

                    {showWorkspaceRail && detailsOpen ? (
                        <div className='min-h-0 xl:col-span-2 2xl:col-span-1'>
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
                                ownershipSummary={ai.ownershipSummary}
                                availableVmTargets={ai.availableVmTargets}
                                deployPending={ai.deployPending}
                                collaboratorPending={ai.collaboratorPending}
                                currentUserId={ai.currentUserId}
                                rollbackPendingId={ai.rollbackPendingId}
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
                    ) : null}
                </div>

                {mobileChatsOpen ? <div className='absolute inset-0 z-40 md:hidden'>
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
                    runtimeState={ai.runtimeState}
                    onDismissResumeNotice={() => ai.setResumeNotice(null)}
                />}

            </div>
        </div>
    )
}
