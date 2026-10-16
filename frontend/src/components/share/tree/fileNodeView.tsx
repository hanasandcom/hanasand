import { AppConfirmDialog } from '@/components/ui/appDialog'
import { File } from 'lucide-react'
import Link from 'next/link'
import NewFile from './newFile'
import { FileNodeActions, RenameInput } from './fileNodeControls'
import type { FileNodeViewActions, FileNodeViewContext, FileNodeViewState } from './fileNodeTypes'

export function FileNodeView({ context, state, actions, isFirstFileInFolder, shouldDisplay }: {
    context: FileNodeViewContext
    state: FileNodeViewState
    actions: FileNodeViewActions
    isFirstFileInFolder: boolean
    shouldDisplay: boolean
}) {
    const { file, tree, newFileName, setNewFileName, isCreatingNewFile, setIsCreatingNewFile, setTree, setShare } = context
    const { isRenaming, renameValue, setRenameValue, busy, isActive, deleteOpen, setDeleteOpen } = state

    return (
        <>
            <AppConfirmDialog
                open={deleteOpen}
                title={`Delete ${file.name}?`}
                body='This file will be deleted from the share.'
                confirmLabel='Delete'
                tone='danger'
                onCancel={() => setDeleteOpen(false)}
                onConfirm={() => void actions.onDelete()}
            />
            <NewFile
                isCreatingNewFile={isCreatingNewFile}
                display={isFirstFileInFolder && shouldDisplay}
                newFileName={newFileName}
                setNewFileName={setNewFileName}
                setIsCreatingNewFile={setIsCreatingNewFile}
                file={file}
                tree={tree}
                setTree={setTree}
                setShare={setShare}
            />
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
                {!isRenaming && <FileNodeActions
                    busy={busy}
                    onCreateFile={() => actions.onStartCreate('file')}
                    onCreateFolder={() => actions.onStartCreate('folder')}
                    onRename={actions.onStartRename}
                    onDuplicate={actions.onDuplicate}
                    onDelete={() => setDeleteOpen(true)}
                />}
            </div>
        </>
    )
}
