import type { UvmAssessmentReport } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'

const outcomeClass: Record<string, string> = {
    succeeded: 'text-ui-success', partial: 'text-ui-warning', failed: 'text-ui-warning',
    cancelled: 'text-ui-muted', skipped: 'text-ui-muted',
}

export function UvmAssessmentReportView({ assessment, onClose }: { assessment: UvmAssessmentReport, onClose: () => void }) {
    const completed = assessment.jobs.filter(job => job.status === 'succeeded').length
    const observations = assessment.jobs.reduce((total, job) => total + (job.run?.findings?.length || 0), 0)
    return <section aria-label='Assessment report' className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
                <h2 className='text-lg font-semibold'>Assessment report</h2>
                <p className='mt-1 text-xs text-ui-muted'>Started {formatDate(assessment.startedAt || assessment.createdAt)}{assessment.finishedAt ? ` · Finished ${formatDate(assessment.finishedAt)}` : ''}</p>
                <p className='mt-2 text-sm'>{assessment.status} · {completed}/{assessment.jobs.length} stages succeeded · {observations} engine observations</p>
            </div>
            <button type='button' onClick={onClose} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Close report</button>
        </div>
        <div className='mt-4 grid gap-3'>
            {assessment.jobs.map(job => <article key={job.id} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div><h3 className='font-semibold'>Stage {job.stageIndex + 1} · {job.asset} · {job.engine}</h3><p className='mt-1 text-xs text-ui-muted'>{job.profile}{job.run?.engineVersion ? ` · ${job.run.engineVersion}` : ''}{job.run?.source ? ` · ${job.run.source}` : ''}</p></div>
                    <span className={`text-xs font-semibold ${outcomeClass[job.status] || 'text-ui-text'}`}>{job.status}{job.attemptCount > 1 ? ` · ${job.attemptCount} attempts` : ''}</span>
                </div>
                {job.reportError && <p className='mt-2 text-xs text-ui-warning'>{job.reportError}</p>}
                {(job.error || job.run?.error) && <p className='mt-2 text-xs text-ui-warning'>{job.error || job.run?.error}</p>}
                {!job.run ? <p className='mt-2 text-xs text-ui-muted'>{job.runId ? 'Run details are unavailable.' : 'No scanner run was created for this stage.'}</p> : <>
                    {job.engine === 'nmap' && <>
                        <p className='mt-2 text-xs text-ui-muted'>Nmap service inventory · {job.run.hosts?.length || 0} hosts · {job.run.coverage?.openPorts ?? job.run.hosts?.reduce((sum, host) => sum + host.ports.length, 0) ?? 0} open ports</p>
                        <div className='mt-2 grid gap-2'>{job.run.hosts?.map(host => <details key={host.address} className='rounded border border-ui-border px-3 py-2'>
                            <summary className='cursor-pointer text-xs font-medium'>{host.address} · {host.status}{host.timedOut ? ' · timed out' : ''} · {host.ports.length} open ports</summary>
                            <ul className='mt-2 grid gap-1 text-xs text-ui-muted'>{host.ports.map(port => <li key={`${port.protocol}:${port.port}`}>
                                {port.protocol}/{port.port} · {port.service || 'unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` (${port.extraInfo})` : ''}
                            </li>)}{!host.ports.length && <li>No open ports reported.</li>}</ul>
                        </details>)}</div>
                    </>}
                    {!job.run.coverage && <p className='mt-3 text-xs text-ui-warning'>Coverage was not reported for this run.</p>}
                    {job.run.coverage && <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ui-muted'>
                        {job.run.coverage.requestedAddresses !== undefined && <span>Addresses {job.run.coverage.completedAddresses ?? 0}/{job.run.coverage.requestedAddresses} complete</span>}
                        {job.run.coverage.missingAddresses?.length ? <span>Missing: {job.run.coverage.missingAddresses.join(', ')}</span> : null}
                        {job.run.coverage.origin && <span>Origin: {job.run.coverage.origin}</span>}
                        {job.engine === 'zap' && <span>{job.run.coverage.urlsVisited == null ? 'URLs visited not reported' : `${job.run.coverage.urlsVisited} URLs visited`}</span>}
                        {job.run.coverage.urlsDiscovered !== undefined && job.run.coverage.urlsDiscovered !== null && <span>{job.run.coverage.urlsDiscovered} URLs discovered</span>}
                        {job.run.coverage.crawlComplete !== undefined && <span>Crawl {job.run.coverage.crawlComplete ? 'complete' : 'incomplete'}</span>}
                        {job.run.coverage.totalAlerts !== undefined && <span>{job.run.coverage.acceptedAlerts ?? 0}/{job.run.coverage.totalAlerts} in-scope alerts</span>}
                        {job.run.coverage.scopeFiltered && <span>Out-of-scope items filtered</span>}
                        {job.run.coverage.complete === undefined && <span className='text-ui-warning'>Coverage status unknown</span>}
                        {job.run.coverage.complete === false && <span className='text-ui-warning'>Coverage incomplete</span>}
                        {job.run.coverage.truncated && <span className='text-ui-warning'>Results truncated</span>}
                        {job.run.coverage.truncationReasons?.length ? <span>Reasons: {job.run.coverage.truncationReasons.join(', ')}</span> : null}
                    </div>}
                    <div className='mt-3 grid gap-2'>
                        {job.run.findings?.map(finding => <article key={finding.findingId} className='border-t border-ui-border pt-2'>
                            <p className='text-sm font-medium'>{finding.title}<span className='ml-2 text-xs text-ui-muted'>{finding.severity}</span>{finding.provider !== 'zap' && finding.cvssScore !== null && <span className='ml-2 text-xs text-ui-muted'>CVSS {finding.cvssScore}</span>}</p>
                            <p className='mt-1 break-words text-xs text-ui-muted'>
                                {finding.provider === 'tenable-vm' ? `Plugin ${finding.pluginId}` : finding.provider === 'gvm' ? `NVT ${finding.nvtOid || 'unknown'}` : `ZAP ${finding.alertRef}`}
                                {' · '}{finding.provider === 'zap' ? `${finding.method || 'HTTP'} · ${finding.instanceUrl}` : `${finding.assetAddress}${finding.port ? ` · ${finding.protocol || 'tcp'}/${finding.port}` : ''}`}
                                {finding.provider === 'zap' && finding.parameter ? ` · parameter ${finding.parameter}` : ''}
                                {finding.provider === 'zap' ? ` · confidence ${finding.confidence}` : finding.provider === 'gvm' && finding.qualityOfDetection ? ` · ${finding.qualityOfDetection}` : ''}
                                {finding.provider !== 'zap' && finding.cveIds.length ? ` · ${finding.cveIds.join(', ')}` : ''}
                            </p>
                            {(finding.description || finding.solution || finding.evidence) && <details className='mt-2 rounded border border-ui-border px-2 py-1 text-xs'>
                                <summary className='cursor-pointer font-medium'>Technical details</summary>
                                {finding.description && <p className='mt-2 whitespace-pre-wrap break-words text-ui-muted'>{finding.description}</p>}
                                {finding.solution && <p className='mt-2 whitespace-pre-wrap break-words'><strong>Remediation:</strong> {finding.solution}</p>}
                                {finding.evidence && <p className='mt-2 whitespace-pre-wrap break-words text-ui-muted'><strong>Evidence:</strong> {finding.evidence}</p>}
                            </details>}
                        </article>)}
                        {job.engine !== 'nmap' && !job.run.findings?.length && job.status === 'succeeded' && <p className='border-t border-ui-border pt-2 text-xs text-ui-muted'>No findings returned by this stage. Review coverage before treating this as a clean result.</p>}
                    </div>
                </>}
            </article>)}
        </div>
    </section>
}
