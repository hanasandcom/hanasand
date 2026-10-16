import type { Dispatch, SetStateAction } from 'react'

export type FileNodeProps = {
    tree: Tree
    file: FileItem
    newFileName: string
    setNewFileName: Dispatch<SetStateAction<string>>
    isCreatingNewFile: 'file' | 'folder' | null
    setIsCreatingNewFile: Dispatch<SetStateAction<'file' | 'folder' | null>>
    selectedFolder: string
    setSelectedFolder: Dispatch<SetStateAction<string>>
    setTree: Dispatch<SetStateAction<Tree | null>>
    setShare: Dispatch<SetStateAction<Share | null>>
    rootTree: Tree
    share: Share
    onTreeRefresh: () => Promise<Tree | null>
}

export type FileNodeViewContext = Pick<FileNodeProps,
    'tree' | 'file' | 'newFileName' | 'setNewFileName' | 'isCreatingNewFile'
    | 'setIsCreatingNewFile' | 'selectedFolder' | 'setSelectedFolder' | 'setTree'
    | 'setShare' | 'rootTree' | 'share' | 'onTreeRefresh'
>

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
