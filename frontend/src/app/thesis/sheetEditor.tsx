'use client'

import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import { replaceTableAt, reshape, tables, writeTable, type TableData } from './workspace'
import InlineMarkdown from './inlineMarkdown'
import InlineTable from './InlineTable'
import RenderMarkdown from './RenderMarkdown'
import SheetEditorHeader from './SheetEditorHeader'
import { navigateTable, type PendingTable } from './tableNavigation'
import type { Cell, SheetEditorProps } from './sheetEditorTypes'
import { sheetButton } from './sheetEditorStyles'
export type { Cell, CustomTableControls, SheetEditorProps, TableInteraction } from './sheetEditorTypes'
import './workspace.css'

export default function SheetEditor({ sheet, canEdit, onChange, actions, trailingActions, titleAside, beforeContent, renderTable, customTable, showInsertTable = true, contentOnly = false }: SheetEditorProps) {
    const root = useRef<HTMLDivElement>(null)
    const [writing, setWriting] = useState(false)
    const selection = useRef<{ source: string, start: number, end: number } | null>(null)
    const [active, setActive] = useState<Cell | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
    const [wholeTable, setWholeTable] = useState<number | null>(null)
    useEffect(() => { setWholeTable(null) }, [sheet.body, active])
    const [pending, setPending] = useState<(PendingTable & { table: number, source: string }) | null>(null)
    const draft = active && canEdit && pending?.source === sheet.body ? pending : null
    const parsed = tables(sheet.body).map((table, index) => draft?.table === index ? { ...table, data: draft.data } : table)
    useEffect(() => { if (!active || pending?.source !== sheet.body) setPending(null) }, [active, sheet.body])
    const table = active ? parsed[active.table] : undefined
    const custom = active?.table === customTable?.index ? customTable : undefined
    const visibleCells = custom?.cells || table?.data.cells
    const cell = active && visibleCells && active.row >= 0 && active.row < visibleCells.length && active.col >= 0 && active.col < visibleCells[0].length ? active : null
    useEffect(() => {
        let pointerTarget: HTMLElement | null = null
        const rememberPointer = (event: PointerEvent) => { pointerTarget = event.target as HTMLElement }
        const clearOutside = (event: Event) => {
            // Opening the toolbar can move the cell before pointer-up. Use the original target.
            const target = event.type === 'click' ? pointerTarget || event.target as HTMLElement : event.target as HTMLElement
            if (event.type === 'click') pointerTarget = null
            if (!root.current?.contains(target) || !target.closest('[data-table-cell], [data-table-tools]')) setActive(null)
        }
        window.document.addEventListener('pointerdown', rememberPointer, true)
        window.document.addEventListener('click', clearOutside)
        window.document.addEventListener('focusin', clearOutside)
        return () => {
            window.document.removeEventListener('pointerdown', rememberPointer, true)
            window.document.removeEventListener('click', clearOutside)
            window.document.removeEventListener('focusin', clearOutside)
        }
    }, [])
    function focusCell(next: Cell) {
        setActive(next)
        requestAnimationFrame(() => {
            const input = root.current?.querySelector<HTMLElement>(`[data-table-cell="${next.table}:${next.row}:${next.col}"]`)
            input?.focus({ preventScroll: true })
            if (input instanceof HTMLTextAreaElement) input.setSelectionRange(input.value.length, input.value.length)
            const largeTable = (input?.closest('table')?.getBoundingClientRect().height || 0) > window.innerHeight
            input?.scrollIntoView({ block: largeTable ? 'center' : 'nearest', inline: 'nearest', behavior: 'instant' })
        })
    }
    function selectCell(next: Cell, extend = false, focus = false) {
        setWholeTable(null)
        const current = parsed[next.table]
        if (!current) return
        if (customTable?.index === next.table) {
            let row = next.row
            if (extend && (row < 0 || row >= customTable.cells.length)) row = customTable.extendRow(row < 0 ? -1 : 1)
            else row = Math.max(0, Math.min(row, customTable.cells.length - 1))
            const target = { ...next, row, col: Math.max(0, Math.min(next.col, customTable.cells[0].length - 1)) }
            if (focus) focusCell(target)
            else setActive(target)
            return
        }
        const move = navigateTable(draft?.table === next.table ? draft : { data: current.data }, next, extend)
        setPending(move.row !== undefined || move.col !== undefined ? { ...move, table: next.table, source: sheet.body } : null)
        const target = { ...next, ...move.cell }
        if (focus || target.row !== next.row || target.col !== next.col) focusCell(target)
        else setActive(target)
    }
    function updateTable(index: number, data: TableData, group?: string, explicitShape = false) {
        if (draft?.table === index && !explicitShape && !data.cells.some((row, r) => row.some((value, c) => (r === draft.row || c === draft.col) && value.trim()))) {
            setPending({ ...draft, data })
            return
        }
        setPending(null)
        const target = parsed[index]
        onChange('body', replaceTableAt(sheet.body, target, data), group)
    }
    function changeShape(axis: 'row' | 'column', remove: boolean, direction: -1 | 1 = 1) {
        if (!cell || !table) return
        if (custom) {
            if (axis === 'row') focusCell({ ...cell, row: custom.changeRow(cell.row, remove, direction) })
            else if (!remove) custom.changeColumn?.(cell.col, direction)
            return
        }
        const index = axis === 'row' ? cell.row : cell.col
        const insertion = index + (direction > 0 ? 1 : 0)
        const data = reshape(table.data, axis, remove ? index : insertion, remove)
        updateTable(cell.table, data, undefined, true)
        focusCell({ ...cell, row: axis === 'row' ? Math.min(remove ? index : insertion, data.cells.length - 1) : cell.row, col: axis === 'column' ? Math.min(remove ? index : insertion, data.cells[0].length - 1) : cell.col })
    }
    const tokens = marked.lexer(sheet.body)
    const compact = (contentOnly || parsed.length > 0 || tokens.some(token => token.type === 'code')) && tokens.every(token => ['space', 'table', 'code', 'html'].includes(token.type) && (token.type !== 'html' || /^<!-- thesis-table:/.test(token.raw)))
    function prose(text: string, start: number, end: number, beforeTable = false) {
        if (!text.trim() && (!canEdit || (compact && !writing))) return null
        const displayText = beforeTable ? text.replace(/(?:\r?\n[ \t]*)+$/, '') : text
        if (compact && !writing) return <RenderMarkdown text={displayText} />
        return canEdit ? <InlineMarkdown text={text} displayText={displayText} label='Description Markdown' showEmptyHint={!parsed.length} showAddTextButton={!beforeTable}
            onSelection={(a, b) => { selection.current = { source: sheet.body, start: start + a, end: start + b } }}
            onChange={(value, group) => {
                const separated = beforeTable && value.trim() && !/(?:\r?\n)$/.test(value) ? value + '\n' : value
                onChange('body', sheet.body.slice(0, start) + separated + sheet.body.slice(end), group ? `prose:${start}:${group}` : undefined)
            }} /> : <RenderMarkdown text={displayText} />
    }
    let offset = 0
    const content = parsed.map((table, index) => {
        const before = prose(sheet.body.slice(offset, table.start), offset, table.start, true)
        offset = table.end
        return <div key={index}>{before}<div data-sheet-table={index} data-table-tools={wholeTable === index ? '' : undefined} tabIndex={wholeTable === index ? -1 : undefined} className={wholeTable === index ? 'thesis-selected-table' : undefined}
            onCopy={event => {
                if (wholeTable !== index) return
                event.preventDefault()
                event.clipboardData.setData('text/plain', (customTable?.index === index ? customTable.copyCells || customTable.cells : table.data.cells).map(row => row.map(value => /[\t\n"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value).join('\t')).join('\n'))
            }}
            onKeyDown={event => {
                if (wholeTable !== index) return
                if (event.key === 'Escape') { event.preventDefault(); setWholeTable(null); if (cell) focusCell(cell) }
                if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteTable(index) }
            }}>{renderTable?.(table.data, index, { active: cell, onSelect: next => selectCell(next), onNavigate: (next, extend) => selectCell(next, extend, true) }) ?? <InlineTable data={table.data} index={index} active={cell} onSelect={next => selectCell(next)} onNavigate={(next, extend) => selectCell(next, extend, true)}
                onChange={canEdit ? (data, group) => updateTable(index, data, group) : undefined} />}</div></div>
    })
    function deleteTable(index: number) {
        const target = parsed[index]
        if (!canEdit || !target) return
        onChange('body', sheet.body.slice(0, target.start) + sheet.body.slice(target.end))
        setWholeTable(null)
        setActive(null)
        setPending(null)
    }
    function selectWholeTable() {
        if (!cell) return
        setWholeTable(cell.table)
        requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-sheet-table="${cell.table}"]`)?.focus({ preventScroll: true }))
    }
    function insertTable(columns: number, rows: number) {
        const savedSelection = selection.current?.source === sheet.body ? selection.current : null
        const start = cell ? parsed[cell.table].end : savedSelection?.start ?? sheet.body.length
        const end = cell ? start : savedSelection?.end ?? sheet.body.length
        const value = '\n\n' + writeTable({ cells: Array.from({ length: rows }, () => Array.from({ length: columns }, () => '')), widths: [], heights: [] }) + '\n'
        onChange('body', sheet.body.slice(0, start) + value + sheet.body.slice(end))
        setActive(null)
    }
    return <div ref={root} className='grid min-w-0 gap-5' onKeyDownCapture={event => { if (event.key === 'Escape') setContextMenu(null) }} onBlurCapture={event => {
        if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-table-cell], [data-table-tools]')) setActive(null)
    }}>
        <SheetEditorHeader
            title={canEdit
                ? <InlineMarkdown text={sheet.title || '# Untitled'} label='Title Markdown' singleLine onChange={value => onChange('title', value, 'title')} />
                : <RenderMarkdown text={sheet.title || '# Untitled'} />}
            titleAside={titleAside}
            actions={actions}
            trailingActions={trailingActions}
            canEdit={canEdit}
            compact={compact}
            writing={writing}
            onToggleWriting={() => setWriting(value => !value)}
            showInsertTable={showInsertTable}
            cell={cell}
            table={table}
            custom={custom}
            wholeTable={wholeTable}
            onSelectWholeTable={selectWholeTable}
            onDeleteTable={() => cell && deleteTable(cell.table)}
            onChangeShape={changeShape}
            onSelectCell={selectCell}
            onInsertTable={insertTable}
        />
        {beforeContent}
        {(!compact || writing || sheet.body.trim()) && <div className='min-w-0' onClick={() => setContextMenu(null)} onContextMenu={event => {
            if (!canEdit) return
            const target = event.target as HTMLElement
            const address = target.closest<HTMLElement>('[data-table-cell]')?.dataset.tableCell
            if (!address) return
            const [tableIndex, row, col] = address.split(':').map(Number)
            event.preventDefault()
            selectCell({ table: tableIndex, row, col })
            setContextMenu({ x: event.clientX, y: event.clientY })
        }}>{content}{prose(sheet.body.slice(offset), offset, sheet.body.length)}</div>}
        {contextMenu && cell && table && <div role='menu' aria-label='Table actions' className='fixed z-50 grid min-w-48 gap-1 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-xl' style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 210)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 220)) }} onKeyDown={event => { if (event.key === 'Escape') setContextMenu(null) }}>
            <button role='menuitem' className={sheetButton} onClick={() => { changeShape('row', false, -1); setContextMenu(null) }}>Insert row above</button>
            <button role='menuitem' className={sheetButton} onClick={() => { changeShape('row', false, 1); setContextMenu(null) }}>Insert row below</button>
            <button role='menuitem' className={sheetButton} onClick={() => { changeShape('column', false, -1); setContextMenu(null) }}>Insert column left</button><button role='menuitem' className={sheetButton} onClick={() => { changeShape('column', false, 1); setContextMenu(null) }}>Insert column right</button>
            <button role='menuitem' className={sheetButton} disabled={custom ? !custom.canRemoveRow(cell.row) : cell.row === 0} onClick={() => { changeShape('row', true); setContextMenu(null) }}>Delete row</button>
            {!custom && <button role='menuitem' className={sheetButton} onClick={() => { changeShape('column', true); setContextMenu(null) }}>Delete column</button>}
        </div>}
    </div>
}
