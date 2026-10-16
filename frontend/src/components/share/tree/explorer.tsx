import useHideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import { getCookie } from '@/utils/cookies/cookies'
import { getTree } from '@/utils/share/getTree'
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import WorkspaceSearchPanel from '../workspaceSearchPanel'
import { ExplorerFilePanel } from './explorerFilePanel'
import { ExplorerNavigation } from './explorerNavigation'

type ExplorerProps = {
    showExplorer: boolean
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    openFolders: string[]
    tree: Tree | null
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setPageTree: Dispatch<SetStateAction<Tree | null>>
    panelRequest?: { panel: 'files' | 'search'; nonce: number } | null
}

export default function Explorer({
    showExplorer,
    setShowExplorer,
    openFolders,
    tree: serverTree,
    share,
    setShare,
    editingContent,
    setEditorPatch,
    setError,
    setPageTree,
    panelRequest,
}: ExplorerProps) {
    const { position, handleMouseDown, handleOpen } = useMovable({ side: 'left', setHide: setShowExplorer })
    const [activePanel, setActivePanel] = useState<'files' | 'search'>('files')
    const [isCreatingNewFile, setIsCreatingNewFile] = useState<'file' | 'folder' | null>(null)
    const [newFileName, setNewFileName] = useState('')
    const [selectedFolder, setSelectedFolder] = useState('')
    const [tree, setTree] = useState(serverTree)
    const [treeLoading, setTreeLoading] = useState(false)
    const [filter, setFilter] = useState('')
    useHideIfLittleSpace({ set: setShowExplorer })

    const setSyncedTree: Dispatch<SetStateAction<Tree | null>> = useCallback((value) => {
        setTree((current) => {
            return typeof value === 'function'
                ? (value as (previous: Tree | null) => Tree | null)(current)
                : value
        })
    }, [])

    const recoverTree = useCallback(async (shareId: string) => {
        setTreeLoading(true)
        try {
            const userId = getCookie('id') ?? undefined
            const token = getCookie('access_token') ?? undefined
            const nextTree = await getTree({ id: shareId, token, userId })
            setSyncedTree(nextTree)
            return nextTree
        } finally {
            setTreeLoading(false)
        }
    }, [setSyncedTree])

    useEffect(() => {
        setTree(serverTree)
    }, [serverTree])

    useEffect(() => {
        setPageTree(tree)
    }, [setPageTree, tree])

    useEffect(() => {
        if (!panelRequest) {
            return
        }

        setActivePanel(panelRequest.panel)
        setShowExplorer(true)
    }, [panelRequest?.nonce, setShowExplorer])

    useEffect(() => {
        const shareId = share?.id
        if (tree || !shareId) {
            return
        }
        const currentShareId: string = shareId

        let cancelled = false

        async function recoverTree() {
            const nextTree = await recoverTreeOnce(currentShareId)

            if (!cancelled) {
                setSyncedTree(nextTree)
            }
        }

        async function recoverTreeOnce(nextShareId: string) {
            setTreeLoading(true)
            const userId = getCookie('id') ?? undefined
            const token = getCookie('access_token') ?? undefined
            const nextTree = await getTree({ id: nextShareId, token, userId })
            if (!cancelled) {
                setTreeLoading(false)
            }
            return nextTree
        }

        void recoverTree()

        return () => {
            cancelled = true
        }
    }, [share?.id, setSyncedTree, tree])

    if (!showExplorer) {
        return (
            <ExplorerNavigation
                showExplorer={false}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                setShowExplorer={setShowExplorer}
                position={position}
                onMouseDown={handleMouseDown}
                onOpen={handleOpen}
            />
        )
    }

    return (
        <div className='fixed inset-y-2 left-2 z-[120] flex min-w-0 gap-2 md:relative md:inset-auto md:z-auto md:h-full md:min-w-fit'>
            <ExplorerNavigation
                showExplorer
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                setShowExplorer={setShowExplorer}
                position={position}
                onMouseDown={handleMouseDown}
                onOpen={handleOpen}
            />
            {activePanel === 'search' ? (
                <WorkspaceSearchPanel
                    tree={tree}
                    share={share}
                    editingContent={editingContent}
                    setShare={setShare}
                    setEditorPatch={setEditorPatch}
                    setError={setError}
                />
            ) : (
                <ExplorerFilePanel
                    openFolders={openFolders}
                    tree={tree}
                    treeLoading={treeLoading}
                    share={share}
                    setShare={setShare}
                    onRecoverTree={recoverTree}
                    isCreatingNewFile={isCreatingNewFile}
                    setIsCreatingNewFile={setIsCreatingNewFile}
                    newFileName={newFileName}
                    setNewFileName={setNewFileName}
                    selectedFolder={selectedFolder}
                    setSelectedFolder={setSelectedFolder}
                    setTree={setSyncedTree}
                    filter={filter}
                    setFilter={setFilter}
                />
            )}
        </div>
    )
}
