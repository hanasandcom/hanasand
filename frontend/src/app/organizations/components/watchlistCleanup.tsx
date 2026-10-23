import { useState } from 'react'
import { Archive } from 'lucide-react'
import type { WatchlistItem } from '../types/watchlists'
import { secondaryButtonClass } from '../constants/styles'
import { ConfirmActionButton } from './shared'

export function watchlistCleanupSelectionKey(organizationId: string, items: WatchlistItem[]) {
    return JSON.stringify([organizationId, items.map(item => [item.id, item.organizationId, item.tenantId, item.status, item.archivedAt, item.kind, item.value])])
}

export function WatchlistCleanup({ organizationId, items, disabled, onCleanup }: {
    organizationId: string
    items: WatchlistItem[]
    disabled: boolean
    onCleanup: (itemIds: string[]) => void
}) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const eligible = items.filter(item => item.status !== 'archived' && !item.archivedAt
        && (!item.organizationId || item.organizationId === organizationId)
        && (!item.tenantId || item.tenantId === organizationId))
    const selected = eligible.filter(item => selectedIds.includes(item.id))
    return (
        <details className='mt-3 rounded-lg border border-ui-border p-3' data-org-watchlist-cleanup='true'>
            <summary className='cursor-pointer text-sm font-semibold'>Archive selected terms</summary>
            <p className='mt-2 text-xs text-ui-muted'>Choose up to 50 terms. Archiving stops their monitoring; you can restore them later.</p>
            <fieldset disabled={disabled} className='mt-2 grid max-h-64 gap-2 overflow-y-auto'>
                <legend className='sr-only'>Terms to archive</legend>
                {eligible.map(item => (
                    <label key={item.id} className='flex items-center gap-2 text-sm'>
                        <input type='checkbox' checked={selectedIds.includes(item.id)}
                            disabled={!selectedIds.includes(item.id) && selectedIds.length >= 50}
                            onChange={event => {
                                const checked = event.target.checked
                                setSelectedIds(current => {
                                    if (!checked) return current.filter(id => id !== item.id)
                                    if (current.includes(item.id) || current.length >= 50) return current
                                    return [...current, item.id]
                                })
                            }} />
                        <span>{item.value} <span className='text-xs text-ui-muted'>({item.kind})</span></span>
                    </label>
                ))}
                {eligible.length === 0 && <p className='text-xs text-ui-muted'>No terms available to archive.</p>}
            </fieldset>
            <p className='mt-2 text-xs' aria-live='polite'>{selected.length} of 50 selected</p>
            {selected.length > 0 && <ul className='mt-2 list-inside list-disc text-xs' aria-label='Review terms to archive'>
                {selected.map(item => <li key={item.id}>{item.value} ({item.kind})</li>)}
            </ul>}
            <div className='mt-2 flex flex-wrap items-center gap-2'>
                <span className='text-sm'>Archive selected ({selected.length})</span>
                <ConfirmActionButton key={JSON.stringify(selectedIds)} ariaLabel={`Archive ${selected.length} selected watchlist terms`}
                    disabled={disabled || selected.length === 0 || selected.length > 50}
                    onConfirm={() => { onCleanup(selected.map(item => item.id)); setSelectedIds([]) }} icon={<Archive className='h-4 w-4' />} />
                <button type='button' className={secondaryButtonClass} disabled={disabled || selected.length === 0} onClick={() => setSelectedIds([])}>Clear selection</button>
            </div>
        </details>
    )
}
