import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

export type FileTreeState = {
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    selectedFolder: string
    setSelectedFolder: Dispatch<SetStateAction<string>>
    setTree: Dispatch<SetStateAction<Tree | null>>
    setShare: Dispatch<SetStateAction<Share | null>>
    onTreeRefresh: () => Promise<Tree | null>
}

export const FileTreeStateContext = createContext<FileTreeState | null>(null)

export function useFileTreeState() {
    const state = useContext(FileTreeStateContext)
    if (!state) throw new Error('File tree controls require a tree state provider.')
    return state
}

export type FileNodeProps = {
    tree: Tree
    file: FileItem
    rootTree: Tree
    share: Share
}

export type FileNodeViewContext = FileNodeProps

export type FileNodeViewState = {
    isRenaming: boolean
    renameValue: string
    setRenameValue: Dispatch<SetStateAction<string>>
    busy: boolean
    deleteOpen: boolean
    setDeleteOpen: Dispatch<SetStateAction<boolean>>
    isActive: boolean
    isFolderActive: boolean
    open: boolean
}

export type FileNodeViewActions = {
    onFolderClick(): void
    onStartCreate(type: 'file' | 'folder'): void
    onStartRename(): void
    onCancelRename(): void
    onSaveRename(): Promise<void>
    onDelete(): Promise<void>
    onDuplicate(): Promise<void>
}
