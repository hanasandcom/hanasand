import { useRef } from 'react'
import { columnName, type TableData } from './workspace'

type Axis = 'row' | 'column'
type Resize = { start: number, size: number, value: number }
type Props = { axis: Axis, index: number, data: TableData, scale: number, onChange?: (data: TableData, group?: string) => void }

export default function TableResizeHandle({ axis, index, data, scale, onChange }: Props) {
    const resize = useRef<Resize | null>(null)
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
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            resize.current = { start: axis === 'row' ? event.clientY : event.clientX, size, value: size }
        }}
        onPointerMove={event => {
            const state = resize.current
            if (!state) return
            state.value = Math.max(40, Math.min(1200, state.size + ((axis === 'row' ? event.clientY : event.clientX) - state.start) / (axis === 'row' ? 1 : scale)))
            event.currentTarget.setAttribute('aria-valuenow', String(state.value))
            const table = event.currentTarget.closest('table')!
            if (axis === 'row') (table.rows[index] as HTMLElement).style.height = `${state.value}px`
            else (table.querySelectorAll('col')[index] as HTMLElement).style.width = `${state.value * scale}px`
        }}
        onPointerUp={() => {
            const state = resize.current
            if (!state) return
            const values = [...(axis === 'row' ? data.heights : data.widths)]
            values[index] = state.value
            resize.current = null
            onChange?.({ ...data, [dimension]: values })
        }}
        onPointerCancel={() => { resize.current = null }}
    />
}
