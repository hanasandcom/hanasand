import { DashboardPanel, DashboardTable } from '@/components/dashboard/ui'
import { duration, label, percent } from './data'
import type { GroupMetric, Metric, Snapshot } from './types'

export function TimelinessSummary({ summary }: { summary?: Snapshot['summary'] }) {
    return <div className='grid grid-cols-2 divide-x divide-y divide-ui-border sm:grid-cols-4 lg:grid-cols-6'>
        <Summary label='Retained' value={summary?.recordCount ?? '—'} />
        <Summary label='Needs report' value={summary?.unresolvedReferenceCount ?? '—'} attention />
        <Summary label='Anomalies' value={summary?.anomalyCount ?? '—'} attention />
        <Summary label='Awaiting alert' value={summary?.awaitingAlertCount ?? '—'} />
        <Summary label='Awaiting delivery' value={summary?.awaitingDeliveryCount ?? '—'} />
        <Summary label='Complete' value={summary?.completeCount ?? '—'} />
        <Summary label='Observed' value={percent(summary?.observedCoverage)} />
        <Summary label='Reviewed' value={percent(summary?.reviewedCoverage)} />
        <Summary label='Report → alert' value={percent(summary?.reportToAlertCoverage)} />
        <Summary label='Report → delivered' value={percent(summary?.reportToDeliveredCoverage)} />
        <Summary label='Excluded from metrics' value={summary?.excludedMetricRecordCount ?? '—'} attention />
    </div>
}

export function QualityPanel({ quality }: { quality?: Snapshot['quality'] }) {
    const importantFields = quality?.fields.filter(field => ['first_report', 'publication', 'reviewed', 'alert_created', 'delivered'].includes(field.name)) ?? []
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
            <h2 className='text-xs font-semibold text-ui-text'>Measured data quality</h2>
            <p className='mt-0.5 text-[10px] text-ui-muted'>Bad or unproven timestamps remain visible and are excluded from latency distributions.</p>
        </div>
        <div className='grid lg:grid-cols-[16rem_minmax(0,1fr)]'>
            <section className='border-b border-ui-border p-3 lg:border-b-0 lg:border-r'>
                <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Coverage and exclusions</h3>
                <dl className='mt-2 grid grid-cols-2 gap-2'>
                    {importantFields.map(field => <div key={field.name} className='rounded-md border border-ui-border bg-ui-raised p-2'>
                        <dt className='truncate text-[10px] text-ui-muted'>{label(field.name)}</dt>
                        <dd className='mt-1 text-xs font-semibold text-ui-text'>{percent(field.coverage)} <span className='font-normal text-ui-muted'>({field.missingCount} missing)</span></dd>
                    </div>)}
                </dl>
                <div className='mt-2 space-y-1'>
                    {quality?.issues.map(issue => <p key={issue.name} className='flex justify-between gap-2 text-[10px] text-ui-text'><span className='truncate'>{issue.name}</span><strong>{issue.count}</strong></p>)}
                    {!quality?.issues.length ? <p className='text-[10px] text-ui-muted'>No excluded timestamp anomalies in this scope.</p> : null}
                </div>
            </section>
            <section className='min-w-0 p-3'>
                <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Real source classes</h3>
                <div className='mt-2 overflow-x-auto'>
                    <DashboardTable
                        className='w-full text-left text-[11px]'
                        headClassName='text-ui-muted'
                        bodyClassName={null}
                        columnHeaders={['Class', 'Records', 'No observed', 'No report', 'No publication', 'No collection', 'No processing', 'No review', 'Issues'].map((heading, index) => <th key={heading} className={`pb-1 font-medium ${index ? 'text-right' : ''}`}>{heading}</th>)}
                    >{quality?.bySourceClass.map(group => <tr key={group.name} className='border-t border-ui-border'>
                            <td className='max-w-44 truncate py-1.5 text-ui-text'>{group.name}</td>
                            <td className='py-1.5 text-right text-ui-muted'>{group.recordCount}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.observed ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.first_report ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.publication ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.collection ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.processing ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{group.missing.reviewed ?? 0}</td>
                            <td className='py-1.5 text-right text-ui-text'>{Object.values(group.issues).reduce((sum, count) => sum + count, 0)}</td>
                        </tr>)}</DashboardTable>
                    {!quality?.bySourceClass.length ? <p className='py-4 text-center text-ui-muted'>No retained source classes in this scope.</p> : null}
                </div>
            </section>
        </div>
    </DashboardPanel>
}

export function MetricsPanel({ stages, sources, actors }: { stages: Array<{ name: string } & Metric>, sources: GroupMetric[], actors: GroupMetric[] }) {
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='border-b border-ui-border bg-ui-raised px-3 py-2'><h2 className='text-xs font-semibold text-ui-text'>Reproducible median / p95 / p99</h2></div>
        <div className='grid lg:grid-cols-3'>
            <MetricTable title='Stage' rows={stages.map(row => ({ ...row, name: label(row.name) }))} />
            <MetricTable title='Source family · report → delivered' rows={sources.map(row => ({ name: row.name, ...row.metrics.reportToDeliveredSeconds }))} />
            <MetricTable title='Actor · report → delivered' rows={actors.map(row => ({ name: row.name, ...row.metrics.reportToDeliveredSeconds }))} />
        </div>
    </DashboardPanel>
}

function MetricTable({ title, rows }: { title: string, rows: Array<{ name: string } & Metric> }) {
    return <section className='min-w-0 border-b border-ui-border p-3 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0'>
        <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</h3>
        <div className='mt-2 overflow-x-auto'>
            <DashboardTable
                className='w-full text-left text-[11px]'
                headClassName='text-ui-muted'
                bodyClassName={null}
                columnHeaders={['Group', 'n', 'median', 'p95', 'p99'].map((heading, index) => <th key={heading} className={`pb-1 font-medium ${index ? 'text-right' : ''}`}>{heading}</th>)}
            >{rows.map(row => <tr key={row.name} className='border-t border-ui-border'>
                    <td className='max-w-32 truncate py-1.5 text-ui-text'>{row.name}</td>
                    <td className='py-1.5 text-right text-ui-muted'>{row.sampleSize}</td>
                    <td className='py-1.5 text-right text-ui-text'>{duration(row.medianSeconds ?? undefined)}</td>
                    <td className='py-1.5 text-right text-ui-text'>{duration(row.p95Seconds ?? undefined)}</td>
                    <td className='py-1.5 text-right text-ui-text'>{duration(row.p99Seconds ?? undefined)}</td>
                </tr>)}</DashboardTable>
            {!rows.length ? <p className='py-4 text-center text-ui-muted'>No eligible measurements.</p> : null}
        </div>
    </section>
}

function Summary({ label, value, attention = false }: { label: string, value: string | number, attention?: boolean }) {
    return <div className='min-w-0 p-2.5'>
        <p className='truncate text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
        <p className={`mt-1 text-sm font-semibold ${attention && Number(value) ? 'text-ui-warning' : 'text-ui-text'}`}>{value}</p>
    </div>
}
