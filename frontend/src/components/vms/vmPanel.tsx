import type { ReactNode } from 'react'

export function VmPanel({ title, children }: { title: string, children: ReactNode }) {
    return <div className='w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
        <h1 className='text-base font-medium text-ui-text'>{title}</h1>
        {children}
    </div>
}
