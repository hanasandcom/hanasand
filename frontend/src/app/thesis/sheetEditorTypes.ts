import type { ReactNode } from 'react'
import type { Sheet, TableData } from './workspace'

export type Cell = { table: number, row: number, col: number }
export type TableInteraction = {
    active: Cell | null
    onSelect: (cell: Cell) => void
    onNavigate: (cell: Cell, extend?: boolean) => void
}
export type CustomTableControls = {
    index: number
    cells: string[][]
    copyCells?: string[][]
    changeRow: (row: number, remove: boolean, direction?: -1 | 1) => number
    changeColumn?: (col: number, direction: -1 | 1) => void
    canRemoveRow: (row: number) => boolean
    extendRow: (direction: -1 | 1) => number
}
export type SheetEditorProps = {
    contentOnly?: boolean
    sheet: Sheet
    canEdit: boolean
    actions?: ReactNode
    trailingActions?: ReactNode
    showInsertTable?: boolean
    titleAside?: ReactNode
    beforeContent?: ReactNode
    customTable?: CustomTableControls
    renderTable?: (data: TableData, index: number, interaction: TableInteraction) => ReactNode
    onChange: (field: 'title' | 'body', value: string, group?: string) => void
}
