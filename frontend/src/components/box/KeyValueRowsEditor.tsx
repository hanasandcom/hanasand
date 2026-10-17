import { Plus, Trash2 } from 'lucide-react'

export type KeyValueRow = { key: string; value: string }

type KeyValueRowsEditorProps = {
    rows: KeyValueRow[]
    keyPlaceholder: string
    valuePlaceholder: string
    addLabel: string
    itemLabel: string
    onChange: (index: number, field: 'key' | 'value', value: string) => void
    onDelete: (index: number) => void
    onAdd: () => void
}

export default function KeyValueRowsEditor({ rows, keyPlaceholder, valuePlaceholder, addLabel, itemLabel, onChange, onDelete, onAdd }: KeyValueRowsEditorProps) {
    return <div className='grid min-h-0 content-start gap-2'>
        {rows.map((row, index) => <div key={index} className='grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_36px]'>
            <input value={row.key} onChange={(event) => onChange(index, 'key', event.target.value)} placeholder={keyPlaceholder} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel/[0.025] px-3 py-2 text-sm outline-none' />
            <input value={row.value} onChange={(event) => onChange(index, 'value', event.target.value)} placeholder={valuePlaceholder} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel/[0.025] px-3 py-2 text-sm outline-none' />
            <button type='button' onClick={() => onDelete(index)} className='grid cursor-pointer place-items-center rounded-lg text-ui-text/70 hover:bg-ui-raised/10 hover:text-ui-text' aria-label={`Remove ${itemLabel}`}><Trash2 className='h-4 w-4' /></button>
        </div>)}
        <button type='button' onClick={onAdd} className='flex w-fit cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-ui-text/60 hover:bg-ui-panel/8 hover:text-ui-text/80'><Plus className='h-3.5 w-3.5' />{' '}{addLabel}</button>
    </div>
}
