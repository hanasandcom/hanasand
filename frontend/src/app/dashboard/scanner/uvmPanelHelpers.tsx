import { useState } from 'react'
import type { NmapScanProfile, UvmFinding, UvmGvmFinding, UvmRun, UvmTenableFinding, UvmZapFinding } from '@/utils/monitoring/types'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import { TestsslObservationList } from './uvmTestsslObservations'

export type UvmFindingFilters = { query: string, engine: string, severity: string, status: string, asset: string }

export function isNmapScanProfile(value: unknown): value is NmapScanProfile {
    return value === 'tcp-top-100' || value === 'tcp-top-1000' || value === 'tcp-top-1000-safe-vuln' || value === 'tcp-all'
}

export function filterAndSortUvmFindings(findings: UvmFinding[], filters: UvmFindingFilters) {
    const query = filters.query.trim().toLowerCase()
    const filtered = findings.filter(finding => {
        if (query && ![
            finding.title, finding.asset, finding.address || '', finding.externalId, finding.engine,
            finding.description || '', ...finding.cveIds,
        ].join(' ').toLowerCase().includes(query)) return false
        if (filters.engine !== 'all' && finding.engine !== filters.engine) return false
        if (filters.severity !== 'all' && finding.severity !== filters.severity) return false
        if (filters.status === 'actionable' && !['open', 'in_progress', 'pending_verification'].includes(finding.status)) return false
        if (!['all', 'actionable'].includes(filters.status) && finding.status !== filters.status) return false
        const assetKey = finding.assetId || finding.asset
        return filters.asset === 'all' || assetKey === filters.asset
    })
    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 }
    const statusRank: Record<UvmFinding['status'], number> = { open: 0, in_progress: 1, pending_verification: 2, accepted_risk: 3, false_positive: 4, resolved: 5 }
    return filtered.sort((left, right) => {
        const severityDifference = (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
        if (severityDifference) return severityDifference
        const statusDifference = statusRank[left.status] - statusRank[right.status]
        if (statusDifference) return statusDifference
        const leftAge = Date.parse(left.firstSeen || left.lastSeen || left.updatedAt) || Number.MAX_SAFE_INTEGER
        const rightAge = Date.parse(right.firstSeen || right.lastSeen || right.updatedAt) || Number.MAX_SAFE_INTEGER
        return leftAge - rightAge || left.title.localeCompare(right.title)
    })
}

export function formatDate(value?: string | null) { return formatUtcDateTime(value, 'pending') }

export function SummaryCard({ label, value, detail }: { label: string, value: string, detail: string }) {
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><p className='text-xs font-semibold text-ui-muted'>{label}</p><p className='mt-2 text-2xl font-semibold'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></section>
}

export function RunCard({ run, defaultOpen, cancelBusy, onCancel }: { run: UvmRun, defaultOpen: boolean, cancelBusy: boolean, onCancel: () => void }) {
    const [open, setOpen] = useState(defaultOpen)
    const canCancel = run.engine === 'nmap' ? run.status === 'queued' : ['tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei'].includes(run.engine) && ['queued', 'launching', 'running', 'cancelling'].includes(run.status)
    const openPorts = (run.hosts || []).flatMap(host => host.ports.filter(port => port.state === 'open').map(port => ({ host, port })))
    const hasNmapScripts = run.hosts?.some(host => host.scriptResults?.length || host.ports.some(port => port.scriptResults?.length))
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <button type='button' onClick={() => setOpen(value => !value)} aria-expanded={open} className='flex w-full flex-wrap items-center justify-between gap-2 text-left'><span><strong>{run.target}</strong><span className='ml-2 text-xs text-ui-muted'>{run.engine} · {run.profile} · {run.source}</span></span><span className='text-xs font-semibold'>{run.status}</span><span className='text-xs text-ui-muted'>{formatDate(run.finishedAt || run.startedAt || run.createdAt)}</span></button>
        {open && <div className='mt-3 border-t border-ui-border pt-3'>
            <div className='grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                {run.engineVersion !== null && run.engineVersion !== undefined && <p>Engine version: {run.engineVersion || 'pending'}</p>}
                {run.engine === 'zap' ? <>
                    <p>Web origin: {run.coverage?.origin || run.targetOrigin || 'pending'}</p><p>Web alerts: {run.coverage?.acceptedInstances ?? 'pending'}</p>
                    <p>Traditional URLs: {run.coverage?.urlsDiscovered ?? 'not reported'} · {run.coverage?.traditionalSpiderComplete === undefined ? 'completion unknown' : run.coverage.traditionalSpiderComplete ? 'complete' : 'incomplete'}</p>
                    <p>Browser routes: {run.coverage?.clientUrlsDiscovered ?? 'not reported'} · {run.coverage?.clientSpiderComplete === undefined ? 'completion unknown' : run.coverage.clientSpiderComplete ? 'complete' : 'incomplete'}</p>
                    <p>Report complete: {run.coverage?.complete ? 'yes' : run.status === 'running' || run.status === 'queued' ? 'pending' : 'no'}</p>
                </> : <>
                    <p>Host results: {run.engine === 'nmap' && run.coverage?.known === false ? 'historical invocation coverage unavailable' : run.coverage ? `${run.coverage.completedAddresses ?? 'unknown'}/${run.coverage.attemptedAddresses ?? 'unknown'} attempted addresses` : ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status) ? 'pending' : 'not reported'}</p>
                    {run.coverage?.requestedAddresses !== undefined && <p>Requested targets: {run.coverage.requestedAddresses}</p>}
                    {run.coverage?.missingAddresses?.length ? <p className='sm:col-span-2'>Attempted but without a complete host result (including Nmap timeouts): {run.coverage.missingAddresses.join(', ')}</p> : null}
                    {run.coverage?.unattemptedAddresses?.length ? <p className='sm:col-span-2'>Not attempted: {run.coverage.unattemptedAddresses.join(', ')}</p> : null}
                    {run.coverage?.completedAddressList?.length ? <p className='sm:col-span-2'>Completed host results: {run.coverage.completedAddressList.join(', ')}</p> : null}
                    {run.engine === 'nmap' && <><p>Open TCP ports: {run.coverage?.openPorts ?? openPorts.length}</p><p>Raw Nmap XML SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p></>}
                    {run.engine === 'gvm' && <p>Raw Greenbone report SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p>}
                    {run.engine === 'testssl' && <><p>TLS addresses attempted: {run.attemptedAddresses?.length ?? 'unknown'}</p><p>TLS addresses completed: {run.completedAddresses?.length ?? 'unknown'}</p></>}
                </>}
            </div>
            {run.error && <p className='mt-2 text-xs text-ui-warning'>{run.error}</p>}
            {canCancel && <button type='button' onClick={onCancel} disabled={cancelBusy} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{cancelBusy ? 'Cancelling…' : 'Cancel scan'}</button>}
            {(run.hosts || []).length > 0 && <div className='mt-3 grid gap-2'>{run.hosts!.map(host => <div key={host.address} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{host.address} · {host.timedOut ? 'timed out' : host.status}</p>{host.ports.filter(port => port.state === 'open').length ? <div className='mt-2 grid gap-1'>{host.ports.filter(port => port.state === 'open').map(port => <div key={`${host.address}-${port.protocol}-${port.port}`}><p><code>{port.port}/{port.protocol}</code> · {port.service || 'unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` · ${port.extraInfo}` : ''}</p><NmapScriptEvidence results={port.scriptResults} /></div>)}</div> : <p className='mt-1 text-ui-muted'>No open ports were reported.</p>}<NmapScriptEvidence results={host.scriptResults} /></div>)}</div>}
            {run.findings?.length ? <div className='mt-3 grid gap-2'><h4 className='text-xs font-semibold'>Vulnerability findings · {run.findings.length}</h4>{run.findings.map(finding => <RunFinding key={finding.findingId} finding={finding} />)}</div> : null}
            {run.engine === 'testssl' && <TestsslObservationList observations={run.observations} />}
            {run.status === 'succeeded' && run.engine === 'nmap' && run.profile !== 'tcp-top-1000-safe-vuln' && <p className='mt-2 text-xs text-ui-muted'>Service inventory only. No vulnerability checks were performed by this run.</p>}
            {run.engine === 'nmap' && run.profile === 'tcp-top-1000-safe-vuln' && <p className='mt-2 text-xs text-ui-muted'>NSE output is heuristic evidence. Review results; they do not confirm exploitability.</p>}
            {run.engine === 'nmap' && run.profile === 'tcp-top-1000-safe-vuln' && !hasNmapScripts && <p className='mt-2 text-xs text-ui-muted'>No Nmap NSE script output was reported.</p>}
        </div>}
    </article>
}

function NmapScriptEvidence({ results }: { results?: Array<{ id: string, output: string, truncated: boolean }> }) {
    if (!results?.length) return null
    return <div className='mt-2 grid gap-1'><p className='font-semibold'>Nmap NSE script evidence</p>{results.map((result, index) => <details key={`${result.id}-${index}`}><summary className='cursor-pointer'>{result.id}</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-muted'>{result.output}{result.truncated ? '\n… output truncated' : ''}</pre></details>)}</div>
}

function RunFinding({ finding }: { finding: UvmTenableFinding | UvmGvmFinding | UvmZapFinding | import('@/utils/monitoring/types').UvmNucleiFinding }) {
    if (finding.provider === 'zap') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>Confidence {finding.confidence}</span></div>
        <p className='mt-1 break-all text-ui-muted'>{finding.method || 'HTTP'} {finding.instanceUrl}{finding.parameter ? ` · ${finding.parameter}` : ''}</p>
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {finding.evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}
    </div>
    if (finding.provider === 'gvm') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>{finding.assetAddress}{finding.port ? `:${finding.port}/${finding.protocol || 'tcp'}` : ''}{finding.nvtOid ? ` · NVT ${finding.nvtOid}` : ''}</span></div>
        {finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}
        {finding.qualityOfDetection && <p className='mt-1 text-ui-muted'>Detection quality: {finding.qualityOfDetection}</p>}
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {finding.evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}
    </div>
    return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>{finding.provider === 'nuclei' ? `Template ${finding.templateId} · ${finding.assetAddress}` : `Plugin ${finding.pluginId} · ${finding.assetAddress}${finding.port ? `:${finding.port}` : ''}`}</span></div>
        {finding.provider === 'nuclei' && <p className='mt-1 text-ui-muted'>Matched: {finding.matchedAt} · {finding.tags.join(', ') || 'untagged'}</p>}
        {finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {finding.evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}
    </div>
}
