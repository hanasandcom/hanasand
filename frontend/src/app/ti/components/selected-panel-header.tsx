import type { ReactNode } from 'react'

export default function SelectedPanelHeader({ title, children }: { title: ReactNode; children: ReactNode }) {
    return (
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs'>
            <p className='min-w-0 wrap-break-word font-semibold text-ui-muted dark:text-ui-muted'>{title}</p>
            <div className='flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'>{children}</div>
        </div>
    )
}
