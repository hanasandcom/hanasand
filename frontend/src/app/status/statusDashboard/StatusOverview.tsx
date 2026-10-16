import Link from 'next/link'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { statusHeadline } from '@/utils/status/incidentCopy'
import type { ServiceStatus } from '@/utils/status/getStatus'
import ServiceCheckRow from './ServiceCheckRow'
import { formatDateTime, UPTIME_WINDOW } from './statusFormatting'

export default function StatusOverview({ status, monitoringUnavailable, now }: { status: ServiceStatus, monitoringUnavailable: boolean, now: number | null }) {
    const tone = status.overall === 'up' ? 'border-ui-success' : status.overall === 'degraded' ? 'border-ui-warning' : status.overall === 'unknown' ? 'border-ui-border' : 'border-ui-danger'
    return <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
        <section className={`rounded-md border-l-2 bg-ui-raised px-5 py-4 text-ui-text ${tone}`}>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                    {status.overall === 'up' ? <CheckCircle className='h-5 w-5' /> : <AlertCircle className='h-5 w-5' />}
                    <h1 className='text-lg font-medium'>{statusHeadline(status)}</h1>
                </div>
                <div className='flex flex-wrap items-center gap-3'>
                    <Link href='/status/incidents' className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-canvas px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel'>Incident history</Link>
                    <span className='text-sm font-medium'>{monitoringUnavailable ? 'Showing last verified results' : 'Live monitoring'}</span>
                </div>
            </div>
        </section>
        <p className='text-sm text-ui-muted'>{status.last_verified_at ? <>Last verified <time dateTime={status.last_verified_at}>{formatDateTime(status.last_verified_at)}</time>{monitoringUnavailable ? ' · showing the last received results' : ''}</> : 'No verified snapshot is available yet.'}</p>
        <section>
            <div className='flex flex-wrap items-end justify-between gap-2'>
                <h2 className='text-xl font-medium text-ui-text'>Current Status: Hanasand.com</h2>
                <p className='text-sm text-ui-muted'>Uptime over the past {UPTIME_WINDOW}.</p>
            </div>
            <div className='mt-4 divide-y divide-ui-border overflow-hidden rounded-md border border-ui-border bg-ui-panel'>
                {status.checks.map(check => <ServiceCheckRow key={`${check.service}-${check.check_name}`} status={status} check={check} now={now} />)}
                {!status.checks.length && <div className='p-6 text-sm text-ui-muted'>No current public monitor checks are available.</div>}
            </div>
        </section>
    </main>
}
