import { Panel, Stat, Empty, PreviewLink, TrustItem, formatActivityTime, formatUsageKind, PathBadge, ChecklistItem } from './workbenchPaneDisplay'
import { FolderGit2, RefreshCcw } from 'lucide-react'

export function WorkspaceRepositoryPanel({ importedRepos, activeRepoId, syncingRepoId, selectedRepoFilePath, recentPaths, lastChangedPath, onAttachRepo, onRevokeRepoCredential, onRefreshRepo, onSelectRepoFile }: { importedRepos: AIImportedRepo[], activeRepoId: string | null, syncingRepoId: string | null, selectedRepoFilePath: string | null, recentPaths: string[], lastChangedPath: string | null, onAttachRepo: (id: string) => void | Promise<void>, onRevokeRepoCredential: (id: string) => void | Promise<void>, onRefreshRepo: (id: string) => void | Promise<void>, onSelectRepoFile: (path: string) => void | Promise<void> }) {
    return (<>
            <Panel
                icon={<FolderGit2 className='h-4 w-4' />}
                title='Repositories'
                subtitle={`${importedRepos.length} imported`}
                grow
            >
                {importedRepos.length ? importedRepos.map((repo) => (
                    <div key={repo.id} className={`rounded-lg px-3 py-3 outline ${repo.id === activeRepoId ? 'bg-ui-primary/10 outline-ui-primary/18' : 'bg-ui-panel outline-ui-border'}`}>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <div className='truncate text-sm font-medium text-ui-text'>{repo.fullName}</div>
                                <div className='mt-1 text-xs text-ui-muted'>
                                    {repo.branch} · {repo.syncStatus === 'ready' ? 'Ready' : repo.syncStatus === 'syncing' ? 'Syncing…' : repo.lastSyncError || 'Sync failed'}
                                </div>
                                <div className='mt-1 text-[11px] text-ui-muted'>
                                    {repo.accessScope === 'owned' ? `Owned by ${repo.ownerId}` : `Shared from ${repo.ownerId}`}
                                </div>
                                <div className='mt-1 text-[11px] text-ui-muted'>
                                    {repo.stackType === 'unknown' ? (repo.stackReason || 'Unsupported stack') : repo.stackType.replaceAll('_', ' ')}
                                </div>
                                {repo.credential?.hasCredential ? (
                                    <div className='mt-1 text-[11px] text-ui-success'>
                                        Saved GitHub token {repo.credential.tokenHint || ''}{repo.credential.lastUsedAt ? ` · used ${formatActivityTime(repo.credential.lastUsedAt)}` : ''}
                                    </div>
                                ) : repo.authHint ? (
                                    <div className='mt-1 text-[11px] text-ui-warning'>{repo.authHint}</div>
                                ) : null}
                            </div>
                            <div className='flex items-center gap-2'>
                                <button type='button' onClick={() => void onAttachRepo(repo.id)} className='rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border hover:text-ui-primary'>
                                    Attach
                                </button>
                                {repo.credential?.hasCredential ? (
                                    <button type='button' onClick={() => void onRevokeRepoCredential(repo.id)} className='rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-muted outline outline-ui-border hover:text-ui-text'>
                                        Revoke
                                    </button>
                                ) : null}
                                <button type='button' onClick={() => void onRefreshRepo(repo.id)} className='grid h-8 w-8 place-items-center rounded-lg bg-ui-panel text-ui-muted outline outline-ui-border hover:text-ui-primary'>
                                    <RefreshCcw className={`h-3.5 w-3.5 ${syncingRepoId === repo.id ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                        {repo.id === activeRepoId && repo.files.length ? (
                            <div className='mt-3 max-h-36 space-y-1 overflow-y-auto pr-1'>
                                {repo.files.slice(0, 80).map((file) => (
                                    <button key={file.path} type='button' onClick={() => void onSelectRepoFile(file.path)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedRepoFilePath === file.path ? 'bg-ui-primary/12 text-ui-on-primary outline-ui-primary/18' : 'bg-ui-raised text-ui-muted outline-transparent hover:outline-ui-border'}`}>
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='truncate'>{file.path}</span>
                                            <PathBadge path={file.path} selected={selectedRepoFilePath === file.path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )) : <Empty text='No repositories imported yet.' />}
            </Panel>


    </>)
}
