'use client'

import { useState } from 'react'
import type { UvmRun } from '@/utils/monitoring/types'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'

export default function UvmRunCard({ run, defaultOpen, cancelBusy, onCancel }: { run: UvmRun, defaultOpen: boolean, cancelBusy: boolean, onCancel: () => void }) {
    const [open, setOpen] = useState(defaultOpen || run.status === 'running' || run.status === 'queued')
    const canCancel = run.engine === 'nmap' ? run.status === 'queued' : ['queued', 'launching', 'running'].includes(run.status)
    const openPorts = run.hosts.flatMap(host => host.ports.filter(port => port.state === 'open').map(port => ({ host, port })))
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <button type='button' onClick={() => setOpen(value => !value)} aria-expanded={open} className='flex w-full flex-wrap items-center justify-between gap-2 text-left'><span><strong>{run.target}</strong><span className='ml-2 text-xs text-ui-muted'>{run.engine} · {run.profile} · {run.source}</span></span><span className='text-xs font-semibold'>{run.status}</span><span className='text-xs text-ui-muted'>{formatUtcDateTime(run.finishedAt || run.startedAt || run.createdAt, 'pending')}</span></button>
        {open && <div className='mt-3 border-t border-ui-border pt-3'>
            <div className='grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>{run.engineVersion !== null && <p>Engine version: {run.engineVersion || 'pending'}</p>}<p>Address coverage: {run.coverage ? `${run.coverage.completedAddresses}/${run.coverage.attemptedAddresses} addresses` : ['queued', 'launching', 'running', 'exporting'].includes(run.status) ? 'pending' : 'not reported'}</p>{run.engine === 'nmap' && <><p>Open TCP ports: {run.coverage?.openPorts ?? openPorts.length}</p><p>Raw Nmap XML SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p></>}</div>
            {run.error && <p className='mt-2 text-xs text-ui-warning'>{run.error}</p>}
            {canCancel && <button type='button' onClick={onCancel} disabled={cancelBusy} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{cancelBusy ? 'Cancelling…' : 'Cancel scan'}</button>}
            {run.hosts.length > 0 && <div className='mt-3 grid gap-2'>{run.hosts.map(host => <div key={host.address} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{host.address} · {host.status}</p>{host.ports.filter(port => port.state === 'open').length ? <div className='mt-2 grid gap-1'>{host.ports.filter(port => port.state === 'open').map(port => <p key={`${host.address}-${port.protocol}-${port.port}`}><code>{port.port}/{port.protocol}</code> · {port.service || 'unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` · ${port.extraInfo}` : ''}</p>)}</div> : <p className='mt-1 text-ui-muted'>No open ports were reported.</p>}</div>)}</div>}
            {run.findings?.length ? <div className='mt-3 grid gap-2'><h4 className='text-xs font-semibold'>Vulnerability findings · {run.findings.length}</h4>{run.findings.map(finding => <div key={finding.findingId} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>Plugin {finding.pluginId} · {finding.assetAddress}{finding.port ? `:${finding.port}` : ''}</span></div>{finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}{finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}{finding.evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}</div>)}</div> : null}
            {run.status === 'succeeded' && run.engine === 'nmap' && <p className='mt-2 text-xs text-ui-muted'>Service inventory only. No vulnerability checks were performed by this run.</p>}
        </div>}
    </article>
}
