import Link from '@/components/organizations/workspaceLink'
import { DashboardTable } from 'hanasand/dashboard'
import { CheckFields } from './case-events'
import { CaseDevelopment } from './case-development'
import type { MonitoringCase } from './monitoringCaseTypes'
import { date, formatDirectorySize } from './monitoringCaseText'
import { requiresHumanReview } from './caseResolution'

const control = 'rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-50'

export function MonitoringCaseOverview({ item, caseId, organizationId, resolving, comment, setComment, aiAssisted, setAiAssisted, busy, setResolving, save }: {
    item: MonitoringCase
    caseId: string
    organizationId?: string
    resolving: boolean
    comment: string
    setComment: (value: string) => void
    aiAssisted: boolean
    setAiAssisted: (value: boolean) => void
    busy: boolean
    setResolving: (value: boolean) => void
    save: (change: Record<string, unknown>) => void
}) {
    return <>
        {resolving && <form className='grid gap-3 border-b border-ui-border p-5' onSubmit={event => {
            event.preventDefault()
            if (comment.trim()) save({ status: 'resolved', comment, ...(aiAssisted ? { resolutionMethod: 'ai' } : {}) })
        }}>
            <label htmlFor='resolution-comment' className='font-medium'>Resolution comment (required)</label>
            <textarea id='resolution-comment' className={`${control} min-h-24`} required maxLength={5000} value={comment} onChange={event => setComment(event.target.value)} placeholder='What was fixed, and how did you verify it?' />
            <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={aiAssisted} onChange={event => setAiAssisted(event.target.checked)} />Resolved by AI — requires human confirmation</label>
            <div className='flex gap-2'>
                <button className={control} disabled={busy || item.canManage === false || !comment.trim()}>Resolve with comment</button>
                <button type='button' className={control} disabled={busy || item.canManage === false} onClick={() => setResolving(false)}>Cancel</button>
            </div>
        </form>}
        {item.resolution && <section className='grid gap-2 border-b border-ui-border p-5' aria-label='Resolution review'>
            <h2 className='font-semibold'>{item.resolution.type === 'ai' ? 'Resolved by AI' : item.resolution.type === 'automation' ? 'Recovered automatically' : item.resolution.type === 'unknown' ? 'Resolver not recorded' : 'Resolved by a person'}</h2>
            <p className='text-sm'>{item.resolution.actor || 'Identity unavailable'} · {date(item.resolution.at)}</p>
            {item.resolution.type === 'automation' && item.resolvedAt && (item.relatedChecks?.length || 0) > 1 ? <div className='grid gap-3'>
                <p className='text-sm text-ui-muted'>Results when the affected checks recovered.</p>
                <dl className='grid gap-3'>{item.relatedChecks!.map(check => <div key={check.id}>
                    <dt className='text-sm font-medium'>{check.name}</dt>
                    <dd className='mt-1 whitespace-pre-wrap text-sm'>{check.message}</dd>
                </div>)}</dl>
            </div> : <p className='whitespace-pre-wrap text-sm'>{item.resolution.note}</p>}
            {item.resolution.confirmedAt ? <p className='text-sm text-ui-success'>Confirmed by {item.resolution.confirmedBy} · {date(item.resolution.confirmedAt)}</p> : requiresHumanReview(item.resolution) && <p className='text-sm text-ui-muted'>Awaiting human confirmation.</p>}
        </section>}
        <section aria-labelledby='case-summary' className='min-w-0 grid gap-3 border-b border-ui-border p-5 sm:p-6'>
            <h2 id='case-summary' className='text-lg font-semibold'>Summary</h2>
            <p className='whitespace-pre-wrap [overflow-wrap:anywhere] leading-7'>{item.summary}</p>
            {(item.relatedChecks?.length || 0) > 1 && <p className='text-sm text-ui-muted'>Affected checks: {item.relatedChecks!.map(check => check.name).join(', ')}.</p>}
        </section>
        <section aria-labelledby='case-technical' className='grid gap-4 border-b border-ui-border p-5 sm:p-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <h2 id='case-technical' className='text-lg font-semibold'>Technical details</h2>
                <Link className='text-sm text-ui-primary underline' href={`/automation/health?monitor=${encodeURIComponent(item.automationId)}`}>View health check</Link>
            </div>
            {item.events?.[0]?.details ? <><p className='text-sm text-ui-muted'>Configuration captured for the latest occurrence.</p><CheckFields details={item.events[0].details} /></> : item.currentCheck && <><p className='text-sm text-ui-muted'>Current check configuration. Older runs did not capture their configuration.</p><CheckFields details={item.currentCheck} /></>}
            {item.events?.[0] && <div className='grid gap-2'>
                <h3 className='font-medium'>Latest recorded result</h3>
                <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{item.events[0].message}</p>
                <p className='text-sm text-ui-muted'>Duration: {item.events[0].durationMs == null ? 'Not recorded' : `${item.events[0].durationMs.toLocaleString()} ms`}</p>
            </div>}
            <dl className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>{[
                ['First seen', date(item.createdAt)],
                ['Last seen', date(item.lastSeenAt || item.updatedAt)],
                ['Recovered', item.resolvedAt ? date(item.resolvedAt) : 'Not recovered'],
                ['Occurrences', item.occurrences.toLocaleString()],
            ].map(([label, value]) => <div key={label} className='min-w-0 rounded-lg bg-ui-canvas p-4'>
                <dt className='text-sm text-ui-muted'>{label}</dt>
                <dd className='mt-2 wrap-break-word text-sm font-medium'>{value}</dd>
            </div>)}</dl>
            <p className='text-sm text-ui-muted'>Health checks update recovery automatically. A manual case status stays in effect until you change it; closing a case does not mark the health check as recovered.</p>
            {item.diskDiagnostics && <DiskDiagnostics diagnostics={item.diskDiagnostics} />}
        </section>
        <CaseDevelopment caseId={caseId} organizationId={item.organizationId || organizationId} />
    </>
}

function DiskDiagnostics({ diagnostics }: { diagnostics: NonNullable<MonitoringCase['diskDiagnostics']> }) {
    return <section aria-label='Disk usage diagnostics' className='grid gap-4 rounded-lg border border-ui-border bg-ui-canvas p-4'>
        <h3 className='font-semibold'>Largest directories</h3>
        <p className='text-xs text-ui-muted'>{diagnostics.host} · Collected {date(diagnostics.sampledAt)}. Directory sizes include their contents; nested rows overlap.</p>
        {diagnostics.filesystems.map(filesystem => <div key={filesystem.path} className='grid gap-2'>
            <h4 className='text-sm font-medium'>{filesystem.path} · {filesystem.usedPercent}% used</h4>
            {!filesystem.complete && <p className='text-sm text-ui-warning'>Partial scan. Some directories could not be measured before the time limit or were inaccessible.</p>}
            <div className='overflow-x-auto'><DashboardTable
                className='w-full text-left text-sm'
                headClassName='border-b border-ui-border text-ui-muted'
                bodyClassName={null}
                columnHeaders={<><th className='py-2 pr-4'>Directory</th><th className='py-2 text-right'>Size</th></>}
            >{filesystem.directories.map(directory => <tr key={directory.path} className='border-b border-ui-border/50'>
                    <td className='break-all py-2 pr-4 font-mono'>{directory.path}</td>
                    <td className='whitespace-nowrap py-2 text-right tabular-nums' title={`${directory.sizeBytes.toLocaleString()} bytes`}>{formatDirectorySize(directory.sizeBytes)}</td>
                </tr>)}</DashboardTable></div>
        </div>)}
    </section>
}
