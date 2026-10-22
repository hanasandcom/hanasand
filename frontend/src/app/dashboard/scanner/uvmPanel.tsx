'use client'

import { useEffect, useState } from 'react'
import type { UvmAsset, UvmDashboard, UvmFinding, UvmRun } from '@/utils/monitoring/types'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import UvmRunCard from './uvmRunCard'

export default function UvmPanel({ initialData, refreshAction, createAssetAction, verifyAssetAction, runScanAction, scheduleAction, configureTenableAction, disconnectTenableAction, runTenableScanAction, updateFindingAction, cancelRunAction }: {
    initialData: UvmDashboard
    refreshAction: () => Promise<UvmDashboard>
    createAssetAction: (input: { hostname: string }) => Promise<{ asset: UvmAsset }>
    verifyAssetAction: (assetId: string) => Promise<{ asset: UvmAsset }>
    runScanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    scheduleAction: (assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engine: 'nmap' | 'tenable-vm', scanId?: string }) => Promise<{ asset: UvmAsset }>
    configureTenableAction: (input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    disconnectTenableAction: () => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    runTenableScanAction: (assetId: string, scanId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    updateFindingAction: (findingId: string, input: { status: UvmFinding['status'], note: string }) => Promise<unknown>
    cancelRunAction: (runId: string) => Promise<{ run: UvmRun }>
}) {
    const [data, setData] = useState(initialData)
    const [hostname, setHostname] = useState('')
    const [authorization, setAuthorization] = useState<Record<string, boolean>>({})
    const [intervals, setIntervals] = useState<Record<string, string>>({})
    const [scheduleEngines, setScheduleEngines] = useState<Record<string, 'nmap' | 'tenable-vm'>>({})
    const [scheduleScanIds, setScheduleScanIds] = useState<Record<string, string>>({})
    const [tenableRegion, setTenableRegion] = useState<'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp'>('us')
    const [tenableAccessKey, setTenableAccessKey] = useState('')
    const [tenableSecretKey, setTenableSecretKey] = useState('')
    const [tenableScanIds, setTenableScanIds] = useState<Record<string, string>>({})
    const [findingUpdates, setFindingUpdates] = useState<Record<string, { status: UvmFinding['status'], note: string }>>({})
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [view, setView] = useState<'overview' | 'assets' | 'scanners' | 'runs' | 'findings'>('overview')
    const activeRuns = data.runs.filter(run => ['queued', 'launching', 'running', 'exporting'].includes(run.status))
    const attentionFindings = data.findings.filter(finding => !['resolved', 'false_positive', 'accepted_risk'].includes(finding.status))
    const latestRun = data.runs[0]
    useEffect(() => {
        if (!data.runs.some(run => ['queued', 'launching', 'running', 'exporting'].includes(run.status))) return
        const timer = setInterval(() => { void refreshAction().then(setData).catch(() => undefined) }, 3000)
        return () => clearInterval(timer)
    }, [data.runs, refreshAction])

    async function refresh() { setData(await refreshAction()) }
    async function addAsset(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault(); setBusy('add'); setMessage('')
        try { await createAssetAction({ hostname }); setHostname(''); await refresh(); setMessage('Asset added. Publish its DNS TXT record, then verify control.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Asset could not be added.') }
        finally { setBusy('') }
    }
    async function verify(assetId: string) {
        setBusy(assetId); setMessage('')
        try { const result = await verifyAssetAction(assetId); setData(current => ({ ...current, assets: current.assets.map(asset => asset.id === assetId ? result.asset : asset) })); setMessage(result.asset.verificationStatus === 'verified' ? 'Domain control verified.' : 'TXT record not found yet. DNS changes can take time to propagate.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Verification lookup failed.') }
        finally { setBusy('') }
    }
    async function scan(asset: UvmAsset) {
        setBusy(asset.id); setMessage('')
        try { await runScanAction(asset.id, authorization[asset.id] === true); await refresh(); setMessage(`Nmap scan queued for ${asset.hostname}.`) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Scan could not start.') }
        finally { setBusy('') }
    }
    async function schedule(asset: UvmAsset, enabled: boolean) {
        setBusy(asset.id); setMessage('')
        try {
            const intervalMinutes = Number(intervals[asset.id] || asset.intervalMinutes)
            const engine = scheduleEngines[asset.id] || asset.scheduleEngine || 'nmap'
            const scanId = engine === 'tenable-vm' ? (scheduleScanIds[asset.id] || asset.scheduleScanId || data.tenableScans.find(scan => scan.enabled)?.id) : undefined
            const result = await scheduleAction(asset.id, { enabled, intervalMinutes, authorized: authorization[asset.id] === true, engine, scanId })
            setData(current => ({ ...current, assets: current.assets.map(item => item.id === asset.id ? result.asset : item) }))
            setMessage(enabled ? `Schedule enabled for ${asset.hostname}.` : `Schedule paused for ${asset.hostname}.`)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Schedule could not be saved.') }
        finally { setBusy('') }
    }
    async function saveTenable(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault(); setBusy('tenable'); setMessage('')
        try {
            await configureTenableAction({ region: tenableRegion, accessKey: tenableAccessKey, secretKey: tenableSecretKey })
            setTenableAccessKey(''); setTenableSecretKey(''); await refresh()
            setMessage('Tenable connection verified and saved.')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Tenable connection could not be saved.') }
        finally { setBusy('') }
    }
    async function disconnectTenable() {
        setBusy('tenable'); setMessage('')
        try { await disconnectTenableAction(); await refresh(); setMessage('Tenable connection removed.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Tenable connection could not be removed.') }
        finally { setBusy('') }
    }
    async function scanWithTenable(asset: UvmAsset) {
        const scanId = tenableScanIds[asset.id] || data.tenableScans[0]?.id
        if (!scanId) return
        setBusy(`${asset.id}:tenable`); setMessage('')
        try { await runTenableScanAction(asset.id, scanId, authorization[asset.id] === true); await refresh(); setMessage(`Tenable scan queued for ${asset.hostname}.`) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Tenable scan could not start.') }
        finally { setBusy('') }
    }
    async function updateFinding(finding: UvmFinding) {
        const update = findingUpdates[finding.id] || { status: finding.status, note: finding.triageNote || '' }
        setBusy(`finding:${finding.id}`); setMessage('')
        try { await updateFindingAction(finding.id, update); await refresh(); setMessage('Finding status updated.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Finding could not be updated.') }
        finally { setBusy('') }
    }
    async function cancelRun(run: UvmRun) {
        setBusy(`run:${run.id}`); setMessage('')
        try { await cancelRunAction(run.id); await refresh(); setMessage(`Cancellation requested for ${run.target}.`) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'The scan could not be cancelled.') }
        finally { setBusy('') }
    }
    return <div className='grid gap-4'>
        <nav aria-label='Vulnerability management views' className='flex flex-wrap gap-2 border-b border-ui-border pb-2'>
            {([['overview', 'Overview'], ['assets', 'Assets'], ['scanners', 'Scanners'], ['runs', 'Scan history'], ['findings', `Findings (${attentionFindings.length})`]] as const).map(([id, label]) => <button key={id} type='button' onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${view === id ? 'bg-ui-text text-ui-canvas' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>{label}</button>)}
        </nav>
        {view === 'overview' && <section className='grid gap-4'>
            <div className='grid gap-3 sm:grid-cols-3'>
                <SummaryCard label='Verified assets' value={`${data.assets.filter(asset => asset.verificationStatus === 'verified').length} / ${data.assets.length}`} detail='Authorized domain inventory' />
                <SummaryCard label='Scans in progress' value={String(activeRuns.length)} detail={activeRuns.length ? 'Results are updating automatically' : 'No active scanner runs'} />
                <SummaryCard label='Findings needing attention' value={String(attentionFindings.length)} detail={attentionFindings.length ? `${attentionFindings.filter(finding => finding.severity === 'critical' || finding.severity === 'high').length} critical or high` : 'No imported findings need triage'} />
            </div>
            <div className='grid gap-4 lg:grid-cols-2'>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Latest scan</h2>{latestRun ? <div className='mt-3'><div className='flex flex-wrap items-center gap-2'><strong>{latestRun.target}</strong><span className='rounded-full bg-ui-raised px-2 py-1 text-xs'>{latestRun.status}</span></div><p className='mt-1 text-sm text-ui-muted'>{latestRun.engine} · {latestRun.profile} · {formatDate(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt)}</p><p className='mt-2 text-sm text-ui-muted'>{latestRun.coverage ? `Address coverage ${latestRun.coverage.completedAddresses}/${latestRun.coverage.attemptedAddresses}` : ['queued', 'launching', 'running', 'exporting'].includes(latestRun.status) ? 'Address coverage pending' : 'Coverage was not reported'}</p>{latestRun.error && <p className='mt-2 text-sm text-ui-warning'>{latestRun.error}</p>}</div> : <p className='mt-2 text-sm text-ui-muted'>No scan has run yet. Register and authorize an asset to begin.</p>}</section>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Coverage state</h2><p className='mt-2 text-sm text-ui-muted'>No findings means a completed scanner reported none. An unscanned asset, partial run, or unavailable engine does not count as a clean result.</p>{data.scannerError && <p className='mt-2 text-sm text-ui-warning'>{data.scannerError}</p>}<div className='mt-3 flex flex-wrap gap-2'><button type='button' onClick={() => setView('assets')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Manage assets</button><button type='button' onClick={() => setView('runs')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Review scan history</button><button type='button' onClick={() => setView('findings')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Triage findings</button></div></section>
            </div>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Recent scanner runs</h2><div className='mt-3 grid gap-2'>{data.runs.slice(0, 5).map(run => <UvmRunCard key={run.id} run={run} defaultOpen={false} cancelBusy={busy === `run:${run.id}`} onCancel={() => void cancelRun(run)} />)}{!data.runs.length && <p className='text-sm text-ui-muted'>Run history will appear after the first scan.</p>}</div></section>
        </section>}
        {view === 'findings' && <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'><div><h2 className='text-lg font-semibold'>Findings</h2><p className='mt-1 text-sm text-ui-muted'>Scanner observations stay linked to their engine, asset, evidence, and scan history.</p></div><span className='rounded-full bg-ui-warning/15 px-2 py-1 text-xs font-semibold text-ui-warning'>{data.findings.filter(finding => !['resolved', 'false_positive', 'accepted_risk'].includes(finding.status)).length} need attention</span></div>
            <div className='mt-3 grid gap-3'>{data.findings.map(finding => {
                const update = findingUpdates[finding.id] || { status: finding.status, note: finding.triageNote || '' }
                return <article key={finding.id} className='rounded-md border border-ui-border bg-ui-raised p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>{finding.severity}</span><span className='text-xs text-ui-muted'>{finding.engine}</span></div><p className='mt-1 text-xs text-ui-muted'>{finding.asset}{finding.address ? ` · ${finding.address}` : ''}{finding.cveIds.length ? ` · ${finding.cveIds.join(', ')}` : ''}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p></div><span className='text-xs font-semibold'>{finding.status.replaceAll('_', ' ')}</span></div>{finding.description && <p className='mt-2 text-sm'>{finding.description}</p>}{finding.solution && <p className='mt-2 text-sm'><span className='font-semibold'>Suggested fix:</span> {finding.solution}</p>}{finding.evidence && <details className='mt-2 text-xs'><summary className='cursor-pointer text-ui-muted'>Scanner evidence</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{finding.evidence}</pre></details>}{finding.status !== 'resolved' && <div className='mt-3 flex flex-wrap items-end gap-2'><label className='grid gap-1 text-[11px] text-ui-muted'>Status<select value={update.status} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, status: event.target.value as UvmFinding['status'] } }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option></select></label><label className='grid min-w-52 flex-1 gap-1 text-[11px] text-ui-muted'>Triage note<input value={update.note} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, note: event.target.value } }))} maxLength={2000} placeholder='Reason or remediation context' className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label><button type='button' onClick={() => void updateFinding(finding)} disabled={busy === `finding:${finding.id}`} className='h-8 rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>{busy === `finding:${finding.id}` ? 'Saving…' : 'Save triage'}</button></div>}{finding.status === 'pending_verification' && <p className='mt-2 text-xs text-ui-muted'>This finding will resolve after a later successful scan confirms it is no longer present.</p>}<p className='mt-2 text-[11px] text-ui-muted'>First seen {formatDate(finding.firstSeen)} · Last seen {formatDate(finding.lastSeen)}</p></article>
            })}{!data.findings.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>No findings have been imported from a completed scan yet. Check asset authorization, scanner availability, and scan coverage before treating an empty queue as a clean result.</p>}</div>
        </section>}
        {view === 'assets' && <>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-semibold'>Assets and scan authorization</h2><p className='mt-1 max-w-3xl text-sm text-ui-muted'>Register a domain and prove control with DNS. Network engines run only against its resolved public IPv4 addresses after authorization.</p></div><button type='button' onClick={() => void refresh()} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Refresh</button></div>
                <form onSubmit={event => void addAsset(event)} className='mt-4 flex flex-wrap gap-2'><label className='sr-only' htmlFor='uvm-hostname'>Domain name</label><input id='uvm-hostname' value={hostname} onChange={event => setHostname(event.target.value)} placeholder='example.com' className='h-10 min-w-56 flex-1 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /><button disabled={busy === 'add' || !hostname.trim()} className='h-10 rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'add' ? 'Adding…' : 'Add asset'}</button></form>
                {message && <p role='status' className='mt-3 text-sm text-ui-primary'>{message}</p>}
            </section>
            <section className='grid gap-3'>
                {data.assets.map(asset => {
                    const canScan = asset.verificationStatus === 'verified' && data.engines.some(engine => engine.id === 'nmap' && engine.status === 'available')
                    const scheduleEngine = scheduleEngines[asset.id] || asset.scheduleEngine || 'nmap'
                    const selectedScheduleScanId = scheduleScanIds[asset.id] || asset.scheduleScanId || data.tenableScans.find(scan => scan.enabled)?.id || ''
                    const canScheduleWithTenable = data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.id === selectedScheduleScanId && scan.enabled)
                    const canSchedule = scheduleEngine === 'nmap' ? canScan : asset.verificationStatus === 'verified' && canScheduleWithTenable
                    const authorized = authorization[asset.id] === true
                    return <article key={asset.id} className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                        <div className='flex flex-wrap items-start justify-between gap-3'><div><div className='flex flex-wrap items-center gap-2'><h3 className='text-base font-semibold'>{asset.hostname}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${asset.verificationStatus === 'verified' ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{asset.verificationStatus}</span></div><p className='mt-1 text-xs text-ui-muted'>{asset.verificationMethod === 'internal' ? 'Hanasand managed asset' : `Added ${formatDate(asset.createdAt)}`}{asset.scanAuthorizedAt ? ` · previously authorized IPs: ${asset.authorizedAddresses.join(', ') || 'none'}` : ''}</p></div><button type='button' onClick={() => void verify(asset.id)} disabled={busy === asset.id || asset.verificationMethod === 'internal'} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === asset.id ? 'Working…' : 'Check DNS verification'}</button></div>
                        {asset.verificationMethod !== 'internal' && asset.verificationStatus !== 'verified' ? <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3 text-xs'><p className='font-semibold'>Publish this DNS TXT record to prove domain control</p><p className='mt-2 text-ui-muted'>Name</p><code className='mt-1 block break-all font-mono'>{asset.verificationRecordName}</code><p className='mt-2 text-ui-muted'>Value</p><code className='mt-1 block break-all font-mono'>{asset.verificationRecordValue}</code></div> : null}
                        <div className='mt-3 flex flex-wrap items-end gap-3'>
                            <label className='flex items-start gap-2 text-xs text-ui-muted'><input type='checkbox' checked={authorized} onChange={event => setAuthorization(current => ({ ...current, [asset.id]: event.target.checked }))} className='mt-0.5 accent-ui-primary' /><span>I am authorized to scan this asset and its currently resolved IP addresses.</span></label>
                            <button type='button' onClick={() => void scan(asset)} disabled={busy === asset.id || !canScan || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Nmap inventory · TCP top 100</button>
                            <p className='text-[11px] text-ui-muted'>Uses <a href='https://nmap.org/' target='_blank' rel='noopener noreferrer' className='underline underline-offset-2'>Nmap Security Scanner</a> to perform these checks.</p>
                            {data.tenableIntegration?.configured && data.tenableScans.length > 0 && <><label className='grid gap-1 text-[11px] text-ui-muted'>Tenable scan template<select value={tenableScanIds[asset.id] || data.tenableScans[0].id} onChange={event => setTenableScanIds(current => ({ ...current, [asset.id]: event.target.value }))} className='h-8 min-w-44 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'>{data.tenableScans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}{scan.enabled ? '' : ' (disabled)'}</option>)}</select></label><button type='button' onClick={() => void scanWithTenable(asset)} disabled={busy === `${asset.id}:tenable` || !data.tenableScans.some(scan => scan.id === (tenableScanIds[asset.id] || data.tenableScans[0]?.id) && scan.enabled) || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Run Tenable assessment</button></>}
                            <label className='grid gap-1 text-[11px] text-ui-muted'>Interval in minutes<input type='number' min='5' max='1440' value={intervals[asset.id] ?? String(asset.intervalMinutes)} onChange={event => setIntervals(current => ({ ...current, [asset.id]: event.target.value }))} className='h-8 w-28 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label>
                            <label className='grid gap-1 text-[11px] text-ui-muted'>Schedule engine<select value={scheduleEngine} onChange={event => setScheduleEngines(current => ({ ...current, [asset.id]: event.target.value as 'nmap' | 'tenable-vm' }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='nmap'>Nmap · TCP top 100</option><option value='tenable-vm'>Tenable Vulnerability Management</option></select></label>
                            {scheduleEngine === 'tenable-vm' && <label className='grid gap-1 text-[11px] text-ui-muted'>Scheduled Tenable template<select value={selectedScheduleScanId} onChange={event => setScheduleScanIds(current => ({ ...current, [asset.id]: event.target.value }))} disabled={!data.tenableIntegration?.configured || !data.tenableScans.some(scan => scan.enabled)} className='h-8 min-w-44 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value=''>Choose an enabled template</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}</select></label>}
                            <button type='button' onClick={() => void schedule(asset, true)} disabled={busy === asset.id || !canSchedule || (!asset.scanAuthorizedAt && !authorized)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>Enable schedule</button>
                            {asset.scheduleEnabled ? <button type='button' onClick={() => void schedule(asset, false)} disabled={busy === asset.id} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Pause schedule</button> : null}
                            {asset.scheduleEnabled && asset.nextRunAt ? <span className='text-xs text-ui-muted'>Next run {formatDate(asset.nextRunAt)}</span> : null}
                        </div>
                    </article>
                })}
                {!data.assets.length && <p className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>No scan assets are registered yet.</p>}
            </section>
        </>}
        {view === 'scanners' && <>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-semibold'>Tenable Vulnerability Management</h2><p className='mt-1 max-w-3xl text-sm text-ui-muted'>Connect an existing Tenable cloud account. Scanner encrypts API keys; each assessment targets only the asset’s currently authorized public IPv4 addresses.</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${data.tenableIntegration?.configured ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{data.tenableIntegration?.configured ? `Connected · ${data.tenableIntegration.region}` : 'Not configured'}</span></div>
                {!data.tenableIntegration?.configured ? <form onSubmit={event => void saveTenable(event)} className='mt-4 grid gap-3 sm:grid-cols-2'>
                    <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={tenableRegion} onChange={event => setTenableRegion(event.target.value as typeof tenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                    <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={tenableAccessKey} onChange={event => setTenableAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={tenableSecretKey} onChange={event => setTenableSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <button disabled={busy === 'tenable' || !tenableAccessKey.trim() || !tenableSecretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
                </form> : <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {data.tenableIntegration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(data.tenableIntegration.testedAt)}</span><button type='button' onClick={() => void disconnectTenable()} disabled={busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text'>Disconnect</button></div>}
                {data.tenableIntegration?.error && <p className='mt-2 text-xs text-ui-warning'>{data.tenableIntegration.error}</p>}
                {data.tenableIntegration?.configured && !data.tenableScans.length && <p className='mt-3 text-sm text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available. Check the Tenable account and scanner permissions.'}</p>}
            </section>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-lg font-semibold'>Engine and coverage</h2>{data.engines.map(engine => <div key={engine.id} className='mt-3'><div className='flex flex-wrap items-center gap-2 text-sm'><strong>{engine.name}</strong><span className={engine.status === 'available' ? 'text-ui-success' : 'text-ui-warning'}>{engine.status}</span>{engine.version && <span className='text-xs text-ui-muted'>version {engine.version}</span>}</div>{engine.reason && <p className='mt-1 text-xs text-ui-muted'>{engine.reason}</p>}{engine.profiles.map(profile => <div key={profile.id} className='mt-2 rounded-md bg-ui-raised p-3 text-xs'><strong>{profile.name}</strong><p className='mt-1 text-ui-muted'>{engine.id === 'nmap' ? 'Reports reachable TCP ports and light service/version banners. This inventory does not confirm vulnerabilities.' : 'Runs the selected Tenable scan template against authorized addresses and imports plugin evidence.'}</p><div className='mt-2 grid gap-2 sm:grid-cols-2'><p><span className='font-semibold'>Covered:</span> {engine.coverage.join(' · ') || 'Not reported'}</p><p><span className='font-semibold'>Not covered:</span> {engine.notCovered.join(' · ') || 'Not reported'}</p></div></div>)}</div>)}{!data.engines.length && <p className='mt-2 text-sm text-ui-muted'>{data.scannerError || 'Network inventory engine is not available.'}</p>}</section>
        </>}
        {view === 'runs' && <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><div className='flex items-center justify-between gap-2'><h2 className='text-lg font-semibold'>Scanner runs</h2><span className='text-xs text-ui-muted'>{data.runs.length} recent</span></div><div className='mt-3 grid gap-3'>{data.runs.map((run, index) => <UvmRunCard key={run.id} run={run} defaultOpen={index === 0} cancelBusy={busy === `run:${run.id}`} onCancel={() => void cancelRun(run)} />)}{!data.runs.length && <p className='text-sm text-ui-muted'>No scanner runs yet.</p>}</div></section>}
    </div>
}

function SummaryCard({ label, value, detail }: { label: string, value: string, detail: string }) {
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><p className='text-xs font-semibold text-ui-muted'>{label}</p><p className='mt-2 text-2xl font-semibold'>{value}</p><p className='mt-1 text-xs text-ui-muted'>{detail}</p></section>
}

function formatDate(value?: string | null) { return formatUtcDateTime(value, 'pending') }
