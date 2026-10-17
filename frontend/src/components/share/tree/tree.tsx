'use client'

import { FileTreeStateContext, type FileTreeState } from './fileNodeTypes'
import { useContext } from 'react'
import FileNode from './fileNode'

type TreeProps = {
    tree: Tree
    rootTree: Tree
    share: Share
    state?: FileTreeState
}

export default function Tree({
    tree,
    rootTree,
    share,
    state,
}: TreeProps) {
    const inheritedState = useContext(FileTreeStateContext)
    const treeState = state || inheritedState
    if (!treeState) throw new Error('File tree requires a tree state provider.')

    return (
        <FileTreeStateContext.Provider value={treeState}>
            <ul onClick={() => treeState.setSelectedFolder('')} className='group space-y-1 h-[86%]'>
                {tree.map((file) => (
                    <FileNode
                        tree={tree}
                        key={file.id}
                        file={file}
                        rootTree={rootTree}
                        share={share}
                    />
                ))}
            </ul>
        </FileTreeStateContext.Provider>
    )
}
