import { Activity, FileText } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CSSProperties, ReactNode } from 'react'
import { TestEmptyState } from './testEmptyState'

export type TestMetrics = {
    requests?: number
    failureRate?: number
    duration?: { p95?: number }
    rps?: Array<{ time: string | number, value: number }>
    latency?: Array<{ time: string | number, p50?: number, p95?: number }>
    errors?: Array<{ time: string | number, count: number }>
}

export default function TestMetricCharts({ metrics, isDone }: { metrics: TestMetrics, isDone: boolean }) {
    const duration = metrics.duration || {}
    const hasMetrics = Boolean(metrics.requests || duration.p95 || typeof metrics.failureRate === 'number')
    const hasCharts = Boolean(metrics.rps?.length || metrics.latency?.length || metrics.errors?.length)

    return (
        <>
            {hasMetrics ? (
                <div className='grid gap-2 sm:grid-cols-3'>
                    <MetricCard label='Requests' value={metrics.requests ?? '0'} emphasis />
                    <MetricCard label='p95 latency' value={typeof duration.p95 === 'number' ? `${Math.round(duration.p95)}ms` : 'metering'} />
                    <MetricCard
                        label='Failure rate'
                        value={typeof metrics.failureRate === 'number' ? `${(metrics.failureRate * 100).toFixed(1)}%` : 'metering'}
                        tone={typeof metrics.failureRate === 'number' && metrics.failureRate > 0 ? 'danger' : 'success'}
                    />
                </div>
            ) : (
                <TestEmptyState
                    icon={<Activity className='h-5 w-5' />}
                    title={isDone ? 'Aggregate metrics are collecting' : 'Metrics update as the run progresses'}
                    body={isDone ? 'The run finished without a summary payload. Logs and errors below may still contain useful evidence.' : 'Keep this page open for live updates from the runner.'}
                />
            )}

            {hasCharts ? (
                <div className='grid min-w-0 gap-3 xl:grid-cols-2'>
                    {metrics.rps?.length ? (
                        <ChartPanel title='Requests per second'>
                            <ResponsiveContainer width='100%' height={220}>
                                <LineChart data={metrics.rps} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                    <CartesianGrid stroke='var(--ui-border)' strokeDasharray='3 3' />
                                    <XAxis dataKey='time' stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <YAxis stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Line type='monotone' dataKey='value' stroke='var(--ui-success)' strokeWidth={2.5} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    ) : null}

                    {metrics.latency?.length ? (
                        <ChartPanel title='Latency'>
                            <ResponsiveContainer width='100%' height={220}>
                                <LineChart data={metrics.latency} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                    <CartesianGrid stroke='var(--ui-border)' strokeDasharray='3 3' />
                                    <XAxis dataKey='time' stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <YAxis stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Line type='monotone' dataKey='p50' stroke='var(--ui-primary)' strokeWidth={2} dot={false} />
                                    <Line type='monotone' dataKey='p95' stroke='var(--ui-warning)' strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    ) : null}

                    {metrics.errors?.length ? (
                        <ChartPanel title='Errors over time'>
                            <ResponsiveContainer width='100%' height={180}>
                                <BarChart data={metrics.errors} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
                                    <CartesianGrid stroke='var(--ui-border)' strokeDasharray='3 3' />
                                    <XAxis dataKey='time' stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <YAxis stroke='var(--ui-muted)' tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey='count' fill='var(--ui-primary)' radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartPanel>
                    ) : null}
                </div>
            ) : (
                <TestEmptyState
                    icon={<FileText className='h-5 w-5' />}
                    title={isDone ? 'No chart data' : 'Chart data is collecting'}
                    body={isDone ? 'No request samples were recorded during this run.' : 'Charts update as the runner sends request, latency, or error samples.'}
                />
            )}
        </>
    )
}

const tooltipStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px solid var(--ui-border)',
    background: 'var(--ui-panel)',
    color: 'var(--ui-text)',
    fontSize: 12,
}

function MetricCard({ label, value, tone = 'default', emphasis = false }: { label: string, value: string | number, tone?: 'default' | 'success' | 'danger', emphasis?: boolean }) {
    const toneClass = tone === 'success'
        ? 'border-ui-success bg-ui-success/15 text-ui-success'
        : tone === 'danger'
            ? 'border-ui-danger bg-ui-raised/15 text-ui-text'
            : 'border-ui-border bg-ui-raised text-ui-text'

    return (
        <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
            <div className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</div>
            <div className={`mt-1 font-semibold ${emphasis ? 'text-2xl' : 'text-xl'}`}>{value}</div>
        </div>
    )
}

function ChartPanel({ title, children }: { title: string, children: ReactNode }) {
    return (
        <section className='min-w-0 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <h2 className='mb-2 text-sm font-semibold text-ui-text'>{title}</h2>
            {children}
        </section>
    )
}
