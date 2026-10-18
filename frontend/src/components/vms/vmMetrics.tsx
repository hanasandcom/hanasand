import { useEffect, useState } from 'react'
import Field from './field'
import { VmPanel } from './vmPanel'
import { formatMegabytes, latestVMMetrics } from '@/utils/vms/metricPresentation'

type VMMetricsProps = {
    metrics: VMMetrics[] | null
    error?: string
}

export default function VMMetrics({ metrics, error }: VMMetricsProps) {
    const [now, setNow] = useState<number | null>(null)
    useEffect(() => {
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])
    const latest = latestVMMetrics(metrics)

    return (
        <VmPanel title='Metrics'>
            {latest ? (
                <div>
                    {(now ?? new Date(latest.created_at).getTime()) - new Date(latest.created_at).getTime() > 180_000 && <p className='mb-3 text-sm text-ui-muted'>Metrics have not updated recently.</p>}
                    <Field title='Power' value={latest.power_state} />
                    <Field title='CPU' value={`${formatNumber(latest.cpu_usage_percent)}% across ${latest.cpu_cores ?? '—'} cores`} />
                    <Field title='Memory' value={`${formatMegabytes(latest.ram_used_mb)} / ${formatMegabytes(latest.ram_total_mb)}`} />
                    <Field title='Disk' value={`${formatMegabytes(latest.disk_used_mb)} / ${formatMegabytes(latest.disk_total_mb)}`} />
                    <Field title='Network' value={`${formatNumber(latest.net_in_kbps)} kbps in · ${formatNumber(latest.net_out_kbps)} kbps out`} />
                    <Field title='Uptime' value={formatDuration(latest.uptime_seconds)} />
                    <p className='mt-3 text-sm text-ui-muted'>
                        Last updated <time dateTime={latest.created_at} title={new Date(latest.created_at).toLocaleString()}>{now === null ? new Date(latest.created_at).toLocaleString() : `${Math.max(0, Math.floor((now - new Date(latest.created_at).getTime()) / 1000))}s ago`}</time>
                        <span className='block'>{new Date(latest.created_at).toLocaleString()}</span>
                    </p>
                </div>
            ) : (
                <p className='text-sm text-ui-muted'>{error || 'Metrics are unavailable.'}</p>
            )}
        </VmPanel>
    )
}

function formatNumber(value: number | string | null) {
    const numeric = value === null ? NaN : Number(value)
    return Number.isFinite(numeric) ? numeric.toFixed(numeric >= 10 ? 1 : 2) : '—'
}

function formatDuration(raw: number | string | null) {
    const seconds = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(seconds)) return '—'
    if (seconds <= 0) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours) return `${hours}h ${minutes}m`
    return `${minutes}m`
}
