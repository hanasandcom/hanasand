import { useState } from 'react'

export function useExpandableRows<T>(rows: T[], previewCount: number) {
    const [expanded, setExpanded] = useState(false)
    const visibleRows = expanded ? rows : rows.slice(0, previewCount)
    const moreButton = rows.length > previewCount && (
        <button
            type='button'
            className='w-fit rounded-md bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted transition hover:text-ui-text dark:bg-ui-canvas dark:text-ui-muted dark:hover:text-ui-text'
            onClick={() => setExpanded(current => !current)}
        >
            {expanded ? 'Show latest' : `${Math.max(0, rows.length - visibleRows.length)} more`}
        </button>
    )
    return { visibleRows, moreButton }
}
