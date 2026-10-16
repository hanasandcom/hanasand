import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import type { PromptPortalItem } from '@/utils/promptPortal/store'
import { comparePromptItems } from '@/utils/promptPortal/ordering'

export function PromptQueue({ title, items, empty, onEdit, onDelete, onMove }: {
    title: string
    items: PromptPortalItem[]
    empty: string
    onEdit?: (item: PromptPortalItem) => void
    onDelete?: (item: PromptPortalItem) => void
    onMove?: (item: PromptPortalItem, direction: 'up' | 'down') => void
}) {
    const queuedItems = items.filter(item => item.status === 'queued').sort(comparePromptItems)

    return <section className='flex min-h-0 flex-col rounded-lg border border-ui-border bg-ui-panel'>
        <div className='border-b border-ui-border px-4 py-3'><h2 className='text-sm font-semibold'>{title}</h2></div>
        <div className='grid min-h-0 gap-2 overflow-y-auto p-3'>
            {items.length ? items.map(item => {
                const index = queuedItems.findIndex(queued => queued.id === item.id)
                return <PromptItem
                    key={item.id}
                    item={item}
                    index={index}
                    canMoveUp={index > 0}
                    canMoveDown={index >= 0 && index < queuedItems.length - 1}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                />
            }) : <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{empty}</p>}
        </div>
    </section>
}

function PromptItem({ item, index, canMoveUp, canMoveDown, onEdit, onDelete, onMove }: {
    item: PromptPortalItem
    index: number
    canMoveUp: boolean
    canMoveDown: boolean
    onEdit?: (item: PromptPortalItem) => void
    onDelete?: (item: PromptPortalItem) => void
    onMove?: (item: PromptPortalItem, direction: 'up' | 'down') => void
}) {
    const canMutate = item.status === 'queued'
    return <article className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-xs font-semibold uppercase text-ui-muted'>{queueLabel(item, index)} · {item.status}</span>
            <div className='flex items-center gap-1'>
                {canMutate && onMove ? <>
                    <button type='button' title='Move up' disabled={!canMoveUp} onClick={() => onMove(item, 'up')} className={iconButton}><ArrowUp className='h-3.5 w-3.5' /></button>
                    <button type='button' title='Move down' disabled={!canMoveDown} onClick={() => onMove(item, 'down')} className={iconButton}><ArrowDown className='h-3.5 w-3.5' /></button>
                </> : null}
                {canMutate && onEdit ? <button type='button' title='Edit' onClick={() => onEdit(item)} className={iconButton}><Pencil className='h-3.5 w-3.5' /></button> : null}
                {canMutate && onDelete ? <button type='button' title='Delete' onClick={() => onDelete(item)} className={iconButton}><Trash2 className='h-3.5 w-3.5' /></button> : null}
                <time className='ml-1 text-xs text-ui-muted'>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
        </div>
        <p className='whitespace-pre-wrap wrap-break-word text-sm leading-6 text-ui-text'>{item.prompt}</p>
        {item.files.length ? <p className='text-xs font-semibold text-ui-muted'>{item.files.length} image{item.files.length === 1 ? '' : 's'} attached</p> : null}
        {item.result ? <pre className='max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm leading-6 text-ui-text'>{item.result}</pre> : null}
    </article>
}

function queueLabel(item: PromptPortalItem, index: number) {
    if (item.status === 'running') return 'Running'
    if (item.priority === 'now') return 'Now'
    return index === 0 ? 'Next' : `#${index + 1}`
}

const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-35'
