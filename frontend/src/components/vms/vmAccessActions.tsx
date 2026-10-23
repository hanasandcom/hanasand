'use client'

import { Menu } from 'lucide-react'
import VMConnectLocally from './vmConnectLocally'
import VMSudoPassword from './vmSudoPassword'

type VMAccessActionsProps = { vmName: string; className?: string }

export default function VMAccessActions({ vmName, className }: VMAccessActionsProps) {
    return <div className={className || 'flex items-center gap-2'}>
        <div className='hidden items-center gap-2 lg:flex'>
            <VMConnectLocally vmName={vmName} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-text transition hover:bg-ui-raised' />
            <VMSudoPassword vmName={vmName} compact triggerClassName='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-primary transition hover:bg-ui-raised' />
        </div>
        <details className='relative lg:hidden'>
            <summary aria-label='VM access actions' title='VM access actions' className='flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-text [&::-webkit-details-marker]:hidden'>
                <Menu aria-hidden='true' className='h-4 w-4' />
            </summary>
            <div className='fixed right-4 top-16 z-50 grid min-w-52 max-w-[calc(100vw_-_2rem)] gap-2 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-lg'>
                <VMConnectLocally vmName={vmName} className='flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-text hover:bg-ui-raised' />
                <VMSudoPassword vmName={vmName} compact triggerClassName='flex h-9 w-full items-center justify-start gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-primary hover:bg-ui-raised' />
            </div>
        </details>
    </div>
}
