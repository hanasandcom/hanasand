import type { Dispatch, SetStateAction } from 'react'
import { Copy, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react'

export function RenameInput({ value, setValue, onSave, onCancel }: {
    value: string
    setValue: Dispatch<SetStateAction<string>>
    onSave: () => Promise<void>
    onCancel: () => void
}) {
    return (
        <input
            autoFocus
            value={value}
            onClick={event => event.stopPropagation()}
            onChange={event => setValue(event.target.value)}
            onBlur={() => void onSave()}
            onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    void onSave()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel()
                }
            }}
            className='min-w-0 flex-1 rounded border border-ui-primary/35 bg-ui-panel px-1 text-sm text-ui-text outline-none'
        />
    )
}

export function FileNodeActions({ busy, onCreateFile, onCreateFolder, onRename, onDuplicate, onDelete }: {
    busy: boolean
    onCreateFile: () => void
    onCreateFolder: () => void
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}) {
    const buttonClass = 'grid h-6 w-6 place-items-center rounded text-ui-muted opacity-0 transition hover:bg-ui-panel hover:text-ui-text group-hover/node:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40'

    return (
        <div className='ml-auto flex shrink-0 items-center gap-0.5'>
            <button type='button' aria-label='Create file here' disabled={busy} onClick={stopAnd(onCreateFile)} className={buttonClass}>
                <FilePlus className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Create folder here' disabled={busy} onClick={stopAnd(onCreateFolder)} className={buttonClass}>
                <FolderPlus className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Rename item' disabled={busy} onClick={stopAnd(onRename)} className={buttonClass}>
                <Pencil className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Duplicate item' disabled={busy} onClick={stopAnd(onDuplicate)} className={buttonClass}>
                <Copy className='h-3.5 w-3.5' />
            </button>
            <button type='button' aria-label='Delete item' disabled={busy} onClick={stopAnd(onDelete)} className={`${buttonClass} hover:text-ui-text`}>
                <Trash2 className='h-3.5 w-3.5' />
            </button>
        </div>
    )
}

function stopAnd(action: () => void) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()
        action()
    }
}
