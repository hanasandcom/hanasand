import type { ReactNode } from 'react'
import { DashboardPanel } from './ui'

type Props = {
    icon: ReactNode
    title: string
    description?: string
    action: ReactNode
}

export function DashboardPublishingEmptyState({ icon, title, description, action }: Props) {
    return <DashboardPanel className='grid min-h-80 place-items-center border-ui-border bg-ui-panel p-8 text-center'>
        <div className='max-w-md'>
            <div className='mx-auto grid h-12 w-12 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'>{icon}</div>
            <h2 className='mt-4 text-xl font-semibold text-ui-text'>{title}</h2>
            {description ? <p className='mt-2 text-sm leading-6 text-ui-muted'>{description}</p> : null}
            {action}
        </div>
    </DashboardPanel>
}
