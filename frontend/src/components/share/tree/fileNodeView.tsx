import { File } from 'lucide-react'
import Link from 'next/link'
import { TreeNewFile } from './newFile'
import { FileNodeActions, RenameInput } from './fileNodeControls'
import { TreeItemDeleteDialog } from './treeItemDeleteDialog'
import type { FileNodeViewActions, FileNodeViewContext, FileNodeViewState } from './fileNodeTypes'

export function FileNodeView({ context, state, actions, isFirstFileInFolder, shouldDisplay }: {
    context: FileNodeViewContext
    state: FileNodeViewState
    actions: FileNodeViewActions
    isFirstFileInFolder: boolean
    shouldDisplay: boolean
}) {
    const { file, tree } = context
    const { isRenaming, renameValue, setRenameValue, busy, isActive, deleteOpen, setDeleteOpen } = state

    return (
        <>
            <TreeItemDeleteDialog
                kind='file'
                name={file.name}
                open={deleteOpen}
                onCancel={() => setDeleteOpen(false)}
                onConfirm={() => void actions.onDelete()}
            />
            <TreeNewFile display={isFirstFileInFolder && shouldDisplay} file={file} tree={tree} />
            <div className={`group/node flex items-center gap-2 rounded-md px-2 py-1 ${isActive ? 'border border-ui-primary/35 bg-ui-primary/10' : 'hover:bg-ui-raised'}`}>
                {isRenaming ? (
                    <>
                        <File size={14} className='shrink-0 text-ui-primary' />
                        <RenameInput value={renameValue} setValue={setRenameValue} onCancel={actions.onCancelRename} onSave={actions.onSaveRename} />
                    </>
                ) : (
                    <Link prefetch={false} href={`/s/${file.id}`} className='flex min-w-0 flex-1 items-center gap-2'>
                        <File size={14} className={isActive ? 'text-ui-primary' : 'text-ui-muted'} />
                        <span className={`truncate text-sm ${isActive ? 'font-semibold text-ui-text' : 'text-ui-muted'}`}>{file.name}</span>
                    </Link>
                )}
                {!isRenaming && <FileNodeActions busy={busy} actions={actions} onDelete={() => setDeleteOpen(true)} />}
            </div>
        </>
    )
}
