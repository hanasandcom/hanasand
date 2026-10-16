import { useEffect, useRef, useState } from 'react'
import { cellValue, columnName, tableEditorRows, type TableData } from './workspace'
import RenderMarkdown from './RenderMarkdown'
import type { Cell } from './sheetEditorTypes'

type Props = {
    data: TableData
    index: number
    active: Cell | null
    onSelect(cell: Cell): void
    onNavigate(cell: Cell, extend?: boolean): void
    onChange?(data: TableData, group?: string): void
}
export default function InlineTable({ data, index, active, onSelect, onNavigate, onChange }: Props) {
    const tableScroll = useRef<HTMLDivElement>(null)
    const [availableWidth, setAvailableWidth] = useState(0)
    const [focused, setFocused] = useState('')
    const [completionCell, setCompletionCell] = useState('')
    const [dismissedCompletion, setDismissedCompletion] = useState('')
    const composing = useRef(false)
    const resize = useRef<{ axis: 'row' | 'column', index: number, start: number, size: number, value: number } | null>(null)
    useEffect(() => {
        const element = tableScroll.current
        if (!element) return
        const measure = () => setAvailableWidth(element.clientWidth)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    const naturalWidth = data.cells[0].reduce((sum, _, col) => sum + (data.widths[col] || 180), 0)
    const scale = availableWidth > 0 ? availableWidth / naturalWidth : 1
    function resizeHandle(axis: 'row' | 'column', index: number) {
        const size = (axis === 'row' ? data.heights[index] : data.widths[index]) || (axis === 'row' ? 48 : 180)
        const dimension = axis === 'row' ? 'heights' : 'widths'
        return <span
            role='separator' tabIndex={0}
            aria-label={`Resize ${axis} ${axis === 'row' ? index + 1 : columnName(index)}`}
            aria-orientation={axis === 'row' ? 'horizontal' : 'vertical'}
            aria-valuenow={size} aria-valuemin={40} aria-valuemax={1200}
            data-table-tools className={`thesis-resize thesis-resize-${axis}`}
            onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                event.preventDefault()
                const values = [...(axis === 'row' ? data.heights : data.widths)]
                values[index] = Math.max(40, Math.min(1200, size + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -10 : 10)))
                onChange?.({ ...data, [dimension]: values })
            }}
            onPointerDown={event => {
                event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
                resize.current = { axis, index, start: axis === 'row' ? event.clientY : event.clientX, size, value: size }
            }}
            onPointerMove={event => {
                if (!resize.current) return
                const state = resize.current
                state.value = Math.max(40, Math.min(1200, state.size + ((axis === 'row' ? event.clientY : event.clientX) - state.start) / (axis === 'row' ? 1 : scale)))
                event.currentTarget.setAttribute('aria-valuenow', String(state.value))
                const table = event.currentTarget.closest('table')!
                if (axis === 'row') (table.rows[index] as HTMLElement).style.height = `${state.value}px`
                else (table.querySelectorAll('col')[index] as HTMLElement).style.width = `${state.value * scale}px`
            }}
            onPointerUp={() => {
                if (!resize.current) return
                const values = [...(axis === 'row' ? data.heights : data.widths)]
                values[index] = resize.current.value; resize.current = null
                onChange?.({ ...data, [dimension]: values })
            }}
            onPointerCancel={() => { resize.current = null }}
        />
    }

    function updateCell(raw: string, row: number, col: number, address: string, cursorAtEnd: boolean) {
        const next = data.cells.map(line => [...line])
        next[row][col] = raw
        onChange?.({ ...data, cells: next }, `cell:${index}:${row}:${col}`)
        setDismissedCompletion('')
        setCompletionCell(!composing.current && cursorAtEnd ? address : '')
    }

    function navigateFromCell(event: React.KeyboardEvent<HTMLTextAreaElement>, raw: string, row: number, col: number, address: string, suggestion: string) {
        if (event.nativeEvent.isComposing || event.metaKey || event.ctrlKey || event.altKey) return
        const input = event.currentTarget
        if (event.key === 'Escape') {
            if (suggestion) {
                event.preventDefault()
                setDismissedCompletion(`${address}:${raw}`)
                setCompletionCell('')
            } else input.blur()
            return
        }
        if (event.key === 'Tab' && !event.shiftKey && suggestion && input.selectionStart === raw.length && input.selectionEnd === raw.length) {
            event.preventDefault()
            const next = data.cells.map(line => [...line])
            next[row][col] = '=SUMMARIZE()'
            setCompletionCell('')
            onChange?.({ ...data, cells: next })
            requestAnimationFrame(() => input.setSelectionRange('=SUMMARIZE()'.length - 1, '=SUMMARIZE()'.length - 1))
            return
        }
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault()
            onNavigate({ table: index, row: row + 1, col }, true)
            return
        }
        if (input.selectionStart !== input.selectionEnd || (event.shiftKey && event.key !== 'Tab')) return
        const cursor = input.selectionStart
        let nextRow = row, nextCol = col
        if (event.key === 'ArrowUp' && !raw.slice(0, cursor).includes('\n')) nextRow--
        else if (event.key === 'ArrowDown' && !raw.slice(cursor).includes('\n')) nextRow++
        else if (event.key === 'ArrowLeft' && cursor === 0) nextCol--
        else if (event.key === 'ArrowRight' && cursor === raw.length) nextCol++
        else if (event.key === 'Tab') {
            const next = row * data.cells[0].length + col + (event.shiftKey ? -1 : 1)
            nextRow = Math.floor(next / data.cells[0].length)
            nextCol = next % data.cells[0].length
        } else return
        if (event.key === 'Tab' && (nextRow < 0 || nextCol < 0 || nextRow >= data.cells.length || nextCol >= data.cells[0].length)) return
        event.preventDefault()
        onNavigate({ table: index, row: nextRow, col: nextCol }, event.key !== 'Tab')
    }

    return (
        <section className='thesis-table-block' aria-label='Inline table'>
            <div ref={tableScroll} className='thesis-table-scroll'>
                <table style={{ width: '100%' }}>
                    <colgroup>{data.cells[0].map((_, col) => (
                        <col key={col} style={{ width: `${((data.widths[col] || 180) / naturalWidth) * 100}%` }} />
                    ))}</colgroup>
                    <tbody>{data.cells.map((cells, row) => (
                        <tr key={row} style={{ height: Math.max(26, data.heights[row] || 48) }}>
                            {cells.map((raw, col) => {
                                const CellElement = row === 0 ? 'th' : 'td'
                                const address = `${columnName(col)}${row + 1}`
                                const value = cellValue(data.cells, row, col)
                                const completion = '=SUMMARIZE()'
                                const suggestion = focused === address && completionCell === address
                                    && dismissedCompletion !== `${address}:${raw}`
                                    && /^=[a-z]*$/i.test(raw) && '=SUMMARIZE'.startsWith(raw.toUpperCase())
                                    ? completion.slice(raw.length) : ''
                                const editing = focused === address
                                return (
                                    <CellElement
                                        key={col}
                                        data-active={active?.table === index && active.row === row && active.col === col}
                                        data-editing={editing || undefined}
                                        scope={row === 0 ? 'col' : undefined}
                                        onClick={event => {
                                            if (!onChange || editing || (event.target as HTMLElement).closest('a, textarea, [data-table-tools]')) return
                                            onSelect({ table: index, row, col })
                                            requestAnimationFrame(() => tableScroll.current?.querySelector<HTMLTextAreaElement>(`textarea[data-table-cell="${index}:${row}:${col}"]`)?.focus())
                                        }}
                                    >
                                        <div className='thesis-table-cell-render'><RenderMarkdown text={value} /></div>
                                        {onChange ? (
                                            <textarea
                                                data-table-cell={`${index}:${row}:${col}`}
                                                aria-label={`Cell ${address}`}
                                                spellCheck={false}
                                                rows={tableEditorRows(raw)}
                                                value={editing ? raw : value}
                                                aria-autocomplete='inline'
                                                aria-description={suggestion ? 'Tab to complete SUMMARIZE' : undefined}
                                                onFocus={event => {
                                                    setFocused(address)
                                                    setDismissedCompletion('')
                                                    setCompletionCell(event.currentTarget.selectionStart === raw.length ? address : '')
                                                    onSelect({ table: index, row, col })
                                                }}
                                                onBlur={() => { setFocused(''); setCompletionCell('') }}
                                                onSelect={event => {
                                                    const input = event.currentTarget
                                                    setCompletionCell(!composing.current && input.selectionStart === input.value.length && input.selectionEnd === input.value.length ? address : '')
                                                }}
                                                onCompositionStart={() => { composing.current = true; setCompletionCell('') }}
                                                onCompositionEnd={event => {
                                                    composing.current = false
                                                    setCompletionCell(event.currentTarget.selectionStart === event.currentTarget.value.length ? address : '')
                                                }}
                                                onChange={event => {
                                                    const input = event.currentTarget
                                                    updateCell(input.value, row, col, address, input.selectionStart === input.value.length)
                                                }}
                                                onKeyDown={event => navigateFromCell(event, raw, row, col, address, suggestion)}
                                            />
                                        ) : null}
                                        {onChange && suggestion ? (
                                            <span className='thesis-formula-suggestion' aria-hidden='true'><span className='invisible'>{raw}</span>{suggestion}</span>
                                        ) : null}
                                        {onChange && row === 0 ? resizeHandle('column', col) : null}
                                        {onChange && col === 0 ? resizeHandle('row', row) : null}
                                    </CellElement>
                                )
                            })}
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </section>
    )
}
