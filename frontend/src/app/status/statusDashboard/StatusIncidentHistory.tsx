import Link from 'next/link'
import IncidentReport from '../incidentReport'
import type { ServiceIncident } from '@/utils/status/getStatus'
import { formatDateTime, INCIDENT_WINDOW } from './statusFormatting'

type Props = { mode: 'incident' | 'incidents', incidents: ServiceIncident[], incidentId?: string }

export default function StatusIncidentHistory({ mode, incidents, incidentId }: Props) {
    const incident = incidentId ? incidents.find(item => item.id === incidentId || item.aliases?.includes(incidentId)) : null
    if (mode === 'incident') return <IncidentDetail incident={incident || null} />
    return <IncidentList incidents={incidents} />
}

function IncidentDetail({ incident }: { incident: ServiceIncident | null }) {
    return <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
        <Link href='/status/incidents' className='text-sm font-semibold text-ui-primary'>Incident history</Link>
        {incident ? <IncidentReport key={incident.id} incident={incident} /> : (
            <section className='rounded-md border border-ui-border bg-ui-panel p-5'>
                <h1 className='text-2xl font-semibold text-ui-text'>Incident not found</h1>
                <p className='mt-2 text-sm text-ui-muted'>This incident is not available in the current {INCIDENT_WINDOW} status history.</p>
            </section>
        )}
    </main>
}

function IncidentList({ incidents }: { incidents: ServiceIncident[] }) {
    return <main className='mx-auto grid max-w-5xl gap-6 pb-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
                <p className='text-sm font-semibold uppercase text-ui-primary'>Status</p>
                <h1 className='mt-1 text-3xl font-semibold text-ui-text'>Incident history</h1>
            </div>
            <Link href='/status' className='inline-flex h-10 items-center rounded-md border border-ui-border px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>Current status</Link>
        </div>
        <section className='rounded-md border border-ui-border bg-ui-panel p-4'>
            <h2 className='text-xl font-semibold text-ui-text'>Recent incidents</h2>
            <div className='mt-3 divide-y divide-ui-border'>
                {incidents.length ? incidents.map(incident => <IncidentRow key={incident.id} incident={incident} />) : (
                    <p className='py-3 text-sm text-ui-muted'>No incidents reported in the current status data.</p>
                )}
            </div>
        </section>
    </main>
}

function IncidentRow({ incident }: { incident: ServiceIncident }) {
    return <Link href={`/status/incidents/${incident.id}`} className='block py-3 first:pt-0 last:pb-0'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
            <h3 className='font-semibold text-ui-text'>{incident.title}</h3>
            <span className='flex flex-wrap gap-2'>
                <IncidentTag label={incident.impact} tone='warn' />
                <IncidentTag label={incident.status === 'resolved' ? 'Resolved' : 'Investigating'} tone={incident.status === 'resolved' ? 'ok' : 'warn'} />
            </span>
        </div>
        <p className='mt-1 text-sm text-ui-muted'>{incident.summary}</p>
        <p className='mt-1 text-sm text-ui-muted'>{formatDateTime(incident.started_at)}{incident.resolved_at ? ` - ${formatDateTime(incident.resolved_at)}` : ''}</p>
    </Link>
}

function IncidentTag({ label, tone }: { label: string, tone: 'ok' | 'warn' }) {
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${tone === 'ok' ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-warning/10 text-ui-warning'}`}>{label}</span>
}
