'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Pencil, Table2, Trash2 } from 'lucide-react'
import { columnName, type TableData } from './workspace'
import type { Cell, CustomTableControls } from './sheetEditorTypes'
import { sheetButton } from './sheetEditorStyles'

type Props = {
    title: ReactNode
    titleAside?: ReactNode
    actions?: ReactNode
    trailingActions?: ReactNode
    canEdit: boolean
    compact: boolean
    writing: boolean
    onToggleWriting(): void
    showInsertTable: boolean
    cell: Cell | null
    table?: { data: TableData }
    custom?: CustomTableControls
    wholeTable: number | null
    onSelectWholeTable(): void
    onDeleteTable(): void
    onChangeShape(axis: 'row' | 'column', remove: boolean, direction?: -1 | 1): void
    onSelectCell(cell: Cell, extend?: boolean, focus?: boolean): void
    onInsertTable(columns: number, rows: number): void
}

export default function SheetEditorHeader({
    title, titleAside, actions, trailingActions, canEdit, compact, writing, onToggleWriting,
    showInsertTable, cell, table, custom, wholeTable, onSelectWholeTable, onDeleteTable,
    onChangeShape, onSelectCell, onInsertTable,
}: Props) {
    const tableActionsId = useId()
    const tableActionsPanel = useRef<HTMLDivElement>(null)
    const tableActionsTrigger = useRef<HTMLButtonElement>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [columns, setColumns] = useState('2')
    const [rows, setRows] = useState('2')
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        if (dialogOpen) dialog.current?.showModal()
        else if (dialog.current?.open) dialog.current.close()
    }, [dialogOpen])

    function positionTableActions() {
        const panel = tableActionsPanel.current
        const trigger = tableActionsTrigger.current
        if (!panel || !trigger) return
        const box = trigger.getBoundingClientRect()
        const maxHeight = Math.min(448, window.innerHeight - 32)
        const width = Math.min(panel.offsetWidth || 288, window.innerWidth - 32)
        const height = Math.min(panel.offsetHeight || 180, maxHeight)
        panel.style.left = `${Math.max(16, Math.min(box.right - width, window.innerWidth - width - 16))}px`
        panel.style.top = `${Math.max(16, Math.min(box.bottom + 8, window.innerHeight - height - 16))}px`
        panel.style.maxHeight = `${maxHeight}px`
    }

    function insert() {
        const columnCount = Number(columns)
        const rowCount = Number(rows)
        if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > 20
            || !Number.isInteger(rowCount) || rowCount < 1 || rowCount > 100) return
        onInsertTable(columnCount, rowCount)
        setDialogOpen(false)
    }

    return <>
        <div className={titleAside ? 'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3' : 'flex min-w-0 items-start gap-4'}>
            <div className='min-w-0 flex-1'>{title}</div>
            {titleAside && <div>{titleAside}</div>}
            {(canEdit || actions) && <div data-table-tools className={`thesis-document-actions${titleAside ? ' thesis-document-actions-wide' : ''}`} aria-label='Document actions'>
                {actions}
                {canEdit && compact && <button className={sheetButton + ' w-10 px-0'} aria-label={writing ? 'Hide text editor' : 'Add text'} title={writing ? 'Hide text editor' : 'Add text'} aria-pressed={writing} onClick={onToggleWriting}><Pencil size={18} /></button>}
                {canEdit && <>
                    <button ref={tableActionsTrigger} type='button' popoverTarget={tableActionsId} aria-controls={tableActionsId} aria-haspopup='true' className={sheetButton + ' w-10 px-0'} aria-label='Table actions' title='Table actions' onClick={() => requestAnimationFrame(positionTableActions)}><Table2 size={18} /></button>
                    <div ref={tableActionsPanel} id={tableActionsId} popover='auto' role='group' className='thesis-table-actions-panel' aria-label='Table actions' onClickCapture={event => {
                        if ((event.target as HTMLElement).closest('button:not(:disabled)')) requestAnimationFrame(() => tableActionsPanel.current?.hidePopover())
                    }}>
                        {showInsertTable && <button className={sheetButton} onMouseDown={event => event.preventDefault()} onClick={() => setDialogOpen(true)}>Insert table</button>}
                        {cell && table ? <>
                            <p className='thesis-table-actions-label'>Table {cell.table + 1} · {columnName(cell.col)}{cell.row + 1}</p>
                            <button className={sheetButton} aria-pressed={wholeTable === cell.table} onClick={onSelectWholeTable}>Select table</button>
                            <button className={sheetButton} onClick={onDeleteTable}><Trash2 size={16} />Delete table</button>
                            <p className='thesis-table-actions-label'>Row</p>
                            <div className='thesis-table-actions-row'>
                                <button className={sheetButton} aria-label={`Add row above ${cell.row + 1}`} title={`Add row above ${cell.row + 1}`} onClick={() => onChangeShape('row', false, -1)}><ArrowUp size={16} />Above</button>
                                <button className={sheetButton} aria-label={`Add row below ${cell.row + 1}`} title={`Add row below ${cell.row + 1}`} onClick={() => onChangeShape('row', false, 1)}><ArrowDown size={16} />Below</button>
                                <button className={sheetButton} aria-label={`Remove row ${cell.row + 1}`} title={`Remove row ${cell.row + 1}`} disabled={custom ? !custom.canRemoveRow(cell.row) : cell.row === 0} onClick={() => onChangeShape('row', true)}><Trash2 size={16} />Delete</button>
                            </div>
                            <p className='thesis-table-actions-label'>Column</p>
                            <div className='thesis-table-actions-row'>
                                <button className={sheetButton} aria-label={`Add column left of ${columnName(cell.col)}`} title={`Add column left of ${columnName(cell.col)}`} onClick={() => onChangeShape('column', false, -1)}><ArrowLeft size={16} />Left</button>
                                <button className={sheetButton} aria-label={`Add column right of ${columnName(cell.col)}`} title={`Add column right of ${columnName(cell.col)}`} onClick={() => onChangeShape('column', false, 1)}><ArrowRight size={16} />Right</button>
                                {!custom && <button className={sheetButton} aria-label={`Remove column ${columnName(cell.col)}`} title={`Remove column ${columnName(cell.col)}`} disabled={table.data.cells[0].length <= 1} onClick={() => onChangeShape('column', true)}><Trash2 size={16} />Delete</button>}
                            </div>
                            <span className='thesis-table-actions-row [@media(hover:hover)_and_(pointer:fine)]:hidden'>
                                <button className={sheetButton} aria-label='Cell above' onClick={() => onSelectCell({ ...cell, row: cell.row - 1 }, true, true)}><ArrowUp size={18} />Above</button>
                                <button className={sheetButton} aria-label='Cell below' onClick={() => onSelectCell({ ...cell, row: cell.row + 1 }, true, true)}><ArrowDown size={18} />Below</button>
                            </span>
                        </> : !showInsertTable && <p className='text-sm text-ui-muted'>Select a table cell to see its actions.</p>}
                    </div>
                </>}
                {trailingActions}
            </div>}
        </div>
        {canEdit && <dialog ref={dialog} className='thesis-sheet-dialog' aria-labelledby='table-dialog-title' onCancel={event => { event.preventDefault(); setDialogOpen(false) }}>
            <form onSubmit={event => { event.preventDefault(); insert() }} className='grid gap-5'>
                <h2 id='table-dialog-title' className='text-lg font-semibold'>Insert table</h2>
                <label className='grid gap-2 text-sm font-medium'>Columns<input type='number' min={1} max={20} required value={columns} onChange={event => setColumns(event.target.value)} className='w-full rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-ui-text' /></label>
                <label className='grid gap-2 text-sm font-medium'>Rows<input type='number' min={1} max={100} required value={rows} onChange={event => setRows(event.target.value)} className='w-full rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-ui-text' /></label>
                <div className='flex justify-between gap-3 pt-2'><button type='button' onClick={() => setDialogOpen(false)} className='rounded-md border border-ui-border bg-ui-raised px-4 py-2 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button><button type='submit' disabled={Number(columns) < 1 || Number(columns) > 20 || Number(rows) < 1 || Number(rows) > 100} className='rounded-md bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-on-primary disabled:opacity-40'>Insert table</button></div>
            </form>
        </dialog>}
    </>
}
