'use client'

import { useState } from 'react'

type IdentifiedRow = { id: string }

export function previewRowsForSelection<T extends IdentifiedRow>(input: {
    rows: T[]
    selected?: T
    expanded: boolean
    previewCount: number
}) {
    const previewRows = input.rows.slice(0, input.previewCount)
    const selectedIsVisible = input.selected && previewRows.some(row => row.id === input.selected?.id)
    let visibleRows = previewRows
    if (input.expanded) visibleRows = input.rows
    else if (input.selected && !selectedIsVisible) {
        visibleRows = [...previewRows.slice(0, input.previewCount - 1), input.selected]
    }

    return {
        previewRows,
        visibleRows,
        hiddenCount: Math.max(0, input.rows.length - visibleRows.length),
        hasMore: input.rows.length > previewRows.length,
    }
}

export function useSelectedPreviewRows<T extends IdentifiedRow>(rows: T[], selected: T | undefined, previewCount: number) {
    const [expanded, setExpanded] = useState(false)
    return {
        ...previewRowsForSelection({ rows, selected, expanded, previewCount }),
        expanded,
        setExpanded,
    }
}

export function CompactRowsToggle({
    hiddenCount,
    expanded,
    hasMore,
    onExpandedChange,
    moreLabel,
    lessLabel,
    className,
}: {
    hiddenCount: number
    expanded: boolean
    hasMore: boolean
    onExpandedChange: (expanded: boolean) => void
    moreLabel: (count: number) => string
    lessLabel: string
    className: string
}) {
    if (hiddenCount > 0) {
        return <button type='button' onClick={() => onExpandedChange(true)} className={className}>{moreLabel(hiddenCount)}</button>
    }
    if (expanded && hasMore) {
        return <button type='button' onClick={() => onExpandedChange(false)} className={className}>{lessLabel}</button>
    }
    return null
}
