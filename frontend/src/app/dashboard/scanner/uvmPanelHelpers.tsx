import { useState } from 'react'
import type { NmapScanProfile, UvmAsset, UvmAssetCriticality, UvmFinding, UvmFindingGroup, UvmRun, UvmTestsslObservation } from '@/utils/monitoring/types'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import { TestsslObservationList } from './uvmTestsslObservations'

export type UvmFindingFilters = { query: string, engine: string, severity: string, status: string, asset: string }
export type UvmFindingSort = 'severity' | 'criticality'

export function buildAssessmentFindingFilters(assetId: string, engine: string): UvmFindingFilters {
    return { query: '', engine, severity: 'all', status: 'all', asset: assetId }
}

export function isNmapScanProfile(value: unknown): value is NmapScanProfile {
    return value === 'tcp-top-100' || value === 'tcp-top-1000' || value === 'tcp-top-1000-safe-vuln' || value === 'tcp-all' || value === 'udp-top-100'
}

export function filterAndSortUvmFindings(findings: UvmFinding[], filters: UvmFindingFilters, assets: UvmAsset[] = [], sort: UvmFindingSort = 'severity') {
    const query = filters.query.trim().toLowerCase()
    const filtered = findings.filter(finding => {
        if (query && ![
            finding.title, finding.asset, finding.address || '', finding.externalId, finding.engine,
            finding.description || '', ...finding.cveIds,
        ].join(' ').toLowerCase().includes(query)) return false
        if (filters.engine !== 'all' && finding.engine !== filters.engine) return false
        if (filters.severity !== 'all' && finding.severity !== filters.severity) return false
        if (filters.status === 'needs_attention' && !['needs_review', 'open', 'in_progress', 'pending_verification'].includes(finding.status)) return false
        if (filters.status === 'actionable' && !['open', 'in_progress', 'pending_verification'].includes(finding.status)) return false
        if (!['all', 'actionable', 'needs_attention'].includes(filters.status) && finding.status !== filters.status) return false
        const assetKey = finding.assetId || finding.asset
        return filters.asset === 'all' || assetKey === filters.asset
    })
    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 }
    const criticalityRank: Record<UvmAssetCriticality, number> = { critical: 0, high: 1, medium: 2, low: 3, unset: 4 }
    const assetCriticality = new Map(assets.map(asset => [asset.id, asset.criticality]))
    const statusRank: Record<UvmFinding['status'], number> = { needs_review: 0, open: 1, in_progress: 2, pending_verification: 3, accepted_risk: 4, false_positive: 5, resolved: 6 }
    return filtered.sort((left, right) => {
        if (sort === 'criticality') {
            const leftCriticality = left.assetId ? assetCriticality.get(left.assetId) || 'unset' : 'unset'
            const rightCriticality = right.assetId ? assetCriticality.get(right.assetId) || 'unset' : 'unset'
            const criticalityDifference = criticalityRank[leftCriticality] - criticalityRank[rightCriticality]
            if (criticalityDifference) return criticalityDifference
        }
        const severityDifference = (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
        if (severityDifference) return severityDifference
        const statusDifference = statusRank[left.status] - statusRank[right.status]
        if (statusDifference) return statusDifference
        const leftAge = Date.parse(left.firstSeen || left.lastSeen || left.updatedAt) || Number.MAX_SAFE_INTEGER
        const rightAge = Date.parse(right.firstSeen || right.lastSeen || right.updatedAt) || Number.MAX_SAFE_INTEGER
        return leftAge - rightAge || left.title.localeCompare(right.title)
    })
}

export function filterAndSortUvmFindingGroups(groups: UvmFindingGroup[], filters: UvmFindingFilters, assets: UvmAsset[] = [], sort: UvmFindingSort = 'severity') {
    const matchingGroups = groups.filter(group => filterAndSortUvmFindings(group.members, filters, assets, sort).length > 0)
    const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, unknown: 5 }
    const statusRank: Record<UvmFindingGroup['status'], number> = { actionable: 0, needs_review: 1, mixed: 2, accepted_risk: 3, false_positive: 4, resolved: 5 }
    const criticalityRank: Record<UvmAssetCriticality, number> = { critical: 0, high: 1, medium: 2, low: 3, unset: 4 }
    const assetCriticality = new Map(assets.map(asset => [asset.id, asset.criticality]))
    return matchingGroups.sort((left, right) => {
        if (sort === 'criticality') {
            const leftCriticality = left.assetId ? assetCriticality.get(left.assetId) || 'unset' : 'unset'
            const rightCriticality = right.assetId ? assetCriticality.get(right.assetId) || 'unset' : 'unset'
            const criticalityDifference = criticalityRank[leftCriticality] - criticalityRank[rightCriticality]
            if (criticalityDifference) return criticalityDifference
        }
        const severityDifference = (severityRank[left.severity] ?? 5) - (severityRank[right.severity] ?? 5)
        if (severityDifference) return severityDifference
        return statusRank[left.status] - statusRank[right.status] || left.asset.localeCompare(right.asset) || left.id.localeCompare(right.id)
    })
}

export function formatDate(value?: string | null) { return formatUtcDateTime(value, 'pending') }

export function SummaryCard({ label, value, detail }: { label: string, value: string, detail: string }) {
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><p className='text-xs font-semibold text-ui-muted'>{label}</p><p className='mt-2 text-2xl font-semibold'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></section>
}

export function RunCard({ run, defaultOpen, cancelBusy, onCancel }: { run: UvmRun, defaultOpen: boolean, cancelBusy: boolean, onCancel: () => void }) {
    const [open, setOpen] = useState(defaultOpen)
    const canCancel = ['nmap', 'naabu', 'angry-ip-scanner'].includes(run.engine) ? ['queued', 'running'].includes(run.status) : ['tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei', 'nikto', 'sslyze', 'wapiti', 'whatweb'].includes(run.engine) && ['queued', 'launching', 'running', 'cancelling'].includes(run.status)
    const observedPorts = (run.hosts || []).flatMap(host => host.ports.map(port => ({ host, port })))
    const confirmedOpenPorts = observedPorts.filter(({ port }) => port.state === 'open')
    const ambiguousUdpPorts = observedPorts.filter(({ port }) => port.protocol === 'udp' && port.state === 'open|filtered')
    const hasNmapScripts = run.hosts?.some(host => host.scriptResults?.length || host.ports.some(port => port.scriptResults?.length))
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <button type='button' onClick={() => setOpen(value => !value)} aria-expanded={open} className='flex w-full flex-wrap items-center justify-between gap-2 text-left'><span><strong>{run.target}</strong><span className='ml-2 text-xs text-ui-muted'>{run.engine} · {run.profile} · {run.source}</span></span><span className='text-xs font-semibold'>{run.status}</span><span className='text-xs text-ui-muted'>{formatDate(run.finishedAt || run.startedAt || run.createdAt)}</span></button>
        {open && <div className='mt-3 border-t border-ui-border pt-3'>
            <div className='grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                {run.engineVersion !== null && run.engineVersion !== undefined && <p>Engine version: {run.engineVersion || 'pending'}</p>}
                {run.engine === 'zap' ? <>
                    <p>Web origin: {run.coverage?.origin || run.targetOrigin || 'pending'}</p><p>Web alerts: {run.coverage?.acceptedInstances ?? 'pending'}</p>
                    {(run.seededUrlCount || 0) > 0 && <p className='sm:col-span-2'>Katana seed URLs: {run.seededUrlCount} · source run <code className='break-all'>{run.seedSourceRunId}</code></p>}
                    <p>Traditional URLs: {run.coverage?.urlsDiscovered ?? 'not reported'} · {run.coverage?.traditionalSpiderComplete === undefined ? 'completion unknown' : run.coverage.traditionalSpiderComplete ? 'complete' : 'incomplete'}</p>
                    <p>Browser routes: {run.coverage?.clientUrlsDiscovered ?? 'not reported'} · {run.coverage?.clientSpiderComplete === undefined ? 'completion unknown' : run.coverage.clientSpiderComplete ? 'complete' : 'incomplete'}</p>
                    <p>Report complete: {run.coverage?.complete ? 'yes' : run.status === 'running' || run.status === 'queued' ? 'pending' : 'no'}</p>
                </> : <>
                    <p>Host results: {run.engine === 'nmap' && run.coverage?.known === false ? 'historical invocation coverage unavailable' : run.coverage ? `${run.coverage.completedAddresses ?? 'unknown'}/${run.coverage.attemptedAddresses ?? 'unknown'} attempted addresses` : ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status) ? 'pending' : 'not reported'}</p>
                    {run.coverage?.requestedAddresses !== undefined && <p>Requested targets: {run.coverage.requestedAddresses}</p>}
                    {run.coverage?.missingAddresses?.length ? <p className='sm:col-span-2'>Attempted but without a complete host result (including Nmap timeouts): {run.coverage.missingAddresses.join(', ')}</p> : null}
                    {run.coverage?.unattemptedAddresses?.length ? <p className='sm:col-span-2'>Not attempted: {run.coverage.unattemptedAddresses.join(', ')}</p> : null}
                    {run.coverage?.completedAddressList?.length ? <p className='sm:col-span-2'>Completed host results: {run.coverage.completedAddressList.join(', ')}</p> : null}
                    {run.engine === 'nmap' && <><p>{run.profile === 'udp-top-100' ? `Open UDP ports: ${confirmedOpenPorts.length} · open|filtered: ${ambiguousUdpPorts.length}` : `Open TCP ports: ${run.coverage?.openPorts ?? confirmedOpenPorts.length}`}</p><p>Raw Nmap XML SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p></>}
                    {run.engine === 'naabu' && <><p>Open TCP ports: {run.coverage?.openPorts ?? confirmedOpenPorts.length}</p><p>Raw Naabu output SHA-256: <code className='break-all'>{run.rawOutputSha256 || 'pending'}</code></p></>}
                    {run.engine === 'gvm' && <p>Raw Greenbone report SHA-256: <code className='break-all'>{run.rawXmlSha256 || 'pending'}</code></p>}
                    {run.engine === 'testssl' && <><p>TLS addresses attempted: {run.attemptedAddresses?.length ?? 'unknown'}</p><p>TLS addresses completed: {run.completedAddresses?.length ?? 'unknown'}</p></>}
                </>}
            </div>
            {run.error && <p className='mt-2 text-xs text-ui-warning'>{run.error}</p>}
            {canCancel && <button type='button' onClick={onCancel} disabled={cancelBusy} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{cancelBusy ? 'Cancelling…' : 'Cancel scan'}</button>}
            {(run.hosts || []).length > 0 && <div className='mt-3 grid gap-2'>{run.hosts!.map(host => <div key={host.address} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{host.address} · {host.timedOut ? 'timed out' : host.status}</p>{host.ports.length ? <div className='mt-2 grid gap-1'>{host.ports.map(port => <div key={`${host.address}-${port.protocol}-${port.port}`}><p><code>{port.port}/{port.protocol}</code> · {port.state}{port.service ? ` · ${port.service}` : ' · unknown service'}{port.product ? ` · ${port.product}` : ''}{port.version ? ` ${port.version}` : ''}{port.extraInfo ? ` · ${port.extraInfo}` : ''}</p><NmapScriptEvidence results={port.scriptResults} /></div>)}</div> : run.engine === 'angry-ip-scanner' ? <p className='mt-1 text-ui-muted'>Reachability only · no port checks.</p> : <p className='mt-1 text-ui-muted'>No matching ports were reported.</p>}<NmapScriptEvidence results={host.scriptResults} /></div>)}</div>}
            {run.findings?.length ? <div className='mt-3 grid gap-2'><h4 className='text-xs font-semibold'>Vulnerability findings · {run.findings.length}</h4>{run.findings.map(finding => <RunFinding key={finding.findingId} finding={finding} />)}</div> : null}
            {run.engine === 'testssl' && <TestsslObservationList observations={run.observations?.filter(isTestsslObservation)} />}
            {['httpx', 'tlsx', 'katana', 'wafw00f'].includes(run.engine) && <EngineObservationList engine={run.engine} observations={run.observations as unknown as Array<Record<string, unknown>> | undefined} />}
            {run.status === 'succeeded' && run.engine === 'nmap' && run.profile !== 'tcp-top-1000-safe-vuln' && <p className='mt-2 text-xs text-ui-muted'>Service inventory only. No vulnerability checks were performed by this run.</p>}
            {run.status === 'succeeded' && run.engine === 'naabu' && <p className='mt-2 text-xs text-ui-muted'>Top 100 TCP port discovery only. No service identification or vulnerability checks were performed.</p>}
            {run.engine === 'nmap' && run.profile === 'tcp-top-1000-safe-vuln' && <p className='mt-2 text-xs text-ui-muted'>NSE output is heuristic evidence. Review results; they do not confirm exploitability.</p>}
            {run.engine === 'nmap' && run.profile === 'tcp-top-1000-safe-vuln' && !hasNmapScripts && <p className='mt-2 text-xs text-ui-muted'>No Nmap NSE script output was reported.</p>}
        </div>}
    </article>
}

function NmapScriptEvidence({ results }: { results?: Array<{ id: string, output: string, truncated: boolean }> }) {
    if (!results?.length) return null
    return <div className='mt-2 grid gap-1'><p className='font-semibold'>Nmap NSE script evidence</p>{results.map((result, index) => <details key={`${result.id}-${index}`}><summary className='cursor-pointer'>{result.id}</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-muted'>{result.output}{result.truncated ? '\n… output truncated' : ''}</pre></details>)}</div>
}

function findingEvidence(evidence: string | null | Record<string, unknown>) {
    return typeof evidence === 'string' || evidence === null ? evidence : JSON.stringify(evidence, null, 2)
}

export function isTestsslObservation(observation: NonNullable<UvmRun['observations']>[number]): observation is UvmTestsslObservation {
    return 'result' in observation && 'disposition' in observation
}

export function RunFinding({ finding }: { finding: NonNullable<UvmRun['findings']>[number] }) {
    const evidence = findingEvidence(finding.evidence)
    if (finding.provider === 'zap') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>Confidence {finding.confidence}</span></div>
        <p className='mt-1 break-all text-ui-muted'>{finding.method || 'HTTP'} {finding.instanceUrl}{finding.parameter ? ` · ${finding.parameter}` : ''}</p>
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
    </div>
    if (finding.provider === 'gvm') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>{finding.assetAddress}{finding.port ? `:${finding.port}/${finding.protocol || 'tcp'}` : ''}{finding.nvtOid ? ` · NVT ${finding.nvtOid}` : ''}</span></div>
        {finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}
        {finding.qualityOfDetection && <p className='mt-1 text-ui-muted'>Detection quality: {finding.qualityOfDetection}</p>}
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
    </div>
    if (finding.provider === 'nikto') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity} · {finding.disposition}</span><span className='text-ui-muted'>{finding.method || 'GET'} {finding.targetOrigin}{finding.uri} · {finding.assetAddress}{finding.pluginId ? ` · ${finding.pluginId}` : ''}</span></div>
        {evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
    </div>
    if (finding.provider === 'sslyze') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity} · {finding.disposition}</span><span className='text-ui-muted'>{finding.host}:{finding.port} · {finding.checkId}</span></div>
        {evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
    </div>
    if (finding.provider === 'wapiti') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity} · {finding.disposition}</span><span className='text-ui-muted'>{finding.targetOrigin}{finding.uri} · {finding.assetAddress} · {finding.module}</span></div>{evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}</div>
    if (finding.provider === 'whatweb') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>Informational</span><span className='text-ui-muted'>{finding.targetOrigin} · {finding.plugin}</span></div>{evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}</div>
    if (finding.provider === 'httpx') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-raised px-2 py-0.5 font-semibold text-ui-muted'>Informational</span><span className='text-ui-muted'>{finding.assetAddress} · HTTP {finding.statusCode ?? 'unknown'}</span></div><p className='mt-1 break-all text-ui-muted'>{finding.url}</p>{evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Response metadata</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}</div>
    if (finding.provider === 'tlsx') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className={`rounded px-2 py-0.5 font-semibold ${finding.disposition === 'finding' ? 'bg-ui-warning/15 text-ui-warning' : 'bg-ui-raised text-ui-muted'}`}>{finding.disposition === 'finding' ? finding.severity : 'Informational'}</span><span className='text-ui-muted'>{finding.host}:{finding.port} · {finding.assetAddress}</span></div>{evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Certificate details</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}</div>
    if (finding.provider === 'katana') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-raised px-2 py-0.5 font-semibold text-ui-muted'>Informational</span><span className='text-ui-muted'>{finding.assetAddress} · HTTP {finding.statusCode ?? 'unknown'}</span></div><p className='mt-1 break-all text-ui-muted'>{finding.url}</p></div>
    if (finding.provider === 'wafw00f') return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-raised px-2 py-0.5 font-semibold text-ui-muted'>Informational</span><span className='text-ui-muted'>{finding.assetAddress}</span></div><p className='mt-1 text-ui-muted'>{[finding.firewall, finding.manufacturer].filter(Boolean).join(' · ') || 'No WAF identified'}</p></div>
    return <div className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
        <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 font-semibold text-ui-warning'>{finding.severity}</span><span className='text-ui-muted'>{finding.provider === 'nuclei' ? `Template ${finding.templateId} · ${finding.assetAddress}` : `Plugin ${finding.pluginId} · ${finding.assetAddress}${finding.port ? `:${finding.port}` : ''}`}</span></div>
        {finding.provider === 'nuclei' && <p className='mt-1 text-ui-muted'>Matched: {finding.matchedAt} · {finding.tags.join(', ') || 'untagged'}</p>}
        {finding.cveIds.length > 0 && <p className='mt-1 text-ui-muted'>{finding.cveIds.join(', ')}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>}
        {finding.solution && <p className='mt-1'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {evidence && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
    </div>
}

export function EngineObservationList({ engine, observations }: { engine: string, observations?: Array<Record<string, unknown>> }) {
    if (!observations?.length) return <p className='mt-2 text-xs text-ui-muted'>No observations reported.</p>
    return <div className='mt-3 grid gap-2'><h4 className='text-xs font-semibold'>{engine} observations · {observations.length}</h4>{observations.map((item, index) => engine === 'httpx'
        ? <div key={String(item.id || index)} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold break-all'>{String(item.url || 'HTTPS root')} · {String(item.statusCode ?? 'status unknown')}</p><p className='text-ui-muted'>{String(item.address || '')}{item.title ? ` · ${String(item.title)}` : ''}</p><p className='text-ui-muted'>{[item.contentType, item.webServer, Array.isArray(item.technologies) ? item.technologies.join(', ') : null].filter(Boolean).join(' · ') || 'No technology metadata reported'}</p></div>
        : engine === 'tlsx'
            ? <div key={String(item.id || index)} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{String(item.hostname || '')}:{String(item.port || 443)} · {item.probeStatus ? 'TLS handshake succeeded' : 'TLS handshake not confirmed'}</p><p className='text-ui-muted'>{[item.tlsVersion, item.cipher, item.connectionMode].filter(Boolean).join(' · ') || 'TLS metadata unavailable'}</p><p className='text-ui-muted'>CN: {Array.isArray(item.subjectCommonNames) ? item.subjectCommonNames.join(', ') || 'not reported' : 'not reported'} · SAN: {Array.isArray(item.subjectAlternativeNames) ? item.subjectAlternativeNames.slice(0, 8).join(', ') || 'not reported' : 'not reported'}</p><p className='text-ui-muted'>Certificate valid to: {String(item.notAfter || 'unknown')}</p></div>
            : engine === 'katana'
                ? <div key={String(item.id || index)} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold break-all'>{String(item.method || 'GET')} {String(item.url || '')}</p><p className='text-ui-muted'>{String(item.address || '')} · HTTP {String(item.statusCode ?? 'unknown')}</p></div>
                : <div key={String(item.id || index)} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'><p className='font-semibold'>{item.detected ? 'WAF detected' : 'No WAF identified'}</p><p className='text-ui-muted'>{[item.firewall, item.manufacturer].filter(Boolean).join(' · ') || 'No product identified'} · {String(item.address || '')}</p><p className='text-ui-muted'>Informational detection signal only.</p></div>
    )}</div>
}
