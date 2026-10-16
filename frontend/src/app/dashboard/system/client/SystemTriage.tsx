import { DashboardPanel } from '@/components/dashboard/ui'

export function SystemTriage({ runningContainers, containerCount, runningVms, href, title, detail, actionLabel }: {
    runningContainers: number
    containerCount: number
    runningVms: number
    href: string
    title: string
    detail: string
    actionLabel: string
}) {
    return <DashboardPanel className='grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center' data-system-primary-triage>
        <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>Recommended next</span>
                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{runningContainers}/{containerCount || 0} containers running</span>
                <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{runningVms} VMs running</span>
            </div>
            <h2 className='mt-3 text-lg font-semibold text-ui-text'>{title}</h2>
            <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{detail}</p>
        </div>
        <a href={href} className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 sm:w-auto' data-system-primary-action>{actionLabel}</a>
    </DashboardPanel>
}
