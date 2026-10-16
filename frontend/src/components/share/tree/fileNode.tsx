'use client'

import useFolderState from '@/hooks/useFolderState'
import { deleteShare } from '@/utils/share/delete'
import { updateShare } from '@/utils/share/put'
import { getCookie } from '@/utils/cookies/cookies'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { duplicateTreeItem } from './duplicateTreeItem'
import { FileNodeView } from './fileNodeView'
import { FolderNodeView } from './folderNodeView'
import type { FileNodeProps, FileNodeViewActions, FileNodeViewContext, FileNodeViewState } from './fileNodeTypes'

export default function FileNode(props: FileNodeProps) {
    const { tree, file, selectedFolder, setSelectedFolder, rootTree, share, onTreeRefresh } = props
    const { isOpen, toggleFolder } = useFolderState()
    const [isRenaming, setIsRenaming] = useState(false)
    const [renameValue, setRenameValue] = useState(file.name)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const open = isOpen(file.id)
    const pathname = usePathname()
    const isActive = pathname.includes(`/s/${file.id}`)
    const isFolderActive = selectedFolder === file.id
    const isFirstFileInFolder = tree[0].id === file.id
    const firstFileInSelectedFolder = isFirstFileInFolder && selectedFolder === file.parent
    const shouldDisplay = Boolean((!selectedFolder && !file.parent) || (selectedFolder && firstFileInSelectedFolder))

    function handleFolderClick() {
        setSelectedFolder(file.id)
        toggleFolder(file.id)
    }

    function startCreate(type: 'file' | 'folder') {
        if (file.type === 'folder') {
            setSelectedFolder(file.id)
            if (!open) toggleFolder(file.id)
        } else {
            setSelectedFolder(file.parent || '')
        }
        props.setIsCreatingNewFile(type)
    }

    async function handleRename() {
        const nextName = renameValue.trim()
        if (!nextName || nextName === file.name) {
            setRenameValue(file.name)
            setIsRenaming(false)
            return
        }

        setBusyAction('rename')
        const updated = await updateShare(file.id, { name: nextName })
        if (updated) {
            await onTreeRefresh()
            setIsRenaming(false)
        } else {
            setRenameValue(file.name)
        }
        setBusyAction(null)
    }

    async function handleDelete() {
        setDeleteOpen(false)
        setBusyAction('delete')
        const deleted = await deleteShare(file.id, getCookie('access_token'), getCookie('id'))
        if (deleted) {
            await onTreeRefresh()
            if (pathname.includes(`/s/${file.id}`)) {
                window.history.replaceState(window.history.state, '', `/s/${share.alias || share.id}`)
            }
        }
        setBusyAction(null)
    }

    async function handleDuplicate() {
        setBusyAction('duplicate')
        await duplicateTreeItem({
            item: file,
            rootTree,
            parent: file.parent || undefined,
            token: getCookie('access_token'),
            userId: getCookie('id'),
            uniquifyName: true,
        })
        await onTreeRefresh()
        setBusyAction(null)
    }

    useEffect(() => {
        if (isActive && !selectedFolder && file.parent) setSelectedFolder(file.parent)
    }, [])

    useEffect(() => {
        const shouldDisplayNewFile = selectedFolder === file.id
        if (file.type === 'folder' && !open && props.isCreatingNewFile && shouldDisplayNewFile) {
            handleFolderClick()
        }
    }, [open, props.isCreatingNewFile, selectedFolder, file])

    const context: FileNodeViewContext = props
    const state: FileNodeViewState = {
        isRenaming,
        renameValue,
        setRenameValue,
        busy: Boolean(busyAction),
        deleteOpen,
        setDeleteOpen,
        isActive,
        isFolderActive,
        open,
    }
    const actions: FileNodeViewActions = {
        onFolderClick: handleFolderClick,
        onStartCreate: startCreate,
        onStartRename: () => setIsRenaming(true),
        onCancelRename: () => {
            setRenameValue(file.name)
            setIsRenaming(false)
        },
        onSaveRename: handleRename,
        onDelete: handleDelete,
        onDuplicate: handleDuplicate,
    }

    if (file.type === 'folder') return <FolderNodeView context={context} state={state} actions={actions} file={file} />
    return <FileNodeView context={context} state={state} actions={actions} isFirstFileInFolder={isFirstFileInFolder} shouldDisplay={shouldDisplay} />
}
