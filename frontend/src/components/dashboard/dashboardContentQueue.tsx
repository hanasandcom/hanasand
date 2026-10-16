import type { ReactNode } from 'react'
import { DashboardPanel } from './ui'

export function DashboardContentQueue({ title, description, count, children }: {
    title: string
    description: string
    count: number
    children: ReactNode
}) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>{title}</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{description}</p>
                </div>
                <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-on-primary'>
                    {count} rows
                </span>
            </div>
            <div className='grid gap-1 p-3'>{children}</div>
        </DashboardPanel>
    )
}
