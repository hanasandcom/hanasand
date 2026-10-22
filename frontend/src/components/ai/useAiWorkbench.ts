'use client'

import { useCallback } from 'react'
import type { AIWorkbenchInitialData } from './workbench/initialData'
import { useConversationView } from './workbench/useConversationView'
import { useWorkbenchState } from './workbench/useWorkbenchState'
import { runTerminalCommandOnShare as executeTerminalCommand } from './workbench/runTerminalCommand'
import { useRepositoryManagement } from './workbench/useRepositoryManagement'
import { useWorkspaceAttachmentActions } from './workbench/useWorkspaceAttachmentActions'
import { useWorkspaceScaffolding } from './workbench/useWorkspaceScaffolding'
import { useDeploymentActions } from './workbench/useDeploymentActions'
import { useCollaborationActions } from './workbench/useCollaborationActions'
import { useReleaseActions } from './workbench/useReleaseActions'
import { usePromptActions } from './workbench/usePromptActions'
import { useAssistantMessagePersistence } from './workbench/useAssistantMessagePersistence'
import { useAssistantToolExecution } from './workbench/useAssistantToolExecution'
import { useAssistantToolRunner } from './workbench/useAssistantToolRunner'
import { useSocketMessageHandler } from './workbench/useSocketMessageHandler'
import { useWorkbenchConnection } from './workbench/useWorkbenchConnection'
import { useWorkbenchApiAccess } from './workbench/useWorkbenchApiAccess'
import { useWorkbenchPolling } from './workbench/useWorkbenchPolling'
import { useConversationStartup } from './workbench/useConversationStartup'
import { useWorkspaceHydration } from './workbench/useWorkspaceHydration'

export default function useAiWorkbench(initialData: AIWorkbenchInitialData) {
    const state = useWorkbenchState(initialData)


    const markUnauthorized = useWorkbenchApiAccess(state)
    const { createNewConversation } = useConversationStartup(state)
    useWorkbenchPolling(state, markUnauthorized)
    useWorkbenchConnection(state)

    const {
        updateLocalConversation, replaceConversation, patchConversation, renameConversation,
        archiveConversation, deleteConversation, persistMessage, filteredConversations,
        archivedConversations, resolvedActiveConversationId, activeConversation,
        selectedRepoFilePath, activeShareTree, selectedShareFileContent,
        selectedShareContent, runtimeState,
    } = useConversationView(state, createNewConversation)
    useWorkspaceHydration(state, activeConversation)
    const runTerminalCommandOnShare = useCallback(
        (shareId: string, command: string, timeoutMs?: number) => executeTerminalCommand(state.shares, shareId, command, timeoutMs),
        [state.shares]
    )

    const { attachShare, attachRepo, selectRepoFile, selectShareFile } = useWorkspaceAttachmentActions(state, activeConversation, patchConversation)
    const { importRepo, refreshRepo, revokeRepoCredential } = useRepositoryManagement(state, activeConversation, attachRepo)

    const scaffoldStarter = useWorkspaceScaffolding(state, activeConversation, attachShare, selectShareFile, patchConversation)

    const { startDeployment, activeDeployments, activeReleases } = useDeploymentActions(state, activeConversation)

    const { inviteCollaborator, removeCollaborator } = useCollaborationActions(
        state, activeConversation, resolvedActiveConversationId, replaceConversation, updateLocalConversation
    )

    const rollbackRelease = useReleaseActions(state)

    const { setPreferredModel, setModelStrategy, sendPrompt } = usePromptActions(state, activeConversation, patchConversation, persistMessage)

    const persistAssistantMessageFromEvent = useAssistantMessagePersistence(state, persistMessage)

    useSocketMessageHandler(state, persistAssistantMessageFromEvent)

    useAssistantToolExecution(state, persistMessage)
    useAssistantToolRunner(state, scaffoldStarter, runTerminalCommandOnShare)

    return {
        activeConversation,
        activeConversationId: resolvedActiveConversationId,
        activeDeployments,
        archivedConversations,
        archiveConversation,
        attachRepo,
        attachShare,
        clients: state.clients,
        composer: state.composer,
        collaborationError: state.collaborationError,
        collaboratorPending: state.collaboratorPending,
        createNewConversation,
        deleteConversation,
        deployments: activeDeployments,
        deployQuota: state.deployQuota,
        ownershipSummary: state.ownershipSummary,
        deployPending: state.deployPending,
        releases: activeReleases,
        rollbackPendingId: state.rollbackPendingId,
        filteredConversations,
        importError: state.importError,
        importInput: state.importInput,
        githubToken: state.githubToken,
        importPending: state.importPending,
        importedRepos: state.importedRepos,
        initialShares: state.shares,
        isConnected: state.isConnected,
        currentUserId: state.currentUserId,
        participants: state.participants,
        allDeployments: state.deployments,
        availableVmTargets: state.availableVmTargets,
        refreshRepo,
        revokeRepoCredential,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareContent,
        selectedShareFileContent,
        scaffoldStarter,
        startDeployment,
        selectConversation: state.setActiveConversationId,
        selectRepoFile,
        selectShareFile,
        sendPrompt,
        setComposer: state.setComposer,
        setImportInput: state.setImportInput,
        setGitHubToken: state.setGitHubToken,
        setModelStrategy,
        setPreferredModel,
        setSearch: state.setSearch,
        syncingRepoId: state.syncingRepoId,
        importRepo,
        isAuthenticated: state.isAuthenticated,
        renameConversation,
        inviteCollaborator,
        rollbackRelease,
        removeCollaborator,
        resumeNotice: state.resumeNotice,
        search: state.search,
        statusNotice: state.statusNotice,
        runtimeState,
        setResumeNotice: state.setResumeNotice,
    }
}
