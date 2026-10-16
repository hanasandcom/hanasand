import type { ReactNode } from 'react'

export function TestEmptyState({ icon, title, body }: { icon: ReactNode, title: string, body: string }) {
    return (
        <div className='grid min-h-32 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-center'>
            <div>
                <div className='mx-auto grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-primary'>
                    {icon}
                </div>
                <h2 className='mt-3 text-sm font-semibold text-ui-text'>{title}</h2>
                <p className='mt-1 max-w-md text-sm leading-6 text-ui-muted'>{body}</p>
            </div>
        </div>
    )
}
