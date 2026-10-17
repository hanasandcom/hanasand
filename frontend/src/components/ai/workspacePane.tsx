'use client'

import { listTreePaths } from '@/components/share/workspaceTree'
import { buildFallbackTrust } from './workbenchPaneTrust'
import { WorkspaceOverviewPanels, WorkspaceAccessSummary } from './workspaceOverviewPanels'
import { WorkspaceCollaborationPanel } from './workspaceCollaborationPanel'
import { WorkspaceReleasePanels } from './workspaceReleasePanels'
import { WorkspaceImportPanel } from './workspaceImportPanel'
import { WorkspaceStarterPanel } from './workspaceStarterPanel'
import { WorkspaceDeployPanel } from './workspaceDeployPanel'
import { WorkspaceRepositoryPanel } from './workspaceRepositoryPanel'
import { WorkspaceSharePanels } from './workspaceSharePanels'
import { readWorkspaceMetadata, workspaceRepositoryId } from './workbench/workspaceMetadata'

type WorkspacePaneProps = {
    activeConversation: AIConversation | null
    importedRepos: AIImportedRepo[]
    importInput: string
    githubToken: string
    importError: string | null
    importPending: boolean
    collaborationError: string | null
    initialShares: Share[]
    syncingRepoId: string | null
    activeShareTree: Tree | null
    selectedRepoFilePath: string | null
    selectedShareFileContent: string | null
    selectedShareContent: string | null
    deployments: AIDeployment[]
    releases: AIRelease[]
    deployQuota: AIDeployQuota | null
    ownershipSummary: AIOwnershipSummary | null
    availableVmTargets: AgentVmTarget[]
    deployPending: boolean
    collaboratorPending: boolean
    currentUserId: string | null
    rollbackPendingId: string | null
    onAttachRepo: (repoId: string) => void | Promise<void>
    onAttachShare: (shareId: string) => void | Promise<void>
    onImportInputChange: (value: string) => void
    onGitHubTokenChange: (value: string) => void
    onImportRepo: () => void | Promise<void>
    onRefreshRepo: (repoId: string) => void | Promise<void>
    onRevokeRepoCredential: (repoId: string) => void | Promise<void>
    onScaffoldStarter: (template: 'nextjs_docker', projectName?: string | null) => void | Promise<void>
    onStartDeployment: (input: { vmName: string, port: string, healthPath: string, accessPolicy: AIDeploymentAccessPolicy, environment: AIDeploymentEnvironment }) => void | Promise<void>
    onInviteCollaborator: (input: { userId: string, role: 'reviewer' | 'editor' }) => void | Promise<void>
    onRollbackRelease: (releaseId: string) => void | Promise<void>
    onRemoveCollaborator: (userId: string) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
    onSelectShareFile: (path: string) => void | Promise<void>
}

export default function WorkspacePane(props: WorkspacePaneProps) {
    const {
        activeConversation,
        importedRepos,
        importInput,
        githubToken,
        importError,
        importPending,
        collaborationError,
        initialShares,
        syncingRepoId,
        activeShareTree,
        selectedRepoFilePath,
        selectedShareFileContent,
        selectedShareContent,
        deployments,
        releases,
        deployQuota,
        ownershipSummary,
        availableVmTargets,
        deployPending,
        collaboratorPending,
        currentUserId,
        rollbackPendingId,
        onAttachRepo,
        onAttachShare,
        onImportInputChange,
        onGitHubTokenChange,
        onImportRepo,
        onRefreshRepo,
        onRevokeRepoCredential,
        onScaffoldStarter,
        onStartDeployment,
        onInviteCollaborator,
        onRollbackRelease,
        onRemoveCollaborator,
        onSelectRepoFile,
        onSelectShareFile,
    } = props
    const metadata = readWorkspaceMetadata(activeConversation)
    const activeRepoId = activeConversation ? workspaceRepositoryId(activeConversation) : null
    const activeRepo = activeRepoId ? importedRepos.find((repo) => repo.id === activeRepoId) || null : null
    const activeShare = initialShares.find((share) => share.id === activeConversation?.workspaceId) || null
    const activeTreePaths = listTreePaths(activeShareTree)
    const selectedPath = metadata.selectedFilePath
    const { recentPaths, lastWorkspaceAction, lastWorkspaceActionAt, lastChangedPath, workspaceSource } = metadata
    const selectedContent = selectedShareFileContent || selectedShareContent
    const launchOwners = Array.from(new Set(deployments.map((deployment) => deployment.startedBy || deployment.ownerId).filter(Boolean)))
    const reportOwners = Array.from(new Set(releases.map((release) => release.createdBy || release.ownerId).filter(Boolean)))
    const latestRelease = releases[0] || null
    const trustRelease = releases.find((release) => release.status === 'current') || latestRelease
    const trust = trustRelease?.trust || buildFallbackTrust(trustRelease)
    const launchReport = trust?.launchReport || []


    return (
        <aside className='flex h-full min-h-0 w-full max-w-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg bg-ui-raised p-3 outline outline-ui-border'>
            <WorkspaceOverviewPanels activeConversation={activeConversation} activeRepo={activeRepo} activeShare={activeShare} workspaceSource={workspaceSource} selectedPath={selectedPath} lastWorkspaceAction={lastWorkspaceAction} lastWorkspaceActionAt={lastWorkspaceActionAt} lastChangedPath={lastChangedPath} recentPaths={recentPaths} ownershipSummary={ownershipSummary} />
            <WorkspaceCollaborationPanel activeConversation={activeConversation} currentUserId={currentUserId} collaboratorPending={collaboratorPending} collaborationError={collaborationError} onInviteCollaborator={onInviteCollaborator} onRemoveCollaborator={onRemoveCollaborator} />
            <WorkspaceAccessSummary activeConversation={activeConversation} launchOwners={launchOwners} reportOwners={reportOwners} ownershipSummary={ownershipSummary} latestRelease={latestRelease} />
            <WorkspaceReleasePanels trustRelease={trustRelease} trust={trust} launchReport={launchReport} releases={releases} rollbackPendingId={rollbackPendingId} onRollbackRelease={onRollbackRelease} />
            <WorkspaceImportPanel importInput={importInput} githubToken={githubToken} importPending={importPending} importError={importError} onImportInputChange={onImportInputChange} onGitHubTokenChange={onGitHubTokenChange} onImportRepo={onImportRepo} />
            <WorkspaceStarterPanel onScaffoldStarter={onScaffoldStarter} />
            <WorkspaceDeployPanel availableVmTargets={availableVmTargets} activeRepo={activeRepo} activeConversation={activeConversation} deployQuota={deployQuota} deployPending={deployPending} deployments={deployments} onStartDeployment={onStartDeployment} />
            <WorkspaceRepositoryPanel importedRepos={importedRepos} activeRepoId={activeRepoId} syncingRepoId={syncingRepoId} selectedRepoFilePath={selectedRepoFilePath} recentPaths={recentPaths} lastChangedPath={lastChangedPath} onAttachRepo={onAttachRepo} onRevokeRepoCredential={onRevokeRepoCredential} onRefreshRepo={onRefreshRepo} onSelectRepoFile={onSelectRepoFile} />
            <WorkspaceSharePanels activeConversation={activeConversation} initialShares={initialShares} activeTreePaths={activeTreePaths} selectedPath={selectedPath} recentPaths={recentPaths} lastChangedPath={lastChangedPath} selectedContent={selectedContent} onAttachShare={onAttachShare} onSelectShareFile={onSelectShareFile} />




        </aside>
    )
}
