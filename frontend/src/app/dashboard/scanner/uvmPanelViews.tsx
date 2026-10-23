'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { NmapScanProfile, UvmAsset, UvmDashboard, UvmEngineSelection, UvmFinding, UvmFindingHistoryPage } from '@/utils/monitoring/types'
import { useEffect, useState } from 'react'
import { formatDate, type UvmFindingFilters } from './uvmPanelHelpers'
import { DnsRecord, ScheduleControl, TenableScanControl } from './uvmPanelAssetControls'
import { UvmHelp } from './uvmPanelHelp'
export { UvmHelp } from './uvmPanelHelp'
export { UvmAssessmentStarter } from './uvmPanelAssessmentStarter'

export type AssetViewProps = {
    data: UvmDashboard
    servicesPaused?: boolean
    busy: string
    message: string
    hostname: string
    setHostname: Dispatch<SetStateAction<string>>
    authorization: Record<string, boolean>
    setAuthorization: Dispatch<SetStateAction<Record<string, boolean>>>
    intervals: Record<string, string>
    setIntervals: Dispatch<SetStateAction<Record<string, string>>>
    schedulePlans: Record<string, UvmEngineSelection[]>
    setSchedulePlans: Dispatch<SetStateAction<Record<string, UvmEngineSelection[]>>>
    scheduleProfiles: Record<string, NmapScanProfile>
    setScheduleProfiles: Dispatch<SetStateAction<Record<string, NmapScanProfile>>>
    assetNmapProfiles: Record<string, NmapScanProfile>
    setAssetNmapProfiles: Dispatch<SetStateAction<Record<string, NmapScanProfile>>>
    zapApiDefinitionPaths: Record<string, string>
    setZapApiDefinitionPaths: Dispatch<SetStateAction<Record<string, string>>>
    scheduleScanIds: Record<string, string>
    setScheduleScanIds: Dispatch<SetStateAction<Record<string, string>>>
    tenableScanIds: Record<string, string>
    setTenableScanIds: Dispatch<SetStateAction<Record<string, string>>>
    onRefresh: () => void
    onAddAsset: (event: FormEvent<HTMLFormElement>) => void
    onVerify: (assetId: string) => void
    onSaveZapApiDefinition: (asset: UvmAsset) => void
    onScan: (asset: UvmAsset) => void
    onScanWithTenable: (asset: UvmAsset) => void
    onScanWithGvm: (asset: UvmAsset) => void
    onScanWithZap: (asset: UvmAsset) => void
    onScanWithTestssl: (asset: UvmAsset) => void
    onScanWithNuclei: (asset: UvmAsset) => void
    onSchedule: (asset: UvmAsset, enabled: boolean) => void
}

export function UvmAssetsView(props: AssetViewProps) {
    const { data, busy, message, hostname, setHostname } = props

    return <>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <h2 className='text-lg font-semibold'>Assets</h2>
                <div className='flex items-center gap-2'><UvmHelp label='Asset verification' text='Verify domain control with DNS. Scans use only the asset’s current public IPv4 addresses after you confirm authorization.' /><button type='button' onClick={props.onRefresh} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Refresh</button></div>
            </div>
            <form onSubmit={props.onAddAsset} className='mt-4 flex flex-wrap gap-2'>
                <label className='sr-only' htmlFor='uvm-hostname'>Domain name</label>
                <input id='uvm-hostname' value={hostname} onChange={event => setHostname(event.target.value)} placeholder='example.com' className='h-10 min-w-56 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' />
                <button disabled={busy === 'add' || !hostname.trim()} className='h-10 rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'add' ? 'Adding…' : 'Add asset'}</button>
            </form>
            {message && <p role='status' className='mt-3 text-sm text-ui-primary'>{message}</p>}
        </section>
        <section className='grid gap-3'>
            {data.assets.map(asset => <AssetCard key={asset.id} asset={asset} props={props} />)}
            {!data.assets.length && <p className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>{data.scannerError ? 'Unavailable — Scanner data could not be loaded.' : 'No scan assets are registered yet.'}</p>}
        </section>
    </>
}

function AssetCard({ asset, props }: { asset: UvmAsset, props: AssetViewProps }) {
    const { data, busy, authorization, setAuthorization } = props
    const schedulePlan = props.schedulePlans[asset.id] || asset.schedulePlan || [{ engine: asset.scheduleEngine || 'nmap' }]
    const scheduleScanId = props.scheduleScanIds[asset.id] || schedulePlan.find(choice => choice.engine === 'tenable-vm')?.scanId || data.tenableScans.find(scan => scan.enabled)?.id || ''
    const tenableReady = data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.id === scheduleScanId && scan.enabled)
    const canScan = asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'nmap' && engine.status === 'available')
    const canSchedule = props.servicesPaused !== true && schedulePlan.length > 0 && schedulePlan.every(choice => choice.engine === 'nmap'
        ? canScan
        : choice.engine === 'tenable-vm'
            ? asset.verificationStatus === 'verified' && tenableReady
            : asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === choice.engine && engine.status === 'available'))
    const authorized = authorization[asset.id] === true

    return <article className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
                <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='text-base font-semibold'>{asset.hostname}</h3>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${asset.verificationStatus === 'verified' ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{asset.verificationStatus}</span>
                </div>
                <p className='mt-1 text-xs text-ui-muted'>{asset.verificationMethod === 'internal' ? 'Hanasand managed asset' : `Added ${formatDate(asset.createdAt)}`}{asset.scanAuthorizedAt ? ` · authorized IPs: ${asset.authorizedAddresses.join(', ') || 'none'}` : ''}</p>
            </div>
            <div className='flex items-center gap-2'><UvmHelp label={`${asset.hostname} verification`} text='A DNS TXT record proves control of this domain before network scans can run.' /><button type='button' onClick={() => props.onVerify(asset.id)} disabled={busy === asset.id || asset.verificationMethod === 'internal'} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === asset.id ? 'Working…' : 'Check DNS verification'}</button></div>
        </div>
        {asset.verificationMethod !== 'internal' && asset.verificationStatus !== 'verified' && <DnsRecord asset={asset} />}
        <div className='mt-3 flex flex-wrap items-end gap-2'>
            <label className='grid min-w-56 flex-1 gap-1 text-xs text-ui-muted'>OpenAPI definition path (optional)<input aria-label={`OpenAPI definition path for ${asset.hostname}`} value={props.zapApiDefinitionPaths[asset.id] ?? asset.zapApiDefinitionPath ?? ''} onChange={event => props.setZapApiDefinitionPaths(current => ({ ...current, [asset.id]: event.target.value }))} placeholder='/openapi.json' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></label>
            <UvmHelp label='OpenAPI definition' text='Use a root-relative path on this verified asset, such as /openapi.json. ZAP imports it through the same authorized origin and uses the definition for the web scan.' />
            <button type='button' onClick={() => props.onSaveZapApiDefinition(asset)} disabled={busy === `${asset.id}:zap-api`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `${asset.id}:zap-api` ? 'Saving…' : 'Save API path'}</button>
        </div>
        <div className='mt-3 flex flex-wrap items-end gap-3'>
            <label className='flex items-start gap-2 text-xs text-ui-muted'><input type='checkbox' checked={authorized} onChange={event => setAuthorization(current => ({ ...current, [asset.id]: event.target.checked }))} className='mt-0.5 accent-ui-primary' /><span>I authorize scans of this asset and its current public IPs.</span><UvmHelp label='Scan authorization' text='Confirm you have permission for this asset and every IP address returned by DNS. Scanner rechecks public IP scope when each scan starts.' /></label>
            <label className='grid gap-1 text-[11px] text-ui-muted'>Nmap profile<select aria-label={`Nmap profile for ${asset.hostname}`} value={props.assetNmapProfiles[asset.id] || 'tcp-top-1000'} onChange={event => props.setAssetNmapProfiles(current => ({ ...current, [asset.id]: event.target.value as NmapScanProfile }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP</option><option value='tcp-top-100'>Quick · top 100 TCP</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000 TCP</option><option value='tcp-all'>Thorough · all 65,535 TCP</option><option value='udp-top-100'>UDP · top 100</option></select>{props.assetNmapProfiles[asset.id] === 'tcp-all' && <small className='text-ui-warning'>Full sweep · up to 20 min/address.</small>}{props.assetNmapProfiles[asset.id] === 'udp-top-100' && <small className='text-ui-warning'>Includes ambiguous open|filtered results.</small>}</label>
            {props.assetNmapProfiles[asset.id] === 'tcp-top-1000-safe-vuln' && <UvmHelp label='Nmap NSE checks' text='Runs scripts tagged both safe and vuln. Nmap cannot guarantee no adverse effects. Results are heuristic evidence and do not confirm exploitability.' />}
            <button type='button' onClick={() => props.onScan(asset)} disabled={busy === asset.id || !canScan || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Run Nmap</button>
            {data.tenableIntegration?.configured && data.tenableScans.length > 0 && <TenableScanControl asset={asset} props={props} />}
            {data.engines.some(engine => engine.id === 'gvm' && engine.status === 'available') && <button type='button' onClick={() => props.onScanWithGvm(asset)} disabled={busy === `${asset.id}:gvm` || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `${asset.id}:gvm` ? 'Queueing…' : 'Run Greenbone scan'}</button>}
            {data.engines.some(engine => engine.id === 'zap' && engine.status === 'available') && <button type='button' onClick={() => props.onScanWithZap(asset)} disabled={busy === `${asset.id}:zap` || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `${asset.id}:zap` ? 'Queueing…' : 'Run ZAP web scan'}</button>}
            {data.engines.some(engine => engine.id === 'testssl') && <button type='button' onClick={() => props.onScanWithTestssl(asset)} disabled={props.servicesPaused || busy === `${asset.id}:testssl` || data.engines.find(engine => engine.id === 'testssl')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'TestSSL · stopped pending disk' : busy === `${asset.id}:testssl` ? 'Queueing…' : 'Run TestSSL checks'}</button>}
            {data.engines.some(engine => engine.id === 'nuclei') && <button type='button' onClick={() => props.onScanWithNuclei(asset)} disabled={props.servicesPaused || busy === `${asset.id}:nuclei` || data.engines.find(engine => engine.id === 'nuclei')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Nuclei · stopped pending disk' : busy === `${asset.id}:nuclei` ? 'Queueing…' : 'Run Nuclei safe checks'}</button>}
            <ScheduleControl asset={asset} props={props} canSchedule={canSchedule} schedulePlan={schedulePlan} scheduleScanId={scheduleScanId} />
        </div>
    </article>
}

type FindingsViewProps = {
    data: UvmDashboard
    attentionCount: number
    busy: string
    filters: UvmFindingFilters
    setFilters: Dispatch<SetStateAction<UvmFindingFilters>>
    visibleFindings: UvmFinding[]
    findingUpdates: Record<string, { status: UvmFinding['status'], note: string }>
    setFindingUpdates: Dispatch<SetStateAction<Record<string, { status: UvmFinding['status'], note: string }>>>
    onUpdate: (finding: UvmFinding) => void
    nextCursor: string | null
    loadOlder: (cursor: string | null) => Promise<UvmFindingHistoryPage>
}

export function UvmFindingsView(props: FindingsViewProps) {
    const { data, attentionCount, busy, filters, setFilters, visibleFindings, findingUpdates, setFindingUpdates } = props
    const [cursor, setCursor] = useState(props.nextCursor)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [loadError, setLoadError] = useState('')
    useEffect(() => { setCursor(props.nextCursor) }, [props.nextCursor])
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>Findings</h2>
            <div className='flex items-center gap-2'><UvmHelp label='Finding coverage' text='Findings retain their source, asset and evidence. An empty list does not mean an asset is clear if a scan is missing or partial.' /><span className='rounded-full bg-ui-warning/15 px-2 py-1 text-xs font-semibold text-ui-warning'>{attentionCount} open</span></div>
        </div>
        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
            <label className='grid gap-1 text-xs text-ui-muted sm:col-span-2 xl:col-span-1'>Search findings<input aria-label='Search findings' value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder='Title, asset, CVE…' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Scanner<select aria-label='Filter by scanner' value={filters.engine} onChange={event => setFilters(current => ({ ...current, engine: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All scanners</option>{data.engines.map(engine => <option key={engine.id} value={engine.id}>{engine.name}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Severity<select aria-label='Filter by severity' value={filters.severity} onChange={event => setFilters(current => ({ ...current, severity: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All severities</option>{['critical', 'high', 'medium', 'low', 'info', 'unknown'].map(severity => <option key={severity} value={severity}>{severity}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Status<select aria-label='Filter by status' value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='actionable'>Unresolved</option><option value='all'>All statuses</option><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option><option value='resolved'>Resolved</option></select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Asset<select aria-label='Filter by asset' value={filters.asset} onChange={event => setFilters(current => ({ ...current, asset: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All assets</option>{[...new Map(data.findings.map(finding => [finding.assetId || finding.asset, finding.asset])).entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'><p aria-live='polite'>{data.scannerError ? 'Finding counts unavailable' : `${visibleFindings.length} shown · ${data.findings.length} loaded`}</p><p>Sorted by severity, status, then age.</p></div>
        <div className='mt-3 grid gap-3'>
            {visibleFindings.map(finding => <FindingCard key={finding.id} finding={finding} busy={busy} update={findingUpdates[finding.id] || { status: finding.status, note: finding.triageNote || '' }} setFindingUpdates={setFindingUpdates} onUpdate={() => props.onUpdate(finding)} />)}
            {!data.findings.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{data.scannerError ? 'Unavailable — Scanner data could not be loaded.' : 'No findings imported. Check authorization, engine status and scan coverage before treating this as clear.'}</p>}
            {data.findings.length > 0 && !visibleFindings.length && <div className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'><p>No findings match these filters.</p><button type='button' onClick={() => setFilters({ query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Clear filters</button></div>}
        </div>
        {loadError && <p role='status' className='mt-3 text-sm text-ui-warning'>{loadError}</p>}
        {cursor && <button type='button' disabled={loadingOlder} onClick={() => {
            setLoadingOlder(true); setLoadError('')
            void props.loadOlder(cursor).then(result => setCursor(result.nextCursor))
                .catch(error => setLoadError(error instanceof Error ? error.message : 'Older findings could not be loaded.'))
                .finally(() => setLoadingOlder(false))
        }} className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold disabled:opacity-50'>{loadingOlder ? 'Loading…' : 'Load older findings'}</button>}
    </section>
}

function FindingCard({ finding, busy, update, setFindingUpdates, onUpdate }: {
    finding: UvmFinding
    busy: string
    update: { status: UvmFinding['status'], note: string }
    setFindingUpdates: FindingsViewProps['setFindingUpdates']
    onUpdate: () => void
}) {
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
                <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>{finding.severity}</span><span className='text-xs text-ui-muted'>{finding.engine}</span></div>
                <p className='mt-1 text-xs text-ui-muted'>{finding.asset}{finding.address ? ` · ${finding.address}` : ''}{finding.cveIds.length ? ` · ${finding.cveIds.join(', ')}` : ''}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>
            </div>
            <span className='text-xs font-semibold'>{finding.status.replaceAll('_', ' ')}</span>
        </div>
        {finding.description && <details className='mt-2 text-sm'><summary className='cursor-pointer text-ui-muted'>Description</summary><p className='mt-1'>{finding.description}</p></details>}
        {finding.solution && <details className='mt-2 text-sm'><summary className='cursor-pointer text-ui-muted'>Suggested fix</summary><p className='mt-1'>{finding.solution}</p></details>}
        {finding.evidence && <details className='mt-2 text-xs'><summary className='cursor-pointer text-ui-muted'>Scanner evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}
        {finding.status !== 'resolved' && <div className='mt-3 flex flex-wrap items-end gap-2'>
            <label className='grid gap-1 text-[11px] text-ui-muted'>Status<select value={update.status} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, status: event.target.value as UvmFinding['status'] } }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option></select></label>
            <label className='grid min-w-52 flex-1 gap-1 text-[11px] text-ui-muted'>Triage note<input value={update.note} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, note: event.target.value } }))} maxLength={2000} placeholder='Reason or remediation context' className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label>
            <button type='button' onClick={onUpdate} disabled={busy === `finding:${finding.id}`} className='h-8 rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>{busy === `finding:${finding.id}` ? 'Saving…' : 'Save triage'}</button>
        </div>}
        {finding.status === 'pending_verification' && <p className='mt-2 text-xs text-ui-muted'>This finding will resolve after a later successful scan confirms it is no longer present.</p>}
        <p className='mt-2 text-[11px] text-ui-muted'>First seen {formatDate(finding.firstSeen)} · Last seen {formatDate(finding.lastSeen)}</p>
    </article>
}
