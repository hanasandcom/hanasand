import { DashboardPanel } from '@/components/dashboard/ui'

type TrafficPageStateProps = {
    kind: 'loading' | 'unavailable'
    message: string
    panelClassName?: string
}

export function TrafficPageState({ kind, message, panelClassName = 'p-4' }: TrafficPageStateProps) {
    return <DashboardPanel className={panelClassName}><p role={kind === 'loading' ? 'status' : 'alert'}>{message}</p></DashboardPanel>
}
