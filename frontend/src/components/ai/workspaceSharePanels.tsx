import { Panel, Stat, Empty, PreviewLink, TrustItem, formatActivityTime, formatUsageKind, PathBadge, ChecklistItem } from './workbenchPaneDisplay'
import { FolderGit2, Share2, TerminalSquare } from 'lucide-react'

export function WorkspaceSharePanels({ activeConversation, initialShares, activeTreePaths, selectedPath, recentPaths, lastChangedPath, selectedContent, onAttachShare, onSelectShareFile }: { activeConversation: AIConversation | null, initialShares: Share[], activeTreePaths: string[], selectedPath: string | null, recentPaths: string[], lastChangedPath: string | null, selectedContent: string | null, onAttachShare: (id: string) => void | Promise<void>, onSelectShareFile: (path: string) => void | Promise<void> }) {
    return (<>
            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Shares'
                subtitle='Attach an existing Hanasand workspace.'
            >
                <div className='max-h-40 space-y-2 overflow-y-auto pr-1'>
                    {initialShares.length ? initialShares.slice(0, 40).map((share) => (
                        <div key={share.id} className={`rounded-lg px-3 py-3 outline ${share.id === activeConversation?.workspaceId ? 'bg-ui-primary/10 outline-ui-primary/18' : 'bg-ui-panel outline-ui-border'}`}>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm text-ui-text'>{share.alias || share.id}</div>
                                    <div className='mt-1 truncate text-xs text-ui-muted'>{share.path || share.id}</div>
                                </div>
                                <button type='button' onClick={() => void onAttachShare(share.id)} className='rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border hover:text-ui-primary'>
                                    Attach
                                </button>
                            </div>
                        </div>
                    )) : <Empty text='No shares available.' />}
                </div>
            </Panel>

            {activeConversation?.workspaceKind === 'share' && activeTreePaths.length ? (
                <Panel
                    icon={<FolderGit2 className='h-4 w-4' />}
                    title='Project files'
                    subtitle='Split-view file selector'
                >
                    <div className='max-h-40 space-y-1 overflow-y-auto pr-1'>
                        {activeTreePaths.slice(0, 120).map((path) => (
                            <button
                                key={path}
                                type='button'
                                onClick={() => void onSelectShareFile(path)}
                                className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selectedPath === path ? 'bg-ui-primary/12 text-ui-on-primary outline-ui-primary/18' : 'bg-ui-raised text-ui-muted outline-transparent hover:outline-ui-border'}`}
                            >
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='truncate'>{path}</span>
                                    <PathBadge path={path} selected={selectedPath === path} recentPaths={recentPaths} lastChangedPath={lastChangedPath} />
                                </div>
                            </button>
                        ))}
                    </div>
                </Panel>
            ) : null}

            {selectedContent ? (
                <Panel
                    icon={<TerminalSquare className='h-4 w-4' />}
                    title='Preview'
                    subtitle={selectedPath || 'Selected content'}
                    grow
                >
                    <pre className='max-h-72 overflow-auto rounded-lg bg-ui-raised p-3 text-xs leading-5 text-ui-text'>{selectedContent.slice(0, 12000)}</pre>
                </Panel>
            ) : null}

    </>)
}
