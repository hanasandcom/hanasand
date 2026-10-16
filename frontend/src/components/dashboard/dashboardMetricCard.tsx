import type { ReactNode } from 'react'
import { DashboardPanel } from './ui'

type Props = {
    icon: ReactNode
    label: string
    value: string
    detail?: string
    tone: 'ok' | 'watch' | 'neutral'
}

export default function DashboardMetricCard({ icon, label, value, detail, tone }: Props) {
    const dot = tone === 'ok'
        ? 'bg-ui-success ui-glow-success'
        : tone === 'watch'
            ? 'bg-ui-warning ui-glow-warning'
            : 'bg-ui-primary ui-glow-primary'
    const text = tone === 'ok' ? 'text-ui-success' : tone === 'watch' ? 'text-ui-warning' : 'text-ui-primary'

    return <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3 text-sm text-ui-muted'>
            <span>{label}</span>
            <span className={text}>{icon}</span>
        </div>
        <div className='mt-3 flex items-center gap-2 text-2xl font-semibold text-ui-text'>
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            {value}
        </div>
        {detail ? <p className='mt-2 line-clamp-2 text-sm leading-5 text-ui-muted'>{detail}</p> : null}
    </DashboardPanel>
}
