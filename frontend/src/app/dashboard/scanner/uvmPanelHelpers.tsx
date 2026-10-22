import { useState } from 'react'
import type { UvmFinding, UvmRun } from '@/utils/monitoring/types'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'

export type UvmFindingFilters = { query: string, engine: string, severity: string, status: string, asset: string }

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

export function formatRunCoverage(run: UvmRun) {
    if (run.coverage?.known === false) return 'Coverage unavailable'
    if (!run.coverage) {
        return ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status)
            ? `${run.status} · coverage pending`
            : 'Coverage not reported'
    }
    const targets = run.coverage.requestedAddresses ?? run.coverage.attemptedAddresses
    if (targets <= 0) return 'No address count reported'
    return `${run.coverage.completedAddresses}/${targets} addresses · ${run.status}`
}

export function RunCard({ run, defaultOpen, cancelBusy, servicesPaused = false, onCancel }: { run: UvmRun, defaultOpen: boolean, cancelBusy: boolean, servicesPaused?: boolean, onCancel: () => void }) {
    const [open, setOpen] = useState(defaultOpen || run.status === 'running' || run.status === 'queued')
    const canCancel = run.engine === 'nmap' ? run.status === 'queued' : run.engine === 'tenable-vm' && ['queued', 'launching', 'running'].includes(run.status)
    const openPorts = run.hosts.flatMap(host => host.ports.filter(port => port.state === 'open').map(port => ({ host, port })))
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <button type='button' onClick={() => setOpen(value => !value)} aria-expanded={open} className='flex w-full flex-wrap items-center justify-between gap-2 text-left'><span><strong>{run.target}</strong><span className='ml-2 text-xs text-ui-muted'>{run.engine} · {run.profile} · {run.source}</span></span><span className='text-xs font-semibold'>{run.status}</span><span className='text-xs text-ui-muted'>{formatDate(run.finishedAt || run.startedAt || run.createdAt)}</span></button>
        {open && <div className='mt-3 border-t border-ui-border pt-3'>
            <div className='grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>{run.engineVersion !== null && <p>Engine version: {run.engineVersion || 'pending'}</p>}<p>Host results: {run.engine === 'nmap' && run.coverage?.known === false ? 'historical invocation coverage unavailable' : run.coverage ? `${run.coverage.completedAddresses}/${run.coverage.attemptedAddresses} attempted addresses` : ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status) ? 'pending' : 'not reported'}</p>{run.coverage?.requestedAddresses !== undefined && <p>Requested targets: {run.coverage.requestedAddresses}</p>}{run.coverage?.missingAddresses?.length ? <p className='sm:col-span-2'>Attempted but without a complete host result (including Nmap timeouts): {run.coverage.missingAddresses.join(', ')}</p> : null}{run.coverage?.unattemptedAddresses?.length ? <p className='sm:col-span-2'>Not attempted: {run.coverage.unattemptedAddresses.join(', ')}</p> : null}{run.coverage?.completedAddressList?.length ? <p className='sm:col-span-2'>Completed host results: {run.coverage.completedAddressList.join(', ')}</p> : null}{run.engine === 'nmap' && <><p>Open TCP ports: {run.coverage?.openPorts ?? openPorts.length}</p><p>Raw Nmap XML SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p></>}{run.engine === 'gvm' && <p>Raw Greenbone report SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p>}</div>
            {run.error && <p className='mt-2 text-xs text-ui-warning'>{run.error}</p>}
            {canCancel && <button type='button' onClick={onCancel} disabled={cancelBusy || servicesPaused} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{cancelBusy ? 'Cancelling…' : 'Cancel scan'}</button>}
            {run.engine === 'gvm' && ['queued', 'launching', 'running', 'cancelling'].includes(run.status) && <p className='mt-2 text-xs text-ui-muted'>Cancel this job from its parent assessment.</p>}
            {run.hosts.length > 0 && <div className='mt-3 grid gap-2'>{run.hosts.map(host => <div key={host.address} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{host.address} · {host.timedOut ? 'timed out' : host.status}</p>{host.ports.filter(port => port.state === 'open').length ? <div className='mt-2 grid gap-1'>{host.ports.filter(port => port.state === 'open').map(port => <p key={`${host.address}-${port.protocol}-${port.port}`}><code>{port.port}/{port.protocol}</code> · {port.service || 'unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` · ${port.extraInfo}` : ''}</p>)}</div> : <p className='mt-1 text-ui-muted'>No open ports were reported.</p>}</div>)}</div>}
            {run.findings?.length ? <div className='mt-3 grid gap-2'><h4 className='text-xs font-semibold'>Vulnerability findings · {run.findings.length}</h4>{run.findings.map(finding => <div key={finding.findingId} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>Plugin {finding.pluginId} · {finding.assetAddress}{finding.port ? `:${finding.port}` : ''}</span></div>{finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}{finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}{finding.evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}</div>)}</div> : null}
            {run.status === 'succeeded' && run.engine === 'nmap' && <p className='mt-2 text-xs text-ui-muted'>Service inventory only. No vulnerability checks were performed by this run.</p>}
        </div>}
    </article>
}
