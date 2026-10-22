'use client'

import { useEffect, useState } from 'react'
import type { UvmAsset, UvmAssessment, UvmDashboard, UvmFinding, UvmRun } from '@/utils/monitoring/types'
import { filterAndSortUvmFindings, formatDate, RunCard, SummaryCard, type UvmFindingFilters } from './uvmPanelHelpers'
import { UvmAssessmentStarter, UvmAssetsView, UvmFindingsView } from './uvmPanelViews'

export { filterAndSortUvmFindings } from './uvmPanelHelpers'
export type { UvmFindingFilters } from './uvmPanelHelpers'

export default function UvmPanel({ initialData, refreshAction, createAssetAction, verifyAssetAction, runScanAction, scheduleAction, configureTenableAction, disconnectTenableAction, runTenableScanAction, updateFindingAction, cancelRunAction, startAssessmentAction, cancelAssessmentAction }: {
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
    startAssessmentAction: (input: { requestId: string, assetIds: string[], engines: Array<{ engine: 'nmap' | 'gvm' | 'tenable-vm', scanId?: string }>, authorized: boolean }) => Promise<{ assessment: UvmAssessment }>
    cancelAssessmentAction: (assessmentId: string) => Promise<{ assessment: UvmAssessment }>
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
    const [assessmentAssetIds, setAssessmentAssetIds] = useState<string[]>([])
    const [assessmentEngines, setAssessmentEngines] = useState<Array<'nmap' | 'gvm' | 'tenable-vm'>>(
        initialData.engines.some(engine => engine.id === 'nmap' && engine.status === 'available') ? ['nmap'] : [],
    )
    const [assessmentScanId, setAssessmentScanId] = useState('')
    const [findingUpdates, setFindingUpdates] = useState<Record<string, { status: UvmFinding['status'], note: string }>>({})
    const [findingFilters, setFindingFilters] = useState<UvmFindingFilters>({ query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [view, setView] = useState<'overview' | 'assessments' | 'assets' | 'scanners' | 'runs' | 'findings'>('overview')
    const activeRuns = data.runs.filter(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status))
    const attentionFindings = data.findings.filter(finding => !['resolved', 'false_positive', 'accepted_risk'].includes(finding.status))
    const visibleFindings = filterAndSortUvmFindings(data.findings, findingFilters)
    const latestRun = data.runs[0]
    useEffect(() => {
        if (!data.runs.some(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status))) return
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
    async function startAssessment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault(); setBusy('assessment'); setMessage('')
        if (!assessmentAssetIds.length || !assessmentEngines.length) { setMessage('Choose at least one verified asset and one scanner.'); setBusy(''); return }
        if (assessmentEngines.includes('tenable-vm') && !assessmentScanId) { setMessage('Choose an enabled Tenable scan template.'); setBusy(''); return }
        try {
            const engines = assessmentEngines.map(engine => engine === 'tenable-vm' ? { engine, scanId: assessmentScanId } : { engine })
            await startAssessmentAction({ requestId: crypto.randomUUID(), assetIds: assessmentAssetIds, engines, authorized: true })
            setAssessmentAssetIds([]); await refresh(); setMessage('Authorized assessment queued. Scanner results will update as each job completes.')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not start.') }
        finally { setBusy('') }
    }
    async function cancelAssessment(assessment: UvmAssessment) {
        setBusy(`assessment:${assessment.id}`); setMessage('')
        try { await cancelAssessmentAction(assessment.id); await refresh(); setMessage('Assessment cancellation requested.') }
        catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not be cancelled.') }
        finally { setBusy('') }
    }
    return <div className='grid gap-4'>
        <header className='grid gap-1'>
            <h1 className='text-2xl font-semibold'>Vulnerability assessments</h1>
            <p className='max-w-4xl text-sm text-ui-muted'>Verify assets, confirm scan scope, choose available engines, and track findings through remediation. Nmap reports service inventory; Nessus scan configurations run via Tenable VM, and Greenbone runs vulnerability assessments. Standalone Nessus Pro hosts are not connected. Automated checks do not validate exploitability or constitute a complete penetration test.</p>
        </header>
        <nav aria-label='Vulnerability management views' className='flex flex-wrap gap-2 border-b border-ui-border pb-2'>
            {([['overview', 'Overview'], ['assessments', `Assessments (${data.assessments.length})`], ['assets', 'Assets'], ['scanners', 'Scanners'], ['runs', 'Scan history'], ['findings', `Findings (${attentionFindings.length})`]] as const).map(([id, label]) => <button key={id} type='button' onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${view === id ? 'bg-ui-text text-ui-canvas' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>{label}</button>)}
        </nav>
        {view === 'overview' && <section className='grid gap-4'>
            <UvmAssessmentStarter data={data} onManageAssets={() => setView('assets')} onConfigureScanners={() => setView('scanners')} onStartAssessment={() => setView('assessments')} />
            <div className='grid gap-3 sm:grid-cols-3'>
                <SummaryCard label='Verified assets' value={`${data.assets.filter(asset => asset.verificationStatus === 'verified').length} / ${data.assets.length}`} detail='Authorized domain inventory' />
                <SummaryCard label='Scans in progress' value={String(activeRuns.length)} detail={activeRuns.length ? 'Results are updating automatically' : 'No active scanner runs'} />
                <SummaryCard label='Findings needing attention' value={String(attentionFindings.length)} detail={attentionFindings.length ? `${attentionFindings.filter(finding => finding.severity === 'critical' || finding.severity === 'high').length} critical or high` : 'No imported findings need triage'} />
            </div>
            <div className='grid gap-4 lg:grid-cols-2'>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Latest scan</h2>{latestRun ? <div className='mt-3'><div className='flex flex-wrap items-center gap-2'><strong>{latestRun.target}</strong><span className='rounded-full bg-ui-raised px-2 py-1 text-xs'>{latestRun.status}</span></div><p className='mt-1 text-sm text-ui-muted'>{latestRun.engine} · {latestRun.profile} · {formatDate(latestRun.finishedAt || latestRun.startedAt || latestRun.createdAt)}</p><p className='mt-2 text-sm text-ui-muted'>{latestRun.coverage ? `Address coverage ${latestRun.coverage.completedAddresses}/${latestRun.coverage.attemptedAddresses}` : ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(latestRun.status) ? 'Address coverage pending' : 'Coverage was not reported'}</p>{latestRun.error && <p className='mt-2 text-sm text-ui-warning'>{latestRun.error}</p>}</div> : <p className='mt-2 text-sm text-ui-muted'>No scan has run yet. Register and authorize an asset to begin.</p>}</section>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Coverage state</h2><p className='mt-2 text-sm text-ui-muted'>No findings means a completed scanner reported none. An unscanned asset, partial run, or unavailable engine does not count as a clean result.</p>{data.scannerError && <p className='mt-2 text-sm text-ui-warning'>{data.scannerError}</p>}<div className='mt-3 flex flex-wrap gap-2'><button type='button' onClick={() => setView('assessments')} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas'>New assessment</button><button type='button' onClick={() => setView('assets')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Manage assets</button><button type='button' onClick={() => setView('runs')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Review scan history</button><button type='button' onClick={() => setView('findings')} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Triage findings</button></div></section>
            </div>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-base font-semibold'>Recent scanner runs</h2><div className='mt-3 grid gap-2'>{data.runs.slice(0, 5).map(run => <RunCard key={run.id} run={run} defaultOpen={false} cancelBusy={busy === `run:${run.id}`} onCancel={() => void cancelRun(run)} />)}{!data.runs.length && <p className='text-sm text-ui-muted'>No scan runs yet.</p>}</div></section>
        </section>}
        {view === 'assessments' && <section className='grid gap-4'>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <h2 className='text-lg font-semibold'>Start an authorized assessment</h2>
                <p className='mt-1 max-w-3xl text-sm text-ui-muted'>Run a bounded scanner plan against verified assets. Review the resolved public IPv4 addresses, confirm authorization, then select engines. Nmap reports exposed services; Nessus scan configurations run through Tenable VM.</p>
                <form onSubmit={event => void startAssessment(event)} className='mt-4 grid gap-4'>
                    <fieldset className='grid gap-2'><legend className='text-sm font-semibold'>Verified assets</legend>{data.assets.filter(asset => asset.verificationStatus === 'verified').map(asset => <label key={asset.id} className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.includes(asset.id)} onChange={event => setAssessmentAssetIds(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} className='mt-1 accent-ui-primary' /><span>{asset.hostname}<small className='block text-xs text-ui-muted'>Previously authorized IPs: {asset.authorizedAddresses.join(', ') || 'none · current public IPs will be resolved at launch'}</small></span></label>)}{!data.assets.some(asset => asset.verificationStatus === 'verified') && <p className='text-sm text-ui-muted'>Verify an asset before starting an assessment.</p>}</fieldset>
                    <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.length > 0 && assessmentAssetIds.every(id => authorization[id] === true)} onChange={event => setAuthorization(current => Object.fromEntries([...new Set([...Object.keys(current), ...assessmentAssetIds])].map(id => [id, assessmentAssetIds.includes(id) ? event.target.checked : current[id] || false])))} className='mt-1 accent-ui-primary' /><span>I confirm that I am authorized to scan each selected asset and its current public IP addresses.</span></label>
                    <fieldset className='grid gap-2'><legend className='text-sm font-semibold'>Scanners</legend>{data.engines.some(engine => engine.id === 'nmap' && engine.status === 'available') && <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={assessmentEngines.includes('nmap')} onChange={event => setAssessmentEngines(current => event.target.checked ? [...current, 'nmap'] : current.filter(engine => engine !== 'nmap'))} className='accent-ui-primary' />Nmap · TCP top 100 service inventory</label>}{data.engines.some(engine => engine.id === 'gvm' && engine.status === 'available') && <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={assessmentEngines.includes('gvm')} onChange={event => setAssessmentEngines(current => event.target.checked ? [...current, 'gvm'] : current.filter(engine => engine !== 'gvm'))} className='accent-ui-primary' />Greenbone Vulnerability Management · Full and Fast</label>}{data.tenableIntegration?.configured && data.tenableScans.some(scan => scan.enabled) && <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={assessmentEngines.includes('tenable-vm')} onChange={event => setAssessmentEngines(current => event.target.checked ? [...current, 'tenable-vm'] : current.filter(engine => engine !== 'tenable-vm'))} className='accent-ui-primary' />Nessus scans via Tenable VM</label>}{assessmentEngines.includes('tenable-vm') && <label className='grid max-w-xl gap-1 text-xs text-ui-muted'>Enabled Tenable scan template<select value={assessmentScanId} onChange={event => setAssessmentScanId(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value=''>Choose template</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}</select></label>}</fieldset>
                    {message && <p role='status' className='text-sm text-ui-primary'>{message}</p>}
                    <button type='submit' disabled={busy === 'assessment' || !assessmentAssetIds.length || !assessmentEngines.length || !assessmentAssetIds.every(id => authorization[id] === true)} className='w-fit rounded-md bg-ui-text px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'assessment' ? 'Starting…' : `Start assessment · ${assessmentAssetIds.length} assets × ${assessmentEngines.length} scanners`}</button>
                </form>
            </section>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-lg font-semibold'>Assessment history</h2><div className='mt-3 grid gap-3'>{data.assessments.map(assessment => <article key={assessment.id} className='rounded-md border border-ui-border bg-ui-raised p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><strong>{assessment.jobs.length} scanner jobs</strong><span className='ml-2 rounded-full bg-ui-canvas px-2 py-1 text-xs'>{assessment.status}</span><p className='mt-1 text-xs text-ui-muted'>Started {formatDate(assessment.startedAt || assessment.createdAt)}{assessment.finishedAt ? ` · Finished ${formatDate(assessment.finishedAt)}` : ''}</p></div>{['queued', 'running'].includes(assessment.status) && <button type='button' onClick={() => void cancelAssessment(assessment)} disabled={busy === `assessment:${assessment.id}`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `assessment:${assessment.id}` ? 'Cancelling…' : 'Cancel assessment'}</button>}</div><div className='mt-3 grid gap-2'>{assessment.jobs.map(job => <div key={job.id} className='flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-2 text-sm'><span>{job.asset} · {job.engine} · {job.profile}</span><span className='text-xs text-ui-muted'>{job.status}{job.error ? ` · ${job.error}` : ''}</span></div>)}</div></article>)}{!data.assessments.length && <p className='text-sm text-ui-muted'>No assessments yet.</p>}</div></section>
        </section>}
        {view === 'findings' && <UvmFindingsView data={data} attentionCount={attentionFindings.length} busy={busy} filters={findingFilters} setFilters={setFindingFilters} visibleFindings={visibleFindings} findingUpdates={findingUpdates} setFindingUpdates={setFindingUpdates} onUpdate={finding => void updateFinding(finding)} />}
        {view === 'assets' && <UvmAssetsView data={data} busy={busy} message={message} hostname={hostname} setHostname={setHostname} authorization={authorization} setAuthorization={setAuthorization} intervals={intervals} setIntervals={setIntervals} scheduleEngines={scheduleEngines} setScheduleEngines={setScheduleEngines} scheduleScanIds={scheduleScanIds} setScheduleScanIds={setScheduleScanIds} tenableScanIds={tenableScanIds} setTenableScanIds={setTenableScanIds} onRefresh={() => void refresh()} onAddAsset={event => void addAsset(event)} onVerify={assetId => void verify(assetId)} onScan={asset => void scan(asset)} onScanWithTenable={asset => void scanWithTenable(asset)} onSchedule={(asset, enabled) => void schedule(asset, enabled)} />}
        {view === 'scanners' && <>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'><div><h2 className='text-lg font-semibold'>Nessus scans via Tenable VM</h2><p className='mt-1 max-w-3xl text-sm text-ui-muted'>Connect an existing Tenable cloud account to launch enabled Nessus scan configurations. Scanner encrypts API keys and limits each assessment to the asset’s currently authorized public IPv4 addresses. Standalone Nessus Pro hosts are not connected.</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${data.tenableIntegration?.configured ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{data.tenableIntegration?.configured ? `Connected · ${data.tenableIntegration.region}` : 'Not configured'}</span></div>
                {!data.tenableIntegration?.configured ? <form onSubmit={event => void saveTenable(event)} className='mt-4 grid gap-3 sm:grid-cols-2'>
                    <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={tenableRegion} onChange={event => setTenableRegion(event.target.value as typeof tenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                    <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={tenableAccessKey} onChange={event => setTenableAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={tenableSecretKey} onChange={event => setTenableSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <button disabled={busy === 'tenable' || !tenableAccessKey.trim() || !tenableSecretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
                </form> : <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {data.tenableIntegration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(data.tenableIntegration.testedAt)}</span><button type='button' onClick={() => void disconnectTenable()} disabled={busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text'>Disconnect</button></div>}
                {data.tenableIntegration?.error && <p className='mt-2 text-xs text-ui-warning'>{data.tenableIntegration.error}</p>}
                {data.tenableIntegration?.configured && !data.tenableScans.length && <p className='mt-3 text-sm text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available. Check the Tenable account and scanner permissions.'}</p>}
            </section>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-lg font-semibold'>Engine and coverage</h2>{data.engines.map(engine => <div key={engine.id} className='mt-3'><div className='flex flex-wrap items-center gap-2 text-sm'><strong>{engine.name}</strong><span className={engine.status === 'available' ? 'text-ui-success' : 'text-ui-warning'}>{engine.status}</span>{engine.version && <span className='text-xs text-ui-muted'>version {engine.version}</span>}</div>{engine.reason && <p className='mt-1 text-xs text-ui-muted'>{engine.reason}</p>}{engine.profiles.map(profile => <div key={profile.id} className='mt-2 rounded-md bg-ui-raised p-3 text-xs'><strong>{profile.name}</strong><p className='mt-1 text-ui-muted'>{engine.id === 'nmap' ? 'Reports reachable TCP ports and light service/version banners. This inventory does not confirm vulnerabilities.' : engine.id === 'gvm' ? 'Runs Greenbone Full and Fast checks using the configured manager, port list, and loaded feeds.' : 'Runs the selected Tenable scan template against authorized addresses and imports plugin evidence.'}</p><div className='mt-2 grid gap-2 sm:grid-cols-2'><p><span className='font-semibold'>Covered:</span> {engine.coverage.join(' · ') || 'Not reported'}</p><p><span className='font-semibold'>Not covered:</span> {engine.notCovered.join(' · ') || 'Not reported'}</p></div></div>)}</div>)}{!data.engines.length && <p className='mt-2 text-sm text-ui-muted'>{data.scannerError || 'Network inventory engine is not available.'}</p>}</section>
        </>}
        {view === 'runs' && <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><div className='flex items-center justify-between gap-2'><h2 className='text-lg font-semibold'>Scanner runs</h2><span className='text-xs text-ui-muted'>{data.runs.length} recent</span></div><div className='mt-3 grid gap-3'>{data.runs.map((run, index) => <RunCard key={run.id} run={run} defaultOpen={index === 0} cancelBusy={busy === `run:${run.id}`} onCancel={() => void cancelRun(run)} />)}{!data.runs.length && <p className='text-sm text-ui-muted'>No scanner runs yet.</p>}</div></section>}
    </div>
}
