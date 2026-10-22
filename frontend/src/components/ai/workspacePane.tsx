'use client'

import { listTreePaths } from '@/components/share/workspaceTree'
import { buildFallbackTrust } from './workbenchPaneTrust'
import { WorkspaceOverviewPanels, WorkspaceAccessSummary } from './workspaceOverviewPanels'
import { WorkspaceCollaborationPanel } from './workspaceCollaborationPanel'
import { WorkspaceReleasePanels } from './workspaceReleasePanels'
import { WorkspaceDeployPanel } from './workspaceDeployPanel'
import { WorkspaceRepositoryPanel } from './workspaceRepositoryPanel'
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
    onClose: () => void
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
        onClose,
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
    const focusedFilePath = selectedRepoFilePath || metadata.selectedFilePath
    const activeTreePaths = listTreePaths(activeShareTree)
    const { recentPaths, lastWorkspaceAction, lastWorkspaceActionAt, lastChangedPath } = metadata
    const selectedContent = selectedShareFileContent || selectedShareContent
    const launchOwners = Array.from(new Set(deployments.map((deployment) => deployment.startedBy || deployment.ownerId).filter(Boolean)))
    const reportOwners = Array.from(new Set(releases.map((release) => release.createdBy || release.ownerId).filter(Boolean)))
    const latestRelease = releases[0] || null
    const trustRelease = releases.find((release) => release.status === 'current') || latestRelease
    const trust = trustRelease?.trust || buildFallbackTrust(trustRelease)
    const launchReport = trust?.launchReport || []
    return (
        <aside aria-label='Repository details' className='flex h-full min-h-0 w-full max-w-full min-w-0 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg bg-ui-raised p-3 outline outline-ui-border'>
            <div className='flex items-center justify-between gap-2 xl:hidden'>
                <h2 className='text-sm font-semibold text-ui-text'>Repositories</h2>
                <button type='button' onClick={onClose} aria-label='Close repository details' className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted hover:bg-ui-panel hover:text-ui-text'><span aria-hidden='true'>×</span></button>
            </div>
            <WorkspaceRepositoryPanel importedRepos={importedRepos} initialShares={initialShares} activeConversation={activeConversation} activeRepoId={activeRepoId} syncingRepoId={syncingRepoId} selectedRepoFilePath={focusedFilePath} activeTreePaths={activeTreePaths} selectedContent={selectedContent} recentPaths={recentPaths} lastChangedPath={lastChangedPath} importInput={importInput} githubToken={githubToken} importError={importError} importPending={importPending} onAttachRepo={onAttachRepo} onAttachShare={onAttachShare} onImportInputChange={onImportInputChange} onGitHubTokenChange={onGitHubTokenChange} onImportRepo={onImportRepo} onCreateRepository={name => onScaffoldStarter('nextjs_docker', name)} onRevokeRepoCredential={onRevokeRepoCredential} onRefreshRepo={onRefreshRepo} onSelectRepoFile={onSelectRepoFile} onSelectShareFile={onSelectShareFile} />
            <WorkspaceOverviewPanels lastWorkspaceAction={lastWorkspaceAction} lastWorkspaceActionAt={lastWorkspaceActionAt} lastChangedPath={lastChangedPath} recentPaths={recentPaths} ownershipSummary={ownershipSummary} />
            <WorkspaceCollaborationPanel activeConversation={activeConversation} currentUserId={currentUserId} collaboratorPending={collaboratorPending} collaborationError={collaborationError} onInviteCollaborator={onInviteCollaborator} onRemoveCollaborator={onRemoveCollaborator} />
            <WorkspaceAccessSummary activeConversation={activeConversation} launchOwners={launchOwners} reportOwners={reportOwners} ownershipSummary={ownershipSummary} latestRelease={latestRelease} />
            <WorkspaceReleasePanels trustRelease={trustRelease} trust={trust} launchReport={launchReport} releases={releases} rollbackPendingId={rollbackPendingId} onRollbackRelease={onRollbackRelease} />
            <WorkspaceDeployPanel availableVmTargets={availableVmTargets} activeRepo={activeRepo} activeConversation={activeConversation} deployQuota={deployQuota} deployPending={deployPending} deployments={deployments} onStartDeployment={onStartDeployment} />




        </aside>
    )
}
