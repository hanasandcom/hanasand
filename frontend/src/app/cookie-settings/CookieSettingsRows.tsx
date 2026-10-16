import { Database } from 'lucide-react'
import type { ReactNode } from 'react'
import { friendlyKey } from './storageSnapshot'

export function ConsentButton({
    active,
    onClick,
    icon,
    title,
    detail,
}: {
    active: boolean
    onClick: () => void
    icon: ReactNode
    title: string
    detail: string
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-lg border p-3 text-left transition ${
                active
                    ? 'border-ui-primary bg-ui-primary text-ui-on-primary shadow-sm'
                    : 'border-ui-border bg-ui-panel text-ui-muted hover:border-ui-primary hover:bg-ui-raised'
            }`}
        >
            <span className='flex items-center gap-2 text-sm font-semibold'>{icon}{title}</span>
            <span className={`mt-1 block text-xs ${active ? 'text-ui-canvas/85' : 'text-ui-muted'}`}>
                {detail}
            </span>
        </button>
    )
}

export function StatusRow({ label, present }: { label: string, present: boolean }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm'>
            <span className='font-medium text-ui-text'>{label}</span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${present ? 'border-ui-success text-ui-success' : 'border-ui-border text-ui-muted'}`}>
                {present ? 'Present' : 'Not set'}
            </span>
        </div>
    )
}

export function TokenList({ title, keys }: { title: string, keys: string[] }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
            <div className='flex items-center justify-between gap-3'>
                <h3 className='text-sm font-semibold text-ui-text'>{title}</h3>
                <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text'>
                    <Database className='h-3.5 w-3.5' />
                    {keys.length}
                </span>
            </div>
            <div className='mt-3 flex flex-wrap gap-2'>
                {keys.length ? keys.map((key) => (
                    <span key={key} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-medium text-ui-muted'>
                        {friendlyKey(key)}
                    </span>
                )) : (
                    <span className='text-sm text-ui-muted'>Nothing product-local stored here.</span>
                )}
            </div>
        </div>
    )
}
