import type { UvmAssessmentReport } from '@/utils/monitoring/types'
import { EngineObservationList, formatDate, isTestsslObservation, RunFinding } from './uvmPanelHelpers'
import { TestsslObservationList } from './uvmTestsslObservations'

const outcomeClass: Record<string, string> = {
    succeeded: 'text-ui-success', partial: 'text-ui-warning', failed: 'text-ui-warning',
    cancelled: 'text-ui-muted', skipped: 'text-ui-muted',
}

export function UvmAssessmentReportView({ assessment, busy = '', onClose, onOpenFindings, onOpenRun }: {
    assessment: UvmAssessmentReport
    busy?: string
    onClose: () => void
    onOpenFindings: (stepId: string, assetId: string, engine: string) => void
    onOpenRun: (runId: string, engine: string) => void
}) {
    const completed = assessment.jobs.filter(job => job.status === 'succeeded').length
    const findingRecords = assessment.jobs.reduce((total, job) => total + (job.run?.findings?.length || 0), 0)
    return <section aria-label='Assessment report' className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
                <h2 className='text-lg font-semibold'>Assessment report</h2>
                <p className='mt-1 text-xs text-ui-muted'>Started {formatDate(assessment.startedAt || assessment.createdAt)}{assessment.finishedAt ? ` · Finished ${formatDate(assessment.finishedAt)}` : ''}</p>
                <p className='mt-2 text-sm'>{assessment.status} · {completed}/{assessment.jobs.length} stages succeeded · {findingRecords} normalized records</p>
            </div>
            <button type='button' onClick={onClose} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Close report</button>
        </div>
        <div className='mt-4 grid gap-3'>
            {assessment.jobs.map(job => <article key={job.id} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div><h3 className='font-semibold'>Stage {job.stageIndex + 1} · {job.asset} · {job.engine}</h3><p className='mt-1 text-xs text-ui-muted'>{job.profile}{job.run?.engineVersion ? ` · ${job.run.engineVersion}` : ''}{job.run?.source ? ` · ${job.run.source}` : ''}</p>{job.run && <p className='mt-1 break-all text-xs text-ui-muted'>Target: {job.run.targetOrigin || job.run.target} · Run: {job.run.id}</p>}</div>
                    <span className={`text-xs font-semibold ${outcomeClass[job.status] || 'text-ui-text'}`}>{job.status}{job.attemptCount > 1 ? ` · ${job.attemptCount} attempts` : ''}</span>
                </div>
                {job.run && <button type='button' onClick={() => onOpenRun(job.run!.id, job.engine)} className='mt-2 rounded border border-ui-border px-2 py-1 text-xs font-semibold'>View run details</button>}
                {job.reportError && <p className='mt-2 text-xs text-ui-warning'>{job.reportError}</p>}
                {(job.error || job.run?.error) && <p className='mt-2 text-xs text-ui-warning'>{job.error || job.run?.error}</p>}
                {!job.run ? <p className='mt-2 text-xs text-ui-muted'>{job.runId ? 'Run details are unavailable.' : 'No scanner run was created for this stage.'}</p> : <>
                    {job.engine === 'nmap' && <>
                        <p className='mt-2 text-xs text-ui-muted'>Nmap {job.run.profile === 'tcp-top-1000-safe-vuln' ? 'inventory and NSE script evidence' : job.run.profile === 'udp-top-100' ? 'UDP inventory' : 'TCP service inventory'} · {job.run.hosts?.length || 0} hosts · {job.run.hosts?.reduce((sum, host) => sum + host.ports.filter(port => port.state === 'open').length, 0) ?? 0} open{job.run.profile === 'udp-top-100' ? ` · ${job.run.hosts?.reduce((sum, host) => sum + host.ports.filter(port => port.protocol === 'udp' && port.state === 'open|filtered').length, 0) ?? 0} open|filtered UDP` : ' TCP ports'}</p>
                        <div className='mt-2 grid gap-2'>{job.run.hosts?.map(host => <details key={host.address} className='rounded border border-ui-border px-3 py-2'>
                            <summary className='cursor-pointer text-xs font-medium'>{host.address} · {host.status}{host.timedOut ? ' · timed out' : ''} · {host.ports.length} {job.run?.profile === 'udp-top-100' ? 'UDP observations' : 'open ports'}</summary>
                            <ul className='mt-2 grid gap-1 text-xs text-ui-muted'>{host.ports.map(port => <li key={`${port.protocol}:${port.port}`}>
                                {port.protocol}/{port.port} · {port.state} · {port.service || 'unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` (${port.extraInfo})` : ''}
                            </li>)}{!host.ports.length && <li>No open ports reported.</li>}</ul>
                            {host.scriptResults?.length ? <div className='mt-2 grid gap-1 text-xs'><p className='font-semibold'>Nmap NSE script evidence · heuristic only</p>{host.scriptResults.map((script, index) => <details key={`${script.id}-${index}`}><summary className='cursor-pointer'>{script.id}</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-muted'>{script.output}{script.truncated ? '\n… output truncated' : ''}</pre></details>)}</div> : null}
                            {host.ports.some(port => port.scriptResults?.length) && <div className='mt-2 grid gap-1 text-xs'><p className='font-semibold'>Nmap NSE script evidence · heuristic only</p>{host.ports.flatMap(port => (port.scriptResults || []).map((script, index) => <details key={`${port.protocol}:${port.port}:${script.id}:${index}`}><summary className='cursor-pointer'>{port.protocol}/{port.port} · {script.id}</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-muted'>{script.output}{script.truncated ? '\n… output truncated' : ''}</pre></details>))}</div>}
                        </details>)}</div>
                    </>}
                    {job.engine === 'naabu' && <>
                        <p className='mt-2 text-xs text-ui-muted'>Naabu top 100 TCP port discovery · {job.run.hosts?.length || 0} hosts · {job.run.hosts?.reduce((sum, host) => sum + host.ports.filter(port => port.state === 'open').length, 0) ?? 0} open ports · 25 probes/second</p>
                        <div className='mt-2 grid gap-2'>{job.run.hosts?.map(host => <details key={host.address} className='rounded border border-ui-border px-3 py-2'>
                            <summary className='cursor-pointer text-xs font-medium'>{host.address} · {host.status}{host.timedOut ? ' · timed out' : ''} · {host.ports.length} open ports</summary>
                            <ul className='mt-2 grid gap-1 text-xs text-ui-muted'>{host.ports.map(port => <li key={`${port.protocol}:${port.port}`}>{port.protocol}/{port.port} · {port.state}</li>)}{!host.ports.length && <li>No open ports reported.</li>}</ul>
                        </details>)}</div>
                        {job.run.rawOutputSha256 && <p className='mt-2 break-all text-xs text-ui-muted'>Raw output SHA-256: {job.run.rawOutputSha256}</p>}
                    </>}
                    {job.engine === 'angry-ip-scanner' && <>
                        <p className='mt-2 text-xs text-ui-muted'>Angry IP reachability · {job.run.hosts?.filter(host => host.status === 'up').length ?? 0} reachable · {job.run.hosts?.filter(host => host.status === 'unknown').length ?? 0} unknown · no port checks</p>
                        <ul className='mt-2 grid gap-1 text-xs text-ui-muted'>{job.run.hosts?.map(host => <li key={host.address}>{host.address} · {host.timedOut ? 'timeout' : host.status}</li>)}</ul>
                    </>}
                    {job.engine === 'testssl' && <>
                        <p className='mt-2 text-xs text-ui-muted'>testssl.sh TLS configuration checks · {job.run.observations?.length || 0} observations · {job.run.completedAddresses?.length ?? job.run.coverage?.completedAddresses ?? 'unknown'} addresses completed</p>
                        <TestsslObservationList observations={job.run.observations?.filter(isTestsslObservation)} />
                    </>}
                    {['httpx', 'tlsx', 'katana', 'wafw00f'].includes(job.engine) && <details className='mt-3 rounded border border-ui-border px-3 py-2'>
                        <summary className='cursor-pointer text-xs font-semibold'>Engine observations · {job.run.observations?.length || 0}</summary>
                        <EngineObservationList engine={job.engine} observations={job.run.observations as unknown as Array<Record<string, unknown>> | undefined} />
                    </details>}
                    {!job.run.coverage && <p className='mt-3 text-xs text-ui-warning'>Coverage was not reported for this run.</p>}
                    {job.run.coverage && <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ui-muted'>
                        {job.run.coverage.requestedAddresses !== undefined && <span>Addresses {job.run.coverage.completedAddresses ?? 0}/{job.run.coverage.requestedAddresses} complete</span>}
                        {job.run.coverage.missingAddresses?.length ? <span>Missing: {job.run.coverage.missingAddresses.join(', ')}</span> : null}
                        {job.run.coverage.origin && <span>Origin: {job.run.coverage.origin}</span>}
                        {job.engine === 'zap' && <span>{job.run.coverage.urlsVisited == null ? 'URLs visited not reported' : `${job.run.coverage.urlsVisited} URLs visited`}</span>}
                        {job.engine === 'zap' && <span>{job.run.coverage.urlsDiscovered ?? 'not reported'} traditional URLs</span>}
                        {job.engine === 'zap' && <span>{job.run.coverage.clientUrlsDiscovered ?? 'not reported'} browser routes</span>}
                        {job.engine === 'zap' && job.run.coverage.traditionalSpiderComplete !== undefined && <span>Traditional crawl {job.run.coverage.traditionalSpiderComplete ? 'complete' : 'incomplete'}</span>}
                        {job.engine === 'zap' && job.run.coverage.clientSpiderComplete !== undefined && <span>Browser crawl {job.run.coverage.clientSpiderComplete ? 'complete' : 'incomplete'}</span>}
                        {job.run.coverage.crawlComplete !== undefined && <span>Crawl {job.run.coverage.crawlComplete ? 'complete' : 'incomplete'}</span>}
                        {job.run.coverage.totalAlerts !== undefined && <span>{job.run.coverage.acceptedAlerts ?? 0}/{job.run.coverage.totalAlerts} in-scope alerts</span>}
                        {job.run.coverage.scopeFiltered && <span>Out-of-scope items filtered</span>}
                        {job.run.coverage.complete === undefined && <span className='text-ui-warning'>Coverage status unknown</span>}
                        {job.run.coverage.complete === false && <span className='text-ui-warning'>Coverage incomplete</span>}
                        {job.run.coverage.truncated && <span className='text-ui-warning'>Results truncated</span>}
                        {job.run.coverage.truncationReasons?.length ? <span>Reasons: {job.run.coverage.truncationReasons.join(', ')}</span> : null}
                    </div>}
                    <div className='mt-3 grid gap-2'>
                        {job.run.findings?.length && ['succeeded', 'partial'].includes(job.status) ? <div className='flex items-center justify-between gap-2 border-t border-ui-border pt-2'>
                            <h4 className='text-xs font-semibold'>Findings · {job.run.findings.length}</h4>
                            <button type='button' onClick={() => onOpenFindings(job.id, job.assetId, job.engine)} disabled={busy === `assessment-findings:${job.id}`} className='rounded border border-ui-border px-2 py-1 text-xs font-semibold disabled:opacity-50'>{busy === `assessment-findings:${job.id}` ? 'Loading triage…' : 'Review in triage'}</button>
                        </div> : null}
                        {job.run.findings?.map(finding => <RunFinding key={finding.findingId} finding={finding} />)}
                        {!['nmap', 'testssl', 'angry-ip-scanner'].includes(job.engine) && !job.run.findings?.length && job.status === 'succeeded' && <p className='border-t border-ui-border pt-2 text-xs text-ui-muted'>No findings returned by this stage. Review coverage before treating this as a clean result.</p>}
                    </div>
                </>}
            </article>)}
        </div>
    </section>
}
