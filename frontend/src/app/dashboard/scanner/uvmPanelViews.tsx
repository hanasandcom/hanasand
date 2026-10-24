'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { NetworkScanProfile, NmapScanProfile, UvmAsset, UvmAssetCriticality, UvmDashboard, UvmEngineSelection } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import { AssetCriticalityControl, DnsRecord, ScheduleControl, TenableScanControl } from './uvmPanelAssetControls'
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
    scheduleProfiles: Record<string, NetworkScanProfile>
    setScheduleProfiles: Dispatch<SetStateAction<Record<string, NetworkScanProfile>>>
    assetNmapProfiles: Record<string, NmapScanProfile>
    setAssetNmapProfiles: Dispatch<SetStateAction<Record<string, NmapScanProfile>>>
    zapApiDefinitionPaths: Record<string, string>
    setZapApiDefinitionPaths: Dispatch<SetStateAction<Record<string, string>>>
    onSaveCriticality: (asset: UvmAsset, criticality: UvmAssetCriticality) => void
    scheduleScanIds: Record<string, string>
    setScheduleScanIds: Dispatch<SetStateAction<Record<string, string>>>
    tenableScanIds: Record<string, string>
    setTenableScanIds: Dispatch<SetStateAction<Record<string, string>>>
    onRefresh: () => void
    onAddAsset: (event: FormEvent<HTMLFormElement>) => void
    onVerify: (assetId: string) => void
    onSaveZapApiDefinition: (asset: UvmAsset) => void
    onScan: (asset: UvmAsset) => void
    onScanWithNaabu: (asset: UvmAsset) => void
    onScanWithAngryIp: (asset: UvmAsset) => void
    onScanWithTenable: (asset: UvmAsset) => void
    onScanWithGvm: (asset: UvmAsset) => void
    onScanWithZap: (asset: UvmAsset) => void
    onScanWithTestssl: (asset: UvmAsset) => void
    onScanWithNuclei: (asset: UvmAsset) => void
    onScanWithNikto: (asset: UvmAsset) => void
    onScanWithSslyze: (asset: UvmAsset) => void
    onScanWithWapiti: (asset: UvmAsset) => void
    onScanWithWhatweb: (asset: UvmAsset) => void
    onScanWithHttpx: (asset: UvmAsset) => void
    onScanWithTlsx: (asset: UvmAsset) => void
    onScanWithKatana: (asset: UvmAsset) => void
    onScanWithWafw00f: (asset: UvmAsset) => void
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
    const canScan = props.servicesPaused !== true && asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'nmap' && engine.status === 'available')
    const canNaabu = props.servicesPaused !== true && asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'naabu' && engine.status === 'available')
    const canAngryIp = props.servicesPaused !== true && asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'angry-ip-scanner' && engine.status === 'available')
    const canSchedule = props.servicesPaused !== true && schedulePlan.length > 0 && schedulePlan.every(choice => choice.engine === 'nmap'
        ? canScan
        : choice.engine === 'naabu'
            ? canNaabu
            : choice.engine === 'angry-ip-scanner'
                ? canAngryIp
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
        <AssetCriticalityControl asset={asset} props={props} />
        {asset.verificationMethod !== 'internal' && asset.verificationStatus !== 'verified' && <DnsRecord asset={asset} />}
        <details className='mt-3 border-t border-ui-border pt-3'>
            <summary className='cursor-pointer text-sm font-medium text-ui-muted'>Scan controls & schedule</summary>
            <div className='flex flex-wrap items-end gap-2'>
                <label className='grid min-w-56 flex-1 gap-1 text-xs text-ui-muted'>OpenAPI definition path (optional)<input aria-label={`OpenAPI definition path for ${asset.hostname}`} value={props.zapApiDefinitionPaths[asset.id] ?? asset.zapApiDefinitionPath ?? ''} onChange={event => props.setZapApiDefinitionPaths(current => ({ ...current, [asset.id]: event.target.value }))} placeholder='/openapi.json' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></label>
                <UvmHelp label='OpenAPI definition' text='Use a root-relative path on this verified asset, such as /openapi.json. ZAP imports it through the same authorized origin and uses the definition for the web scan.' />
                <button type='button' onClick={() => props.onSaveZapApiDefinition(asset)} disabled={busy === `${asset.id}:zap-api`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `${asset.id}:zap-api` ? 'Saving…' : 'Save API path'}</button>
            </div>
            <div className='mt-3 flex flex-wrap items-end gap-3'>
                <label className='flex items-start gap-2 text-xs text-ui-muted'><input type='checkbox' checked={authorized} onChange={event => setAuthorization(current => ({ ...current, [asset.id]: event.target.checked }))} className='mt-0.5 accent-ui-primary' /><span>I authorize scans of this asset and its current public IPs.</span><UvmHelp label='Scan authorization' text='Confirm you have permission for this asset and every IP address returned by DNS. Scanner rechecks public IP scope when each scan starts.' /></label>
                <label className='grid gap-1 text-[11px] text-ui-muted'>Nmap profile<select aria-label={`Nmap profile for ${asset.hostname}`} value={props.assetNmapProfiles[asset.id] || 'tcp-top-1000'} onChange={event => props.setAssetNmapProfiles(current => ({ ...current, [asset.id]: event.target.value as NmapScanProfile }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP</option><option value='tcp-top-100'>Quick · top 100 TCP</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000 TCP</option><option value='tcp-all'>Thorough · all 65,535 TCP</option><option value='udp-top-100'>UDP · top 100</option></select>{props.assetNmapProfiles[asset.id] === 'tcp-all' && <small className='text-ui-warning'>Full sweep · up to 20 min/address.</small>}{props.assetNmapProfiles[asset.id] === 'udp-top-100' && <small className='text-ui-warning'>Includes ambiguous open|filtered results.</small>}</label>
                {props.assetNmapProfiles[asset.id] === 'tcp-top-1000-safe-vuln' && <UvmHelp label='Nmap NSE checks' text='Runs scripts tagged both safe and vuln. Nmap cannot guarantee no adverse effects. Results are heuristic evidence and do not confirm exploitability.' />}
                <button type='button' onClick={() => props.onScan(asset)} disabled={busy === asset.id || !canScan || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Run Nmap</button>
                {data.engines.some(engine => engine.id === 'naabu') && <button type='button' onClick={() => props.onScanWithNaabu(asset)} disabled={busy === `${asset.id}:naabu` || !canNaabu || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Naabu · stopped pending disk' : busy === `${asset.id}:naabu` ? 'Queueing…' : 'Run Naabu'}</button>}
                {data.engines.some(engine => engine.id === 'angry-ip-scanner') && <button type='button' onClick={() => props.onScanWithAngryIp(asset)} disabled={busy === `${asset.id}:angry-ip-scanner` || !canAngryIp || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Angry IP · stopped pending disk' : busy === `${asset.id}:angry-ip-scanner` ? 'Queueing…' : 'Run Angry IP reachability'}</button>}
                {data.tenableIntegration?.configured && data.tenableScans.length > 0 && <TenableScanControl asset={asset} props={props} />}
                {data.engines.some(engine => engine.id === 'gvm' && engine.status === 'available') && <button type='button' onClick={() => props.onScanWithGvm(asset)} disabled={props.servicesPaused === true || busy === `${asset.id}:gvm` || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Greenbone · stopped pending disk' : busy === `${asset.id}:gvm` ? 'Queueing…' : 'Run Greenbone scan'}</button>}
                {data.engines.some(engine => engine.id === 'zap' && engine.status === 'available') && <button type='button' onClick={() => props.onScanWithZap(asset)} disabled={props.servicesPaused === true || busy === `${asset.id}:zap` || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'ZAP · stopped pending disk' : busy === `${asset.id}:zap` ? 'Queueing…' : 'Run ZAP web scan'}</button>}
                {data.engines.some(engine => engine.id === 'testssl') && <button type='button' onClick={() => props.onScanWithTestssl(asset)} disabled={props.servicesPaused || busy === `${asset.id}:testssl` || data.engines.find(engine => engine.id === 'testssl')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'TestSSL · stopped pending disk' : busy === `${asset.id}:testssl` ? 'Queueing…' : 'Run TestSSL checks'}</button>}
                {data.engines.some(engine => engine.id === 'nuclei') && <button type='button' onClick={() => props.onScanWithNuclei(asset)} disabled={props.servicesPaused || busy === `${asset.id}:nuclei` || data.engines.find(engine => engine.id === 'nuclei')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Nuclei · stopped pending disk' : busy === `${asset.id}:nuclei` ? 'Queueing…' : 'Run Nuclei safe checks'}</button>}
                {data.engines.some(engine => engine.id === 'nikto') && <button type='button' onClick={() => props.onScanWithNikto(asset)} disabled={props.servicesPaused || busy === `${asset.id}:nikto` || data.engines.find(engine => engine.id === 'nikto')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Nikto · stopped pending disk' : busy === `${asset.id}:nikto` ? 'Queueing…' : 'Run Nikto safe checks'}</button>}
                {data.engines.some(engine => engine.id === 'sslyze') && <button type='button' onClick={() => props.onScanWithSslyze(asset)} disabled={props.servicesPaused || busy === `${asset.id}:sslyze` || data.engines.find(engine => engine.id === 'sslyze')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'SSLyze · stopped pending disk' : busy === `${asset.id}:sslyze` ? 'Queueing…' : 'Run SSLyze TLS checks'}</button>}
                {data.engines.some(engine => engine.id === 'wapiti') && <button type='button' onClick={() => props.onScanWithWapiti(asset)} disabled={props.servicesPaused || busy === `${asset.id}:wapiti` || data.engines.find(engine => engine.id === 'wapiti')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Wapiti · stopped pending disk' : busy === `${asset.id}:wapiti` ? 'Queueing…' : 'Run Wapiti passive checks'}</button>}
                {data.engines.some(engine => engine.id === 'whatweb') && <button type='button' onClick={() => props.onScanWithWhatweb(asset)} disabled={props.servicesPaused || busy === `${asset.id}:whatweb` || data.engines.find(engine => engine.id === 'whatweb')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'WhatWeb · stopped pending disk' : busy === `${asset.id}:whatweb` ? 'Queueing…' : 'Run WhatWeb fingerprint'}</button>}
                {data.engines.some(engine => engine.id === 'httpx') && <button type='button' onClick={() => props.onScanWithHttpx(asset)} disabled={props.servicesPaused || busy === `${asset.id}:httpx` || data.engines.find(engine => engine.id === 'httpx')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'httpx · stopped pending disk' : busy === `${asset.id}:httpx` ? 'Queueing…' : 'Run httpx root probe'}</button>}
                {data.engines.some(engine => engine.id === 'tlsx') && <button type='button' onClick={() => props.onScanWithTlsx(asset)} disabled={props.servicesPaused || busy === `${asset.id}:tlsx` || data.engines.find(engine => engine.id === 'tlsx')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'tlsx · stopped pending disk' : busy === `${asset.id}:tlsx` ? 'Queueing…' : 'Run tlsx TLS metadata'}</button>}
                {data.engines.some(engine => engine.id === 'katana') && <button type='button' onClick={() => props.onScanWithKatana(asset)} disabled={props.servicesPaused || busy === `${asset.id}:katana` || data.engines.find(engine => engine.id === 'katana')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'Katana · stopped pending disk' : busy === `${asset.id}:katana` ? 'Queueing…' : 'Run Katana crawl'}</button>}
                {data.engines.some(engine => engine.id === 'wafw00f') && <button type='button' onClick={() => props.onScanWithWafw00f(asset)} disabled={props.servicesPaused || busy === `${asset.id}:wafw00f` || data.engines.find(engine => engine.id === 'wafw00f')?.status !== 'available' || asset.verificationStatus !== 'verified' || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{props.servicesPaused ? 'WAFW00F · stopped pending disk' : busy === `${asset.id}:wafw00f` ? 'Queueing…' : 'Run WAFW00F detection'}</button>}
                <ScheduleControl asset={asset} props={props} canSchedule={canSchedule} schedulePlan={schedulePlan} scheduleScanId={scheduleScanId} />
            </div>
        </details>
    </article>
}

export { UvmFindingsView } from './uvmPanelFindingsView'
