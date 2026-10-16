import Link from 'next/link'
import { AlertCircle, CheckCircle } from 'lucide-react'
import type { ServiceStatus } from '@/utils/status/getStatus'
import { barClass, formatUptime, relativeTime, statusPillClass, UPTIME_WINDOW } from './statusFormatting'
import { historyDaysFor } from './statusHistory'

type Check = ServiceStatus['checks'][number]

export default function ServiceCheckRow({ status, check, now }: { status: ServiceStatus, check: Check, now: number | null }) {
    return <div className='grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
        <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
                <h3 className='font-semibold text-ui-text'>{check.check_name}</h3>
                <span className='text-sm text-ui-muted'>{check.service}</span>
            </div>
            <div className='mt-3 flex h-8 items-stretch gap-0.5' aria-label={`${check.check_name} ${formatUptime(check.uptime_30d)} uptime`}>
                {historyDaysFor(status, check).map(day => day.incident ? (
                    <Link key={day.date} href={`/status/incidents/${day.incident.id}`} title={day.description} style={day.style} className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.displayStatus)}`} />
                ) : (
                    <span key={day.date} title={day.description} style={day.style} className={`min-w-0 flex-1 rounded-[1px] ${barClass(day.displayStatus)}`} />
                ))}
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ui-muted'>
                <span>{UPTIME_WINDOW} ago</span><span>{formatUptime(check.uptime_30d)} uptime</span><span>Today</span>
                <span>Last check {relativeTime(check.checked_at, now)}</span><span>{check.latency_ms}ms</span>
            </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${statusPillClass(check.status)}`}>
            {check.status === 'up' ? <CheckCircle className='h-4 w-4' /> : <AlertCircle className='h-4 w-4' />}
            {check.status === 'unknown' ? 'Unverified' : check.status === 'up' ? 'Normal' : check.status}
        </span>
    </div>
}
