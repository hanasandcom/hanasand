import { AppConfirmDialog } from '@/components/ui/appDialog'
import { Folder, FolderOpen } from 'lucide-react'
import { TreeNewFile } from './newFile'
import Tree from './tree'
import { FileNodeActions, RenameInput } from './fileNodeControls'
import type { FileNodeViewActions, FileNodeViewContext, FileNodeViewState } from './fileNodeTypes'

export function FolderNodeView({ context, state, actions, file }: {
    context: FileNodeViewContext
    state: FileNodeViewState
    actions: FileNodeViewActions
    file: Extract<FileItem, { type: 'folder' }>
}) {
    const { tree, rootTree, share } = context
    const { isRenaming, renameValue, setRenameValue, busy, deleteOpen, setDeleteOpen, isFolderActive, open } = state
    const hasChildren = Boolean(file.children?.filter(child => child.type === 'file').length)

    return (
        <li className='space-y-1' onClick={event => event.stopPropagation()}>
            <AppConfirmDialog
                open={deleteOpen}
                title={`Delete ${file.name}?`}
                body='Everything inside this folder will be deleted.'
                confirmLabel='Delete'
                tone='danger'
                onCancel={() => setDeleteOpen(false)}
                onConfirm={() => void actions.onDelete()}
            />
            <div
                onClick={actions.onFolderClick}
                className={`group/node flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm ${isFolderActive ? 'border border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
            >
                {open ? <FolderOpen size={16} /> : <Folder size={16} />}
                {isRenaming ? (
                    <RenameInput value={renameValue} setValue={setRenameValue} onCancel={actions.onCancelRename} onSave={actions.onSaveRename} />
                ) : <span className='min-w-0 flex-1 truncate'>{file.name}</span>}
                {!isRenaming && <FileNodeActions
                    busy={busy}
                    onCreateFile={() => actions.onStartCreate('file')}
                    onCreateFolder={() => actions.onStartCreate('folder')}
                    onRename={actions.onStartRename}
                    onDuplicate={actions.onDuplicate}
                    onDelete={() => setDeleteOpen(true)}
                />}
            </div>
            {!hasChildren && <div className='ml-3.5 rounded-md group-hover:bg-ui-raised'>
                <TreeNewFile display={isFolderActive} file={file} tree={tree} />
            </div>}
            {open && file.children && <div className='ml-3.5'>
                <Tree
                    tree={file.children}
                    rootTree={rootTree}
                    share={share}
                />
            </div>}
        </li>
    )
}
