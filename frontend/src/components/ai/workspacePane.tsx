'use client'

import { useState } from 'react'
import { listTreePaths } from '@/components/share/workspaceTree'
import { buildFallbackTrust } from './workbenchPaneTrust'
import { WorkspaceRecentActivityPanel } from './workspaceRecentActivityPanel'
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
    onScaffoldStarter: (template: 'nextjs_docker', projectName?: string | null) => unknown | Promise<unknown>
    onStartDeployment: (input: { vmName: string, port: string, healthPath: string, accessPolicy: AIDeploymentAccessPolicy, environment: AIDeploymentEnvironment }) => void | Promise<void>
    onInviteCollaborator: (input: { userId: string, role: 'reviewer' | 'editor' }) => void | Promise<void>
    onRollbackRelease: (releaseId: string) => void | Promise<void>
    onRemoveCollaborator: (userId: string) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
    onSelectShareFile: (path: string) => void | Promise<void>
}

export default function WorkspacePane(props: WorkspacePaneProps) {
    const [section, setSection] = useState<'repositories' | 'activity' | 'access' | 'launch'>('repositories')
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
    const trustRelease = releases.find((release) => release.status === 'current') || releases[0] || null
    const trust = trustRelease?.trust || buildFallbackTrust(trustRelease)
    const launchReport = trust?.launchReport || []
    return (
        <aside aria-label='Repository details' className='flex h-fit max-h-[calc(100dvh-5rem)] min-h-0 w-full max-w-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg bg-ui-raised p-3 outline outline-ui-border lg:h-full lg:max-h-none'>
            <div className='flex shrink-0 items-center justify-between gap-2 lg:hidden'>
                <h2 className='text-sm font-semibold text-ui-text'>Repositories</h2>
                <button type='button' onClick={onClose} aria-label='Close repository details' className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted hover:bg-ui-panel hover:text-ui-text'><span aria-hidden='true'>×</span></button>
            </div>
            <nav aria-label='Repository panel sections' role='tablist' className='grid shrink-0 grid-cols-4 gap-1 rounded-lg bg-ui-panel p-1 outline outline-ui-border'>
                {([
                    ['repositories', 'Repositories'],
                    ['activity', 'Activity'],
                    ['access', 'Access'],
                    ['launch', 'Launch'],
                ] as const).map(([value, label]) => <button key={value} id={`repository-tab-${value}`} type='button' role='tab' aria-selected={section === value} aria-controls='repository-panel-content' tabIndex={section === value ? 0 : -1} onClick={() => setSection(value)} onKeyDown={event => {
                    const values = ['repositories', 'activity', 'access', 'launch'] as const
                    const index = values.indexOf(value)
                    const next = event.key === 'ArrowRight' ? (index + 1) % values.length : event.key === 'ArrowLeft' ? (index - 1 + values.length) % values.length : event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : index
                    if (next !== index) { event.preventDefault(); setSection(values[next]) }
                }} className={`min-w-0 rounded-md px-1 py-2 text-[11px] font-medium transition-colors ${section === value ? 'bg-ui-raised text-ui-text' : 'text-ui-muted hover:text-ui-text'}`}>{label}</button>)}
            </nav>
            <div id='repository-panel-content' role='tabpanel' aria-labelledby={`repository-tab-${section}`} className='min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain pr-1'>
                {section === 'repositories' ? <WorkspaceRepositoryPanel importedRepos={importedRepos} initialShares={initialShares} activeConversation={activeConversation} activeRepoId={activeRepoId} syncingRepoId={syncingRepoId} selectedRepoFilePath={focusedFilePath} activeTreePaths={activeTreePaths} selectedContent={selectedContent} recentPaths={recentPaths} lastChangedPath={lastChangedPath} importInput={importInput} githubToken={githubToken} importError={importError} importPending={importPending} onAttachRepo={onAttachRepo} onAttachShare={onAttachShare} onImportInputChange={onImportInputChange} onGitHubTokenChange={onGitHubTokenChange} onImportRepo={onImportRepo} onCreateRepository={name => onScaffoldStarter('nextjs_docker', name)} onRevokeRepoCredential={onRevokeRepoCredential} onRefreshRepo={onRefreshRepo} onSelectRepoFile={onSelectRepoFile} onSelectShareFile={onSelectShareFile} /> : null}
                {section === 'activity' ? <WorkspaceRecentActivityPanel lastWorkspaceAction={lastWorkspaceAction} lastWorkspaceActionAt={lastWorkspaceActionAt} lastChangedPath={lastChangedPath} recentPaths={recentPaths} /> : null}
                {section === 'access' ? <WorkspaceCollaborationPanel activeConversation={activeConversation} currentUserId={currentUserId} collaboratorPending={collaboratorPending} collaborationError={collaborationError} onInviteCollaborator={onInviteCollaborator} onRemoveCollaborator={onRemoveCollaborator} /> : null}
                {section === 'launch' ? <>
                    <WorkspaceReleasePanels trustRelease={trustRelease} trust={trust} launchReport={launchReport} releases={releases} rollbackPendingId={rollbackPendingId} onRollbackRelease={onRollbackRelease} />
                    <WorkspaceDeployPanel availableVmTargets={availableVmTargets} activeRepo={activeRepo} activeConversation={activeConversation} deployQuota={deployQuota} deployPending={deployPending} deployments={deployments} onStartDeployment={onStartDeployment} />
                </> : null}
            </div>
        </aside>
    )
}
