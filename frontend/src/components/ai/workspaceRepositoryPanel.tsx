import { useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import { Stat, WorkspacePrimaryAction, WorkspaceResourceCard, formatActivityTime } from './workbenchPaneDisplay'
import { WorkspaceFileButton } from './workspaceFileButton'

export function WorkspaceRepositoryPanel({ importedRepos, initialShares, activeConversation, activeRepoId, syncingRepoId, selectedRepoFilePath, activeTreePaths, selectedContent, recentPaths, lastChangedPath, importInput, githubToken, importError, importPending, onAttachRepo, onAttachShare, onImportInputChange, onGitHubTokenChange, onImportRepo, onCreateRepository, onRevokeRepoCredential, onRefreshRepo, onSelectRepoFile, onSelectShareFile }: {
    importedRepos: AIImportedRepo[]
    initialShares: Share[]
    activeConversation: AIConversation | null
    activeRepoId: string | null
    syncingRepoId: string | null
    selectedRepoFilePath: string | null
    activeTreePaths: string[]
    selectedContent: string | null
    recentPaths: string[]
    lastChangedPath: string | null
    importInput: string
    githubToken: string
    importError: string | null
    importPending: boolean
    onAttachRepo: (id: string) => void | Promise<void>
    onAttachShare: (id: string) => void | Promise<void>
    onImportInputChange: (value: string) => void
    onGitHubTokenChange: (value: string) => void
    onImportRepo: () => void | Promise<void>
    onCreateRepository: (name: string) => unknown | Promise<unknown>
    onRevokeRepoCredential: (id: string) => void | Promise<void>
    onRefreshRepo: (id: string) => void | Promise<void>
    onSelectRepoFile: (path: string) => void | Promise<void>
    onSelectShareFile: (path: string) => void | Promise<void>
}) {
    const [repositoryName, setRepositoryName] = useState('')
    const [action, setAction] = useState<'attach' | 'create'>('attach')
    const repoShareIds = new Set(importedRepos.map(repo => repo.id))
    const standaloneFiles = initialShares.filter(file => !repoShareIds.has(file.id))
    const availableCount = importedRepos.length + standaloneFiles.length

    return <section aria-label='Repository actions' className='min-w-0 space-y-3'>
        <div className='flex items-center justify-between gap-2'>
            <h3 className='text-sm font-medium text-ui-text'>Add a repository</h3>
            <span className='shrink-0 text-xs text-ui-muted'>{availableCount} available</span>
        </div>
        <div className='grid min-w-0 grid-cols-2 gap-2'>
            <button type='button' aria-pressed={action === 'attach'} onClick={() => setAction('attach')} className={`rounded-lg px-2 py-2 text-xs font-semibold outline transition-colors ${action === 'attach' ? 'bg-ui-primary/12 text-ui-primary outline-ui-primary/20' : 'bg-ui-raised text-ui-muted outline-ui-border hover:text-ui-text'}`}>Attach repository</button>
            <button type='button' aria-pressed={action === 'create'} onClick={() => setAction('create')} className={`rounded-lg px-2 py-2 text-xs font-semibold outline transition-colors ${action === 'create' ? 'bg-ui-primary/12 text-ui-primary outline-ui-primary/20' : 'bg-ui-raised text-ui-muted outline-ui-border hover:text-ui-text'}`}>Create repository</button>
        </div>

        {action === 'attach' ? <form className='grid min-w-0 content-start gap-2' onSubmit={event => { event.preventDefault(); void onImportRepo() }}>
            <label htmlFor='workspace-repository-url' className='text-xs font-medium text-ui-text'>Repository URL</label>
            <input id='workspace-repository-url' value={importInput} onChange={event => onImportInputChange(event.target.value)} placeholder='owner/repo or repository URL' className='min-w-0 w-full rounded-lg bg-ui-raised px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
            <WorkspacePrimaryAction type='submit' disabled={importPending} className='w-full min-w-0 text-xs'>{importPending ? 'Attaching…' : 'Attach repository'}</WorkspacePrimaryAction>
            <details className='rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
                <summary className='cursor-pointer font-medium text-ui-text'>Private repository access (optional)</summary>
                <input aria-label='GitHub token for a private repository (optional)' value={githubToken} onChange={event => onGitHubTokenChange(event.target.value)} placeholder='GitHub token' type='password' autoComplete='off' spellCheck={false} className='mt-2 min-w-0 w-full rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                <p className='mt-2'>The token is sent with this request and cleared after it succeeds.</p>
            </details>
            {importError ? <div><ErrorNotice compact message={importError} /></div> : null}
        </form> : <form className='grid min-w-0 content-start gap-2' onSubmit={event => { event.preventDefault(); if (repositoryName.trim()) void onCreateRepository(repositoryName.trim()) }}>
            <label htmlFor='workspace-repository-name' className='text-xs font-medium text-ui-text'>Repository name</label>
            <input id='workspace-repository-name' value={repositoryName} onChange={event => setRepositoryName(event.target.value)} placeholder='Repository name' className='min-w-0 w-full rounded-lg bg-ui-raised px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
            <WorkspacePrimaryAction type='submit' disabled={!repositoryName.trim()} hover className='w-full min-w-0 text-xs'>Create repository</WorkspacePrimaryAction>
        </form>}

        {availableCount ? <div className='min-w-0 space-y-2 border-t border-ui-border/70 pt-3'>
            <>
                {importedRepos.map(repo => <WorkspaceResourceCard key={repo.id} selected={repo.id === activeRepoId}>
                    <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='min-w-0 flex-1'>
                            <div className='break-all text-sm font-medium text-ui-text'>{repo.fullName}</div>
                            <div className='mt-1 break-all text-xs text-ui-muted'>{repo.branch} · {repo.syncStatus === 'ready' ? 'Ready' : repo.syncStatus === 'syncing' ? 'Syncing…' : repo.lastSyncError || 'Sync failed'}</div>
                            <div className='mt-1 break-all text-[11px] text-ui-muted'>{repo.accessScope === 'owned' ? `Owned by ${repo.ownerId}` : `Access from ${repo.ownerId}`}</div>
                            <div className='mt-1 text-[11px] text-ui-muted'>{repo.stackType === 'unknown' ? (repo.stackReason || 'Unsupported stack') : repo.stackType.replaceAll('_', ' ')}</div>
                            {repo.credential?.hasCredential ? <div className='mt-1 break-all text-[11px] text-ui-success'>Saved GitHub token {repo.credential.tokenHint || ''}{repo.credential.lastUsedAt ? ` · used ${formatActivityTime(repo.credential.lastUsedAt)}` : ''}</div> : repo.authHint ? <div className='mt-1 break-all text-[11px] text-ui-warning'>{repo.authHint}</div> : null}
                        </div>
                        <div className='flex shrink-0 flex-wrap items-center gap-2'>
                            <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-ui-raised px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border hover:text-ui-primary'>Attach</button>
                            {repo.credential?.hasCredential ? <button type='button' onClick={() => void onRevokeRepoCredential(repo.id)} className='rounded-lg bg-ui-raised px-2.5 py-1.5 text-xs text-ui-muted outline outline-ui-border hover:text-ui-text'>Revoke</button> : null}
                            <button type='button' aria-label={`Refresh ${repo.fullName}`} onClick={() => void onRefreshRepo(repo.id)} className='grid h-8 w-8 place-items-center rounded-lg bg-ui-raised text-ui-muted outline outline-ui-border hover:text-ui-primary'><RefreshCcw className={`h-3.5 w-3.5 ${syncingRepoId === repo.id ? 'animate-spin' : ''}`} /></button>
                        </div>
                    </div>
                    {repo.id === activeRepoId && selectedRepoFilePath ? <Stat label='Focus' value={selectedRepoFilePath} /> : null}
                    {repo.id === activeRepoId && repo.files.length ? <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>{repo.files.slice(0, 80).map(file => <WorkspaceFileButton key={file.path} path={file.path} selected={selectedRepoFilePath === file.path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} onSelect={onSelectRepoFile} />)}</div> : null}
                </WorkspaceResourceCard>)}
                {standaloneFiles.length ? <div className='col-span-full min-w-0 space-y-2 border-t border-ui-border/70 pt-3' aria-label='Repository files'>
                    <h3 className='text-xs font-medium text-ui-text'>Files</h3>
                    {standaloneFiles.map(file => <WorkspaceResourceCard key={file.id} selected={file.id === activeConversation?.workspaceId}>
                        <div className='flex min-w-0 items-start justify-between gap-3'>
                            <div className='min-w-0 flex-1'><div className='break-all text-sm text-ui-text'>{file.alias || file.id}</div><div className='mt-1 break-all text-xs text-ui-muted'>{file.path || file.id}</div></div>
                            <button type='button' onClick={() => void onAttachShare(file.id)} className='shrink-0 rounded-lg bg-ui-raised px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border hover:text-ui-primary'>Attach file</button>
                        </div>
                        {file.id === activeConversation?.workspaceId && activeTreePaths.length ? <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>{activeTreePaths.slice(0, 120).map(path => <WorkspaceFileButton key={path} path={path} selected={selectedRepoFilePath === path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} onSelect={onSelectShareFile} />)}</div> : null}
                    </WorkspaceResourceCard>)}
                </div> : null}
            </>
        </div> : null}

        {selectedContent ? <div className='min-w-0 border-t border-ui-border/70 pt-3'><div className='mb-2 text-xs font-medium text-ui-text'>{selectedRepoFilePath || 'Selected file'}</div><pre className='max-h-72 max-w-full overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-ui-raised p-3 text-xs leading-5 text-ui-text'>{selectedContent.slice(0, 12000)}</pre></div> : null}
    </section>
}
