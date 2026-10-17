import type { ReactNode } from 'react'
import { DashboardTablePanel } from '@/components/dashboard/ui'
import { PanelTitle } from './dashboardPresentation'

export function TiAdminDataTable({ title, actionHref, actionLabel, columns, children }: {
    title: string
    actionHref: string
    actionLabel: string
    columns: string[]
    children: ReactNode
}) {
    return <DashboardTablePanel
        header={<PanelTitle title={title} actionHref={actionHref} actionLabel={actionLabel} />}
        columnHeaders={columns.map(column => <th key={column} className='px-4 py-3'>{column}</th>)}
    >{children}</DashboardTablePanel>
}
