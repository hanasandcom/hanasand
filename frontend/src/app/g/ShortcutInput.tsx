import type { ChangeEventHandler } from 'react'

type Props = {
    value: string
    onChange: ChangeEventHandler<HTMLInputElement>
    error?: string | null
    required?: boolean
}

export function ShortcutInput({ value, onChange, error, required = false }: Props) {
    return (
        <label className='grid gap-2'>
            <span className='text-xs font-semibold uppercase text-ui-primary'>Shortcut</span>
            <div className='flex h-11 overflow-hidden rounded-lg border border-ui-border bg-ui-raised focus-within:border-ui-primary focus-within:ring-4 focus-within:ring-ui-primary/15'>
                <span className='flex items-center border-r border-ui-border bg-ui-panel px-3 text-sm text-ui-muted'>/g/</span>
                <input className='min-w-0 flex-1 bg-transparent px-3 text-sm text-ui-text outline-none placeholder:text-ui-muted' placeholder='team-notes' onChange={onChange} value={value} required={required} />
            </div>
            {error ? <span className='text-xs text-ui-warning'>{error}</span> : null}
        </label>
    )
}
