import { useState } from 'react'
import { DashboardTable } from '@/components/dashboard/ui'
import Link from '@/components/organizations/workspaceLink'
import type { PortalAlert, OperationsSnapshot, CasesState } from './types'
import { caseDateLabel, caseDetailHref, relativeTimeLabel, reviewStateClass, severityClass, stateLabel } from './case-format'

export function CaseOverview({ organizationId, state, alerts, operations, isAdmin }: { organizationId?: string, state: CasesState, alerts: PortalAlert[], operations: OperationsSnapshot | null, isAdmin?: boolean }) {
    const alertsById = new Map(alerts.map(alert => [alert.id, alert]))
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState('all')
    const filteredRows = state.rows.filter(row => {
        const haystack = [row.title, row.summary, row.actor, row.victimName, row.company, row.organizationId].filter(Boolean).join(' ').toLowerCase()
        return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (status === 'all' || row.status === status)
    })
    const statuses = Array.from(new Set(state.rows.map(row => row.status).filter(Boolean))).sort()

    return (
        <div className='grid gap-4' data-dwm-cases-overview='true'>
            <DwmSourceCoverageSummary operations={operations} isAdmin={isAdmin} />
            <section className='min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
                <div className='flex flex-col gap-1 border-b border-ui-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                    <h1 className='text-lg font-semibold text-ui-text'>Cases</h1>
                    {state.status === 'ready' && <p className='text-xs font-medium text-ui-muted'>{filteredRows.length} of {state.rows.length} case{state.rows.length === 1 ? '' : 's'}</p>}
                </div>

                {state.status === 'ready' && state.rows.length > 0 && <div className='flex flex-col gap-2 border-b border-ui-border p-3 sm:flex-row'>
                    <input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search title, actor, victim, or organization' aria-label='Search cases' className='h-9 min-w-0 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none focus:border-ui-primary/50' />
                    <select value={status} onChange={event => setStatus(event.target.value)} aria-label='Filter cases by status' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'>
                        <option value='all'>All statuses</option>
                        {statuses.map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}
                    </select>
                </div>}

                {state.status === 'loading' && <div className='flex min-h-56 items-center justify-center px-4 py-16 text-sm text-ui-muted'>Loading cases…</div>}
                {state.status === 'error' && <div className='flex min-h-56 items-center justify-center px-4 py-16 text-sm text-ui-text'>{state.error || 'Cases unavailable.'}</div>}
                {state.status === 'ready' && !state.rows.length && (
                    <div className='flex min-h-56 flex-col items-center justify-center gap-1 px-4 py-16 text-center text-ui-muted' data-dwm-cases-empty='true'>
                        <p className='font-semibold text-ui-text'>No cases.</p>
                        <p className='max-w-md text-sm leading-6'>No cases yet. Matching monitoring events create cases automatically.</p>
                    </div>
                )}
                {state.status === 'ready' && state.rows.length > 0 && filteredRows.length === 0 && <div className='px-4 py-10 text-center text-sm text-ui-muted'>No cases match the current filters.</div>}
                {state.status === 'ready' && filteredRows.length > 0 && (
                    <div className='overflow-x-auto' data-dwm-cases-table='true'>
                        <DashboardTable
                            className='min-w-full border-collapse text-left text-sm'
                            headClassName='border-b border-ui-border bg-ui-raised text-xs font-semibold text-ui-muted'
                            bodyClassName='divide-y divide-ui-border'
                            columnHeaders={<>
                                <th className='px-4 py-3'>Title / actor</th>
                                <th className='px-4 py-3'>Severity / status</th>
                                <th className='px-4 py-3'>Owner</th>
                                <th className='px-4 py-3'>Updated</th>
                            </>}
                        >{filteredRows.map(row => {
                                const alert = row.alertId ? alertsById.get(row.alertId) : undefined
                                const caseId = row.caseId || row.id
                                const severity = alert?.severity || row.severity || row.priority || '—'
                                const status = row.status || '—'
                                const reviewState = alert?.reviewState || row.reviewState
                                return (
                                    <tr key={caseId} className='align-top text-ui-text' data-dwm-case-row='true'>

                                        <td className='px-4 py-3'>
                                            <Link href={caseDetailHref(caseId, row.alertId, row.organizationId || organizationId, 'case_overview')} className='font-semibold text-ui-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                                                {row.title}
                                            </Link>
                                            <p className='mt-1 wrap-break-word text-xs text-ui-muted'>{alert?.actor || row.actor || '—'}</p>
                                        </td>
                                        <td className='px-4 py-3'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className={severity === '—' ? 'text-ui-muted' : severityClass(severity)}>{stateLabel(severity)}</span>
                                                <span className='wrap-break-word text-xs text-ui-muted'>{stateLabel(status)}</span>
                                            </div>
                                        </td>
                                        <td className='px-4 py-3 text-xs text-ui-muted'>{row.assignedOwner || 'Unassigned'}</td>
                                        <td className='px-4 py-3 text-xs text-ui-muted'>
                                            <p>{caseDateLabel(row.updatedAt || alert?.firstSeenAt || row.firstSeenAt || row.createdAt)}</p>
                                            {reviewState ? <p className='mt-1'><span className={reviewStateClass(reviewState)}>{stateLabel(reviewState)}</span></p> : null}
                                        </td>
                                    </tr>
                                )
                            })}</DashboardTable>
                    </div>
                )}
            </section>
        </div>
    )
}

function DwmSourceCoverageSummary({ operations, isAdmin }: { operations: OperationsSnapshot | null, isAdmin?: boolean }) {
    const latestUsefulCapture = operations?.latestCaptures
        .filter(capture => capture.matchedWatchTerms.length > 0)
        .sort((first, second) => second.collectedAt.localeCompare(first.collectedAt))[0]
    const degradedSources = operations?.sourceHealth.filter(source => source.status !== 'active').length ?? 0
    const activeSources = operations?.counts.activeSourceCount ?? 0
    const sourceCount = operations?.counts.sourceCount ?? 0
    const latestCollection = operations?.latestRun?.updatedAt
    const unavailable = !operations

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel px-4 py-3' data-dwm-source-coverage='true'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text'>Source coverage</h2>
                    <p className='mt-0.5 text-xs text-ui-muted'>Collection status behind your monitoring.</p>
                </div>
                {isAdmin && <Link href='/ti/sources' className='text-xs font-semibold text-ui-primary underline-offset-2 hover:underline'>Open source inventory</Link>}
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-4'>
                <CoverageFact label='Active sources' value={unavailable ? 'Loading' : `${activeSources}/${sourceCount}`} />
                <CoverageFact label='Last collection' value={unavailable ? 'Loading' : latestCollection ? relativeTimeLabel(latestCollection) : 'Not recorded'} />
                <CoverageFact label='Latest useful capture' value={unavailable ? 'Loading' : latestUsefulCapture ? `${latestUsefulCapture.sourceName} · ${relativeTimeLabel(latestUsefulCapture.collectedAt)}` : 'Not recorded'} />
                <CoverageFact label='Degraded sources' value={unavailable ? 'Loading' : String(degradedSources)} tone={degradedSources ? 'warn' : 'normal'} />
            </div>
        </section>
    )
}

function CoverageFact({ label, value, tone = 'normal' }: { label: string, value: string, tone?: 'normal' | 'warn' }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase tracking-wide text-ui-muted'>{label}</p>
            <p className={`mt-1 truncate text-sm font-semibold ${tone === 'warn' ? 'text-ui-warning' : 'text-ui-text'}`}>{value}</p>
        </div>
    )
}
