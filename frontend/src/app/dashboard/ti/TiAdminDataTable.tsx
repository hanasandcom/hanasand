import type { ReactNode } from 'react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { PanelTitle } from './dashboardPresentation'

export function TiAdminDataTable({ title, actionHref, actionLabel, columns, children }: {
    title: string
    actionHref: string
    actionLabel: string
    columns: string[]
    children: ReactNode
}) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <PanelTitle title={title} actionHref={actionHref} actionLabel={actionLabel} />
            <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-ui-border text-sm'>
                    <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                        <tr>{columns.map(column => <th key={column} className='px-4 py-3'>{column}</th>)}</tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border bg-ui-panel'>{children}</tbody>
                </table>
            </div>
        </DashboardPanel>
    )
}
