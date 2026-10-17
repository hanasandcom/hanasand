'use client'

import formatRequestTime from '@/utils/monitoring/formatRequestTime'

import { Activity, Clock, AlertTriangle } from 'lucide-react'
import RequestsOverTimeChart from './requestsOverTimeChart'
import CombinedMetrics from './combinedMetrics'
import MetricBars from './metricBars'
import type { TrafficMetric, TrafficMetrics, TrafficSlowMetric } from '@/utils/monitoring/types'

export { RecentTrafficTable } from './recentTrafficTable'

type TrafficDashboardProps = {
    metrics?: TrafficMetrics | string
    selectedDomain?: string
}

type StatCardProps = {
    title: string
    value: string | number
    accent: 'primary' | 'blood-red'
    outline?: string
    icon: React.ReactNode
}

export default function TrafficDashboard({ metrics, selectedDomain }: TrafficDashboardProps) {
    const m = typeof metrics === 'object' && metrics !== null ? (metrics as TrafficMetrics) : undefined

    const totalRequests = Number(m?.total_requests) || 0
    const errorRate = Number.isFinite(Number(m?.error_rate)) ? (Number(m!.error_rate) * 100).toFixed(1) : null

    const methods = (m?.top_methods ?? [])
    const statuses = (m?.top_status_codes ?? [])
    const domains = (m?.top_domains ?? [])
    const os = (m?.top_os ?? [])
    const browsers = (m?.top_browsers ?? [])
    const requestsOverTime = (m?.requests_over_time ?? [])
    const topErrorPaths = (m?.top_error_paths ?? [])
    const topSlowPaths = (m?.top_slow_paths ?? [])
    const topPaths = (m?.top_paths ?? [])

    const allMetrics = [
        { title: 'Methods', data: methods },
        { title: 'Status Codes', data: statuses },
        ...(selectedDomain
            ? [{ title: 'Requests Over Time', data: requestsOverTime, isChart: true }]
            : [{ title: 'Domains', data: domains }]
        ),
        { title: 'Top Slow Paths (ms)', data: topSlowPaths },
        { title: ['Operating Systems', 'Browsers'], data: [os, browsers] },
        { title: ['Top Paths', 'Top Error Paths'], data: [topPaths, topErrorPaths] }
    ]

    return (
        <div className='min-w-0 space-y-6'>
            {m && (
                <>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        {([
                            {
                                title: 'Total Requests',
                                value: totalRequests,
                                accent: 'blood-red',
                                outline: 'outline outline-ui-warning/20',
                                icon: <Activity className='w-5 h-5 stroke-ui-warning' />
                            },
                            {
                                title: 'Avg Request Time',
                                value: formatRequestTime(m),
                                accent: 'primary',
                                outline: 'outline outline-ui-primary/25',
                                icon: <Clock className='w-5 h-5 stroke-ui-primary' />
                            },
                            {
                                title: 'Error Rate',
                                value: errorRate ? `${errorRate}%` : 'clear',
                                accent: 'blood-red',
                                outline: 'outline outline-ui-warning/25',
                                icon: <AlertTriangle className='w-5 h-5 stroke-ui-warning' />
                            },
                        ] as StatCardProps[]).map(({ title, value, icon, accent, outline }) =>
                            <StatCard
                                key={title}
                                title={title}
                                value={value}
                                outline={outline}
                                accent={accent}
                                icon={icon}
                            />
                        )}
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {allMetrics.map(({ title, data, isChart }) => {
                            if (Array.isArray(data[0])) {
                                return (
                                    <CombinedMetrics
                                        key={Array.isArray(title) ? title.join(' ') : title}
                                        title={title as string[]}
                                        data={data as Array<Array<TrafficMetric | TrafficSlowMetric>>}
                                        total={totalRequests}
                                    />
                                )
                            }
                            if (isChart) {
                                return (
                                    <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' key={title as string}>
                                        <h3 className='mb-4 text-lg font-semibold text-ui-text'>{title as string}</h3>
                                        <RequestsOverTimeChart data={data as TrafficMetric[]} />
                                    </div>
                                )
                            }
                            const set = data as Array<TrafficMetric | TrafficSlowMetric>
                            return (
                                <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' key={title as string}>
                                    <h3 className='mb-4 text-lg font-semibold text-ui-text'>{title as string}</h3>
                                    <MetricBars entries={set} total={totalRequests} />
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

        </div>
    )
}

function StatCard({ title, value, accent, icon, outline }: StatCardProps) {
    const accentMap = {
        primary: 'from-ui-primary/15 to-ui-primary/5 border-ui-primary/25 text-ui-primary',
        'blood-red': 'from-ui-warning/15 to-ui-warning/5 border-ui-warning/25 text-ui-warning',
    } as const

    return (
        <div className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
            <div>
                <p className='text-sm text-ui-muted'>{title}</p>
                <p className='mt-1 text-2xl font-bold text-ui-text'>{value}</p>
            </div>
            <div className={`p-2 bg-linear-to-br ${accentMap[accent]} rounded-full ${outline}`}>
                {icon}
            </div>
        </div>
    )
}
