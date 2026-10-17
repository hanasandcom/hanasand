import { OpenFoldersProvider } from '@/hooks/useFolderState'
import ErrorNotice from '@/components/error/errorNotice'
import { getWorkspaceRoot } from '../workspaceTree'
import TreeHeader from './treeHeader'
import Tree from './tree'
import NewFile from './newFile'
import type { Dispatch, SetStateAction } from 'react'

type ExplorerFilePanelProps = {
    openFolders: string[]
    tree: Tree | null
    treeLoading: boolean
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    onRecoverTree: (shareId: string) => Promise<Tree | null>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    selectedFolder: string
    setSelectedFolder: Dispatch<SetStateAction<string>>
    setTree: Dispatch<SetStateAction<Tree | null>>
    filter: string
    setFilter: Dispatch<SetStateAction<string>>
}

export function ExplorerFilePanel({
    openFolders,
    tree,
    treeLoading,
    share,
    setShare,
    onRecoverTree,
    isCreatingNewFile,
    setIsCreatingNewFile,
    newFileName,
    setNewFileName,
    selectedFolder,
    setSelectedFolder,
    setTree,
    filter,
    setFilter,
}: ExplorerFilePanelProps) {
    const rootFolder = getWorkspaceRoot(tree, share)
    const visibleTree = rootFolder ? rootFolder.children : tree
    const filteredTree = filter.trim() && visibleTree ? filterTree(visibleTree, filter) : visibleTree

    return (
        <div className='relative z-10 h-full w-[min(18rem,calc(100vw-5rem))] overflow-auto rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md md:w-[15vw] md:min-w-60 md:bg-ui-panel/90'>
            {(!tree || !share) && <div className='w-full'>
                {treeLoading || !share ? <TreeSkeleton /> : null}
                {share && !treeLoading ? (
                    <ErrorNotice
                        compact
                        message='Unable to load file tree.'
                        title='File tree unavailable'
                        actionLabel='Retry'
                        onAction={() => void onRecoverTree(share.id)}
                    />
                ) : null}
            </div>}
            {visibleTree && share && (
                <OpenFoldersProvider serverOpenFolders={openFolders}>
                    <TreeHeader
                        share={share}
                        tree={visibleTree}
                        refreshing={treeLoading}
                        onRefresh={() => void onRecoverTree(share.id)}
                        setIsCreatingNewFile={setIsCreatingNewFile}
                        filter={filter}
                        setFilter={setFilter}
                    />
                    {rootFolder && visibleTree.length === 0 && (
                        <NewFile
                            isCreatingNewFile={isCreatingNewFile}
                            display={Boolean(isCreatingNewFile)}
                            newFileName={newFileName}
                            setNewFileName={setNewFileName}
                            setIsCreatingNewFile={setIsCreatingNewFile}
                            file={rootFolder}
                            tree={visibleTree}
                            setTree={setTree}
                            setShare={setShare}
                        />
                    )}
                    {filteredTree && filteredTree.length === 0 && filter.trim() ? (
                        <div className='px-2 py-4 text-xs text-ui-muted'>No files match "{filter.trim()}".</div>
                    ) : null}
                    <Tree
                        tree={filteredTree || []}
                        rootTree={visibleTree}
                        share={share}
                        state={{
                            newFileName,
                            setNewFileName,
                            isCreatingNewFile,
                            setIsCreatingNewFile,
                            selectedFolder,
                            setSelectedFolder,
                            setTree,
                            setShare,
                            onTreeRefresh: () => onRecoverTree(share.id),
                        }}
                    />
                </OpenFoldersProvider>
            )}
        </div>
    )
}

function filterTree(tree: Tree, query: string): Tree {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return tree

    return tree.flatMap((item): FileItem[] => {
        const ownMatch = item.name.toLowerCase().includes(normalizedQuery)
        if (item.type !== 'folder') return ownMatch ? [item] : []

        const children = filterTree(item.children, query)
        return ownMatch || children.length ? [{ ...item, children }] : []
    })
}

function TreeSkeleton() {
    return (
        <div aria-label='Loading file tree' className='space-y-3 p-2'>
            <div className='h-4 w-28 animate-pulse rounded bg-ui-border' />
            <div className='space-y-2'>
                {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className='flex items-center gap-2'>
                        <div className='h-4 w-4 animate-pulse rounded bg-ui-border' />
                        <div className={`h-3 animate-pulse rounded bg-ui-border ${index % 3 === 0 ? 'w-24' : index % 3 === 1 ? 'w-36' : 'w-28'}`} />
                    </div>
                ))}
            </div>
        </div>
    )
}
