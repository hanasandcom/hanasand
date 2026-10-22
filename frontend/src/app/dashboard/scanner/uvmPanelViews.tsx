'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { HelpCircle } from 'lucide-react'
import type { UvmAsset, UvmDashboard, UvmFinding } from '@/utils/monitoring/types'
import { formatDate, type UvmFindingFilters } from './uvmPanelHelpers'
import { DnsRecord, ScheduleControl, TenableScanControl } from './uvmPanelAssetControls'

export type AssetViewProps = {
    data: UvmDashboard
    servicePaused?: boolean
    busy: string
    message: string
    hostname: string
    setHostname: Dispatch<SetStateAction<string>>
    authorization: Record<string, boolean>
    setAuthorization: Dispatch<SetStateAction<Record<string, boolean>>>
    intervals: Record<string, string>
    setIntervals: Dispatch<SetStateAction<Record<string, string>>>
    scheduleEngines: Record<string, 'nmap' | 'tenable-vm' | 'gvm'>
    setScheduleEngines: Dispatch<SetStateAction<Record<string, 'nmap' | 'tenable-vm' | 'gvm'>>>
    scheduleProfiles: Record<string, 'tcp-top-100' | 'tcp-top-1000'>
    setScheduleProfiles: Dispatch<SetStateAction<Record<string, 'tcp-top-100' | 'tcp-top-1000'>>>
    assetNmapProfiles: Record<string, 'tcp-top-100' | 'tcp-top-1000'>
    setAssetNmapProfiles: Dispatch<SetStateAction<Record<string, 'tcp-top-100' | 'tcp-top-1000'>>>
    scheduleScanIds: Record<string, string>
    setScheduleScanIds: Dispatch<SetStateAction<Record<string, string>>>
    tenableScanIds: Record<string, string>
    setTenableScanIds: Dispatch<SetStateAction<Record<string, string>>>
    onRefresh: () => void
    onAddAsset: (event: FormEvent<HTMLFormElement>) => void
    onVerify: (assetId: string) => void
    onScan: (asset: UvmAsset) => void
    onScanWithTenable: (asset: UvmAsset) => void
    onSchedule: (asset: UvmAsset, enabled: boolean) => void
}

export function UvmAssetsView(props: AssetViewProps) {
    const { data, busy, message, hostname, setHostname } = props

    return <>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <h2 className='text-lg font-semibold'>Assets</h2>
                <div className='flex items-center gap-2'><UvmHelp label='Asset verification' text='Verify domain control with DNS. Scans use only the asset’s current public IPv4 addresses after you confirm authorization.' /><button type='button' onClick={props.onRefresh} disabled={props.servicePaused} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>Refresh</button></div>
            </div>
            <form onSubmit={props.onAddAsset} className='mt-4 flex flex-wrap gap-2'>
                <label className='sr-only' htmlFor='uvm-hostname'>Domain name</label>
                <input id='uvm-hostname' value={hostname} onChange={event => setHostname(event.target.value)} placeholder='example.com' disabled={props.servicePaused} className='h-10 min-w-56 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' />
                <button disabled={props.servicePaused || busy === 'add' || !hostname.trim()} className='h-10 rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'add' ? 'Adding…' : 'Add asset'}</button>
            </form>
            {message && <p role='status' className='mt-3 text-sm text-ui-primary'>{message}</p>}
        </section>
        <section className='grid gap-3'>
            {data.assets.map(asset => <AssetCard key={asset.id} asset={asset} props={props} />)}
            {!data.assets.length && <p className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>No scan assets are registered yet.</p>}
        </section>
    </>
}

function AssetCard({ asset, props }: { asset: UvmAsset, props: AssetViewProps }) {
    const { data, busy, authorization, setAuthorization } = props
    const scheduleEngine = props.scheduleEngines[asset.id] || asset.scheduleEngine || 'nmap'
    const scheduleScanId = props.scheduleScanIds[asset.id] || asset.scheduleScanId || data.tenableScans.find(scan => scan.enabled)?.id || ''
    const tenableReady = data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.id === scheduleScanId && scan.enabled)
    const canScan = asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'nmap' && engine.status === 'available')
    const canSchedule = scheduleEngine === 'nmap'
        ? canScan
        : scheduleEngine === 'tenable-vm'
            ? asset.verificationStatus === 'verified' && tenableReady
            : asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'gvm' && engine.status === 'available')
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
            <div className='flex items-center gap-2'><UvmHelp label={`${asset.hostname} verification`} text='A DNS TXT record proves control of this domain before network scans can run.' /><button type='button' onClick={() => props.onVerify(asset.id)} disabled={props.servicePaused || busy === asset.id || asset.verificationMethod === 'internal'} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === asset.id ? 'Working…' : 'Check DNS verification'}</button></div>
        </div>
        {asset.verificationMethod !== 'internal' && asset.verificationStatus !== 'verified' && <DnsRecord asset={asset} />}
        <fieldset disabled={props.servicePaused} aria-label={`${asset.hostname} scan controls`} className='mt-3 flex flex-wrap items-end gap-3 disabled:opacity-60'>
            <label className='flex items-start gap-2 text-xs text-ui-muted'><input type='checkbox' checked={authorized} onChange={event => setAuthorization(current => ({ ...current, [asset.id]: event.target.checked }))} className='mt-0.5 accent-ui-primary' /><span>I am authorized to scan this asset and its currently resolved IP addresses.</span></label>
            <label className='grid gap-1 text-[11px] text-ui-muted'>Nmap coverage<select aria-label={`Nmap coverage for ${asset.hostname}`} value={props.assetNmapProfiles[asset.id] || 'tcp-top-1000'} onChange={event => props.setAssetNmapProfiles(current => ({ ...current, [asset.id]: event.target.value as 'tcp-top-100' | 'tcp-top-1000' }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000</option><option value='tcp-top-100'>Quick · top 100</option></select></label>
            <button type='button' onClick={() => props.onScan(asset)} disabled={busy === asset.id || !canScan || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Run Nmap inventory</button>
            {data.tenableIntegration?.configured && data.tenableScans.length > 0 && <TenableScanControl asset={asset} props={props} />}
            <ScheduleControl asset={asset} props={props} canSchedule={canSchedule} scheduleEngine={scheduleEngine} scheduleScanId={scheduleScanId} />
        </fieldset>
    </article>
}

type FindingsViewProps = {
    data: UvmDashboard
    servicePaused?: boolean
    attentionCount: number
    busy: string
    filters: UvmFindingFilters
    setFilters: Dispatch<SetStateAction<UvmFindingFilters>>
    visibleFindings: UvmFinding[]
    findingUpdates: Record<string, { status: UvmFinding['status'], note: string }>
    setFindingUpdates: Dispatch<SetStateAction<Record<string, { status: UvmFinding['status'], note: string }>>>
    onUpdate: (finding: UvmFinding) => void
}

export function UvmFindingsView(props: FindingsViewProps) {
    const { data, attentionCount, busy, filters, setFilters, visibleFindings, findingUpdates, setFindingUpdates } = props
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>Findings</h2>
            <div className='flex items-center gap-2'><UvmHelp label='Finding coverage' text='Findings retain their source, asset and evidence. An empty list does not mean an asset is clear if a scan is missing or partial.' /><span className='rounded-full bg-ui-warning/15 px-2 py-1 text-xs font-semibold text-ui-warning'>{attentionCount} open</span></div>
        </div>
        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
            <label className='grid gap-1 text-xs text-ui-muted sm:col-span-2 xl:col-span-1'>Search findings<input aria-label='Search findings' value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder='Title, asset, CVE…' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Scanner<select aria-label='Filter by scanner' value={filters.engine} onChange={event => setFilters(current => ({ ...current, engine: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All scanners</option>{[...new Set(data.findings.map(finding => finding.engine))].sort().map(engine => <option key={engine} value={engine}>{engine}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Severity<select aria-label='Filter by severity' value={filters.severity} onChange={event => setFilters(current => ({ ...current, severity: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All severities</option>{['critical', 'high', 'medium', 'low', 'info', 'unknown'].map(severity => <option key={severity} value={severity}>{severity}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Status<select aria-label='Filter by status' value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='actionable'>Unresolved</option><option value='all'>All statuses</option><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option><option value='resolved'>Resolved</option></select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Asset<select aria-label='Filter by asset' value={filters.asset} onChange={event => setFilters(current => ({ ...current, asset: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All assets</option>{[...new Map(data.findings.map(finding => [finding.assetId || finding.asset, finding.asset])).entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'><p aria-live='polite'>{visibleFindings.length} shown · {data.findings.length} loaded</p><p>Sorted by severity, status, then age.</p></div>
        <div className='mt-3 grid gap-3'>
            {visibleFindings.map(finding => <FindingCard key={finding.id} finding={finding} busy={busy} servicePaused={props.servicePaused} update={findingUpdates[finding.id] || { status: finding.status, note: finding.triageNote || '' }} setFindingUpdates={setFindingUpdates} onUpdate={() => props.onUpdate(finding)} />)}
            {!data.findings.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>No findings imported. Check authorization, engine status and scan coverage before treating this as clear.</p>}
            {data.findings.length > 0 && !visibleFindings.length && <div className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'><p>No findings match these filters.</p><button type='button' onClick={() => setFilters({ query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Clear filters</button></div>}
        </div>
    </section>
}

export function UvmAssessmentStarter({ data, actionsAvailable = true, onManageAssets, onConfigureScanners, onStartAssessment }: {
    data: UvmDashboard
    actionsAvailable?: boolean
    onManageAssets: () => void
    onConfigureScanners: () => void
    onStartAssessment: () => void
}) {
    const verifiedAssets = data.assets.filter(asset => asset.verificationStatus === 'verified').length
    const tenableReady = data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled)
    const selectable = (engine: UvmDashboard['engines'][number]) => engine.status === 'available' && (engine.id !== 'tenable-vm' || tenableReady)
    const readyEngines = data.engines.filter(selectable)
    const unavailableEngines = data.engines.filter(engine => !selectable(engine))
    const nextAction = !verifiedAssets ? onManageAssets : readyEngines.length ? onStartAssessment : onConfigureScanners
    const nextLabel = !verifiedAssets ? 'Add and verify an asset' : readyEngines.length ? 'Choose scope and scanners' : 'Configure a scanner'

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
            <div className='flex items-center gap-2'>
                <h2 className='text-base font-semibold'>Assessment readiness</h2>
            </div>
            <div className='flex items-center gap-2'><UvmHelp label='Assessment scope and engines' text='DNS is rechecked at launch. Nmap inventories TCP services; GVM and Tenable VM check vulnerabilities. Standalone Nessus Pro is not connected. Scans do not validate exploitability.' /><button type='button' onClick={nextAction} disabled={!actionsAvailable && nextAction === onStartAssessment} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{nextLabel}</button></div>
        </div>
        {actionsAvailable
            ? <p className='mt-2 text-sm text-ui-muted'>{verifiedAssets} verified asset{verifiedAssets === 1 ? '' : 's'} · {readyEngines.length} engines ready · {unavailableEngines.length} unavailable</p>
            : <p className='mt-2 text-sm text-ui-warning'>Scanner data is unavailable while services are paused.</p>}
        {actionsAvailable && !readyEngines.length && <p className='mt-2 text-sm text-ui-warning'>{data.scannerError || 'Configure an engine to continue.'} <button type='button' onClick={onConfigureScanners} className='font-semibold underline underline-offset-2'>Scanner setup</button></p>}
        {actionsAvailable && unavailableEngines.length > 0 && <ul className='mt-2 grid gap-1 text-xs text-ui-warning' aria-label='Unavailable scanners'>{unavailableEngines.map(engine => <li key={engine.id}><span className='font-semibold'>{engine.name}:</span> {engine.id === 'tenable-vm' && !tenableReady ? 'Connect Tenable VM and enable a network scan configuration.' : engine.reason || engine.status}</li>)}</ul>}
    </section>
}

export function UvmHelp({ label, text }: { label: string, text: string }) {
    return <details className='relative inline-flex shrink-0 text-ui-muted'>
        <summary aria-label={`About ${label}`} className='grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-ui-border text-xs font-semibold hover:bg-ui-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <HelpCircle aria-hidden='true' className='h-4 w-4' />
        </summary>
        <p className='absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-ui-border bg-ui-panel p-3 text-xs leading-5 text-ui-text shadow-lg'>{text}</p>
    </details>
}

function FindingCard({ finding, busy, servicePaused = false, update, setFindingUpdates, onUpdate }: {
    finding: UvmFinding
    busy: string
    servicePaused?: boolean
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
        {finding.description && <p className='mt-2 text-sm'>{finding.description}</p>}
        {finding.solution && <p className='mt-2 text-sm'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}
        {finding.evidence && <details className='mt-2 text-xs'><summary className='cursor-pointer text-ui-muted'>Scanner evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}
        {finding.status !== 'resolved' && <div className='mt-3 flex flex-wrap items-end gap-2'>
            <label className='grid gap-1 text-[11px] text-ui-muted'>Status<select disabled={servicePaused} value={update.status} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, status: event.target.value as UvmFinding['status'] } }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text disabled:opacity-60'><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option></select></label>
            <label className='grid min-w-52 flex-1 gap-1 text-[11px] text-ui-muted'>Triage note<input disabled={servicePaused} value={update.note} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, note: event.target.value } }))} maxLength={2000} placeholder='Reason or remediation context' className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text disabled:opacity-60' /></label>
            <button type='button' onClick={onUpdate} disabled={servicePaused || busy === `finding:${finding.id}`} className='h-8 rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>{busy === `finding:${finding.id}` ? 'Saving…' : 'Save triage'}</button>
        </div>}
        {finding.status === 'pending_verification' && <p className='mt-2 text-xs text-ui-muted'>This finding will resolve after a later successful scan confirms it is no longer present.</p>}
        <p className='mt-2 text-[11px] text-ui-muted'>First seen {formatDate(finding.firstSeen)} · Last seen {formatDate(finding.lastSeen)}</p>
    </article>
}
