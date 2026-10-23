'use client'
import { useEffect, useState } from 'react'
import type { NmapScanProfile, UvmAsset, UvmAssessment, UvmAssessmentReport, UvmDashboard, UvmEngineSelection, UvmFinding, UvmRun } from '@/utils/monitoring/types'
import { filterAndSortUvmFindings, formatDate, isNmapScanProfile, RunCard, type UvmFindingFilters } from './uvmPanelHelpers'
import { UvmAssetsView, UvmFindingsView } from './uvmPanelViews'
import { UvmHelp } from './uvmPanelHelp'
import { UvmOverview } from './uvmPanelOverview'
import { UvmAssessmentEngineChoices, type UvmAssessmentEngineId } from './uvmPanelAssessmentControls'
import { createUvmPanelScanActions } from './uvmPanelScanActions'
import { createUvmPanelAssessmentActions } from './uvmPanelAssessmentActions'
import { UvmPanelNavigation, type UvmPanelView } from './uvmPanelNavigation'
import { UvmAssessmentReportView } from './uvmPanelAssessmentReport'
export { filterAndSortUvmFindings } from './uvmPanelHelpers'
export type { UvmFindingFilters } from './uvmPanelHelpers'
export default function UvmPanel({ initialData, servicesPaused = false, refreshAction, createAssetAction, verifyAssetAction, saveZapApiDefinitionAction, runScanAction, scheduleAction, configureTenableAction, disconnectTenableAction, runTenableScanAction, runGvmScanAction, runZapScanAction, updateFindingAction, cancelRunAction, startAssessmentAction, cancelAssessmentAction, getAssessmentReportAction }: {
    initialData: UvmDashboard
    servicesPaused?: boolean
    refreshAction: () => Promise<UvmDashboard>
    createAssetAction: (input: { hostname: string }) => Promise<{ asset: UvmAsset }>
    verifyAssetAction: (assetId: string) => Promise<{ asset: UvmAsset }>
    saveZapApiDefinitionAction: (assetId: string, path: string | null) => Promise<{ asset: UvmAsset }>
    runScanAction: (assetId: string, authorized: boolean, profile: NmapScanProfile) => Promise<{ run: UvmRun }>
    scheduleAction: (assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engines: UvmEngineSelection[] }) => Promise<{ asset: UvmAsset }>
    configureTenableAction: (input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    disconnectTenableAction: () => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    runTenableScanAction: (assetId: string, scanId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runGvmScanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runZapScanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    updateFindingAction: (findingId: string, input: { status: UvmFinding['status'], note: string }) => Promise<unknown>
    cancelRunAction: (runId: string) => Promise<{ run: UvmRun }>
    startAssessmentAction: (input: { requestId: string, assetIds: string[], engines: Array<{ engine: 'nmap' | 'gvm' | 'tenable-vm' | 'zap', scanId?: string, profile?: NmapScanProfile }>, authorized: boolean }) => Promise<{ assessment: UvmAssessment }>
    cancelAssessmentAction: (assessmentId: string) => Promise<{ assessment: UvmAssessment }>
    getAssessmentReportAction: (assessmentId: string) => Promise<{ assessment: UvmAssessmentReport }>
}) {
    const [data, setData] = useState(initialData)
    const [hostname, setHostname] = useState('')
    const [authorization, setAuthorization] = useState<Record<string, boolean>>({})
    const [intervals, setIntervals] = useState<Record<string, string>>({})
    const [schedulePlans, setSchedulePlans] = useState<Record<string, UvmEngineSelection[]>>({})
    const [scheduleProfiles, setScheduleProfiles] = useState<Record<string, NmapScanProfile>>({})
    const [scheduleScanIds, setScheduleScanIds] = useState<Record<string, string>>({})
    const [tenableRegion, setTenableRegion] = useState<'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp'>('us')
    const [tenableAccessKey, setTenableAccessKey] = useState('')
    const [tenableSecretKey, setTenableSecretKey] = useState('')
    const [tenableScanIds, setTenableScanIds] = useState<Record<string, string>>({})
    const [assessmentAssetIds, setAssessmentAssetIds] = useState<string[]>([])
    const [assessmentEngines, setAssessmentEngines] = useState<UvmAssessmentEngineId[]>(
        initialData.engines.some(engine => engine.id === 'nmap' && engine.status === 'available') ? ['nmap'] : [],
    )
    const [assessmentScanId, setAssessmentScanId] = useState('')
    const [assessmentNmapProfile, setAssessmentNmapProfile] = useState<NmapScanProfile>('tcp-top-1000')
    const [assetNmapProfiles, setAssetNmapProfiles] = useState<Record<string, NmapScanProfile>>({})
    const [zapApiDefinitionPaths, setZapApiDefinitionPaths] = useState<Record<string, string>>({})
    const [findingUpdates, setFindingUpdates] = useState<Record<string, { status: UvmFinding['status'], note: string }>>({})
    const [findingFilters, setFindingFilters] = useState<UvmFindingFilters>({ query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [view, setView] = useState<UvmPanelView>('overview')
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [assessmentReport, setAssessmentReport] = useState<UvmAssessmentReport | null>(null)
    const dashboardUnavailable = servicesPaused || Boolean(data.scannerError)
    const activeRuns = data.runs.filter(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status))
    const activeAssessments = data.assessments.some(assessment => ['queued', 'running', 'cancelling'].includes(assessment.status))
    const attentionFindings = data.findings.filter(finding => !['resolved', 'false_positive', 'accepted_risk'].includes(finding.status))
    const visibleFindings = filterAndSortUvmFindings(data.findings, findingFilters)
    const selectableAssessmentEngines = assessmentEngines.filter(engine => {
        const info = data.engines.find(item => item.id === engine)
        return info?.status === 'available' && (engine !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled)))
    })
    const { scan, scanWithTenable, scanWithGvm, scanWithZap } = createUvmPanelScanActions({
        authorization, assetNmapProfiles, tenableScanIds, defaultTenableScanId: data.tenableScans[0]?.id, setBusy, setMessage,
        refresh: async () => { const refreshed = await refreshAction(); setData(refreshed); return refreshed },
        runNmap: runScanAction, runTenable: runTenableScanAction, runGvm: runGvmScanAction, runZap: runZapScanAction,
    })
    const { cancelAssessment } = createUvmPanelAssessmentActions({ cancelAssessmentAction, setBusy, setMessage, refresh })
    useEffect(() => { setData(initialData) }, [initialData])
    useEffect(() => {
        if (!data.runs.some(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status)) && !activeAssessments) return
        const timer = setInterval(() => { void refreshAction().then(setData).catch(() => undefined) }, 3000)
        return () => clearInterval(timer)
    }, [activeAssessments, data.runs, refreshAction])
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
    async function saveZapApiDefinition(asset: UvmAsset) {
        setBusy(`${asset.id}:zap-api`); setMessage('')
        try {
            const path = zapApiDefinitionPaths[asset.id]?.trim() || null
            const result = await saveZapApiDefinitionAction(asset.id, path)
            setData(current => ({ ...current, assets: current.assets.map(item => item.id === asset.id ? result.asset : item) }))
            setZapApiDefinitionPaths(current => ({ ...current, [asset.id]: result.asset.zapApiDefinitionPath || '' }))
            setMessage(path ? `OpenAPI definition saved for ${asset.hostname}.` : `OpenAPI definition cleared for ${asset.hostname}.`)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'OpenAPI definition could not be saved.') }
        finally { setBusy('') }
    }
    async function schedule(asset: UvmAsset, enabled: boolean) {
        setBusy(asset.id); setMessage('')
        try {
            const intervalMinutes = Number(intervals[asset.id] || asset.intervalMinutes)
            const currentPlan = schedulePlans[asset.id] || asset.schedulePlan || [{ engine: asset.scheduleEngine || 'nmap' }]
            const engines = currentPlan.map(choice => choice.engine === 'nmap' ? { engine: choice.engine, profile: scheduleProfiles[asset.id] || (isNmapScanProfile(choice.profile) ? choice.profile : 'tcp-top-1000') } :
                choice.engine === 'tenable-vm' ? { engine: choice.engine, scanId: scheduleScanIds[asset.id] || choice.scanId || data.tenableScans.find(scan => scan.enabled)?.id || '' } : { engine: choice.engine })
            const result = await scheduleAction(asset.id, { enabled, intervalMinutes, authorized: authorization[asset.id] === true, engines })
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
        if (!assessmentAssetIds.length || !selectableAssessmentEngines.length) { setMessage('Choose at least one verified asset and one available engine.'); setBusy(''); return }
        if (selectableAssessmentEngines.includes('tenable-vm') && !assessmentScanId) { setMessage('Choose an enabled Tenable scan configuration.'); setBusy(''); return }
        try {
            const engines = selectableAssessmentEngines.map(engine => engine === 'tenable-vm'
                ? { engine, scanId: assessmentScanId }
                : engine === 'nmap' ? { engine, profile: assessmentNmapProfile } : { engine })
            await startAssessmentAction({ requestId: crypto.randomUUID(), assetIds: assessmentAssetIds, engines, authorized: true })
            setAssessmentAssetIds([]); await refresh(); setMessage('Authorized assessment queued. Scanner results will update as each job completes.')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'The assessment could not start.') }
        finally { setBusy('') }
    }
    async function openAssessmentReport(assessment: UvmAssessment) {
        setBusy(`report:${assessment.id}`); setMessage('')
        try { const result = await getAssessmentReportAction(assessment.id); setAssessmentReport(result.assessment) }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Assessment report could not be loaded.') }
        finally { setBusy('') }
    }
    return <div className='grid gap-4'>
        <UvmPanelNavigation view={view} setView={setView} unavailable={dashboardUnavailable} servicesPaused={servicesPaused} assessmentCount={data.assessments.length} findingCount={attentionFindings.length} />
        <fieldset disabled={dashboardUnavailable} className='m-0 grid min-w-0 gap-4 border-0 p-0'>
            {view === 'overview' && <UvmOverview data={data} activeRunCount={activeRuns.length} openFindingCount={attentionFindings.length} criticalOrHighCount={attentionFindings.filter(finding => finding.severity === 'critical' || finding.severity === 'high').length}
                onManageAssets={() => setView('assets')} onConfigureScanners={() => setView('scanners')} onStartAssessment={() => setView('assessments')} onViewRuns={() => setView('runs')} />}
            {view === 'assessments' && <section className='grid gap-4'><section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex items-start justify-between gap-3'><h2 className='text-lg font-semibold'>New assessment</h2><UvmHelp label='Assessment engines and scope' text='Nmap inventories the selected TCP ports. Greenbone uses Full and Fast; Tenable VM runs an enabled Nessus configuration. Scanner rechecks DNS and public IP scope at launch. Results are not a complete penetration test.' /></div>
                <form onSubmit={event => void startAssessment(event)} className='mt-4 grid gap-4'>
                    <fieldset className='grid gap-2'><legend className='text-sm font-semibold'>Verified assets</legend>{data.assets.filter(asset => asset.verificationStatus === 'verified').map(asset => <label key={asset.id} className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.includes(asset.id)} onChange={event => setAssessmentAssetIds(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} className='mt-1 accent-ui-primary' /><span>{asset.hostname}<small className='block text-xs text-ui-muted'>{asset.authorizedAddresses.length ? `${asset.authorizedAddresses.length} authorized IP${asset.authorizedAddresses.length === 1 ? '' : 's'}` : 'IP scope resolved at launch'}{asset.authorizedAddresses.length > 0 && <details className='inline-block ml-2'><summary className='cursor-pointer underline underline-offset-2'>View</summary><span className='block max-w-xl break-all pt-1'>{asset.authorizedAddresses.join(', ')}</span></details>}</small></span></label>)}{!data.assets.some(asset => asset.verificationStatus === 'verified') && <p className='text-sm text-ui-muted'>Add and verify an asset first.</p>}</fieldset>
                    <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.length > 0 && assessmentAssetIds.every(id => authorization[id] === true)} onChange={event => setAuthorization(current => Object.fromEntries([...new Set([...Object.keys(current), ...assessmentAssetIds])].map(id => [id, assessmentAssetIds.includes(id) ? event.target.checked : current[id] || false])))} className='mt-1 accent-ui-primary' /><span>I’m authorized to scan the selected assets and their public IPs.</span></label>
                    <UvmAssessmentEngineChoices data={data} selectedEngines={assessmentEngines} setSelectedEngines={setAssessmentEngines} scanId={assessmentScanId} setScanId={setAssessmentScanId} nmapProfile={assessmentNmapProfile} setNmapProfile={setAssessmentNmapProfile} onSetup={() => setView('scanners')} />
                    {message && <p role='status' className='text-sm text-ui-primary'>{message}</p>}
                    <button type='submit' disabled={busy === 'assessment' || !assessmentAssetIds.length || !selectableAssessmentEngines.length || !assessmentAssetIds.every(id => authorization[id] === true) || (selectableAssessmentEngines.includes('tenable-vm') && !assessmentScanId)} className='w-fit rounded-md bg-ui-text px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'assessment' ? 'Starting…' : `Start assessment · ${assessmentAssetIds.length} assets × ${selectableAssessmentEngines.length} engines`}</button>
                </form>
            </section>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><h2 className='text-lg font-semibold'>Assessment history</h2><div className='mt-3 grid gap-3'>{data.assessments.map(assessment => <article key={assessment.id} className='rounded-md border border-ui-border bg-ui-raised p-3'><div className='flex flex-wrap items-start justify-between gap-2'><div><strong>{assessment.jobs.length} scanner jobs</strong><span className='ml-2 rounded-full bg-ui-canvas px-2 py-1 text-xs'>{assessment.source} · {assessment.status}</span><p className='mt-1 text-xs text-ui-muted'>Started {formatDate(assessment.startedAt || assessment.createdAt)}{assessment.finishedAt ? ` · Finished ${formatDate(assessment.finishedAt)}` : ''}</p></div><div className='flex gap-2'><button type='button' onClick={() => void openAssessmentReport(assessment)} disabled={busy === `report:${assessment.id}`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `report:${assessment.id}` ? 'Loading…' : 'View report'}</button>{['queued', 'running'].includes(assessment.status) && <button type='button' onClick={() => void cancelAssessment(assessment)} disabled={busy === `assessment:${assessment.id}`} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>{busy === `assessment:${assessment.id}` ? 'Cancelling…' : 'Cancel assessment'}</button>}</div></div><div className='mt-3 grid gap-2'>{assessment.jobs.map(job => <div key={job.id} className='flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-2 text-sm'><span>Stage {job.stageIndex + 1} · {job.asset} · {job.engine} · {job.profile}</span><span className='flex items-center gap-2 text-xs text-ui-muted'>{job.status}{job.attemptCount > 1 ? ` · attempt ${job.attemptCount}` : ''}{job.error ? ` · ${job.error}` : ''}{job.runId && data.runs.some(run => run.id === job.runId) && <button type='button' onClick={() => { setSelectedRunId(job.runId); setView('runs') }} className='rounded border border-ui-border px-2 py-1 font-semibold text-ui-text'>View results</button>}</span></div>)}</div></article>)}{!data.assessments.length && <p className='text-sm text-ui-muted'>{dashboardUnavailable ? 'Unavailable — Scanner data could not be loaded.' : 'No assessments yet.'}</p>}</div></section>
            {assessmentReport && <UvmAssessmentReportView assessment={assessmentReport} onClose={() => setAssessmentReport(null)} />}
            </section>}
            {view === 'findings' && <UvmFindingsView data={data} attentionCount={attentionFindings.length} busy={busy} filters={findingFilters} setFilters={setFindingFilters} visibleFindings={visibleFindings} findingUpdates={findingUpdates} setFindingUpdates={setFindingUpdates} onUpdate={finding => void updateFinding(finding)} />}
            {view === 'assets' && <UvmAssetsView data={data} busy={busy} message={message} hostname={hostname} setHostname={setHostname} authorization={authorization} setAuthorization={setAuthorization} intervals={intervals} setIntervals={setIntervals} schedulePlans={schedulePlans} setSchedulePlans={setSchedulePlans} scheduleProfiles={scheduleProfiles} setScheduleProfiles={setScheduleProfiles} assetNmapProfiles={assetNmapProfiles} setAssetNmapProfiles={setAssetNmapProfiles} zapApiDefinitionPaths={zapApiDefinitionPaths} setZapApiDefinitionPaths={setZapApiDefinitionPaths} onSaveZapApiDefinition={asset => void saveZapApiDefinition(asset)} scheduleScanIds={scheduleScanIds} setScheduleScanIds={setScheduleScanIds} tenableScanIds={tenableScanIds} setTenableScanIds={setTenableScanIds} onRefresh={() => void refresh()} onAddAsset={event => void addAsset(event)} onVerify={assetId => void verify(assetId)} onScan={asset => void scan(asset)} onScanWithTenable={asset => void scanWithTenable(asset)} onScanWithGvm={asset => void scanWithGvm(asset)} onScanWithZap={asset => void scanWithZap(asset)} onSchedule={(asset, enabled) => void schedule(asset, enabled)} />}
            {view === 'scanners' && <>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'><div className='flex items-center gap-2'><h2 className='text-lg font-semibold'>Nessus via Tenable VM</h2><UvmHelp label='Tenable VM connection' text='This connects a Tenable cloud account and launches its enabled Nessus scan configurations. Standalone Nessus Pro hosts are not connected.' /></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${data.tenableIntegration?.configured ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{data.tenableIntegration?.configured ? `Connected · ${data.tenableIntegration.region}` : 'Not configured'}</span></div>
                    {!data.tenableIntegration?.configured ? <form onSubmit={event => void saveTenable(event)} className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={tenableRegion} onChange={event => setTenableRegion(event.target.value as typeof tenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                        <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={tenableAccessKey} onChange={event => setTenableAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                        <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={tenableSecretKey} onChange={event => setTenableSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                        <button disabled={busy === 'tenable' || !tenableAccessKey.trim() || !tenableSecretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
                    </form> : <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {data.tenableIntegration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(data.tenableIntegration.testedAt)}</span><button type='button' onClick={() => void disconnectTenable()} disabled={busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text'>Disconnect</button></div>}
                    {data.tenableIntegration?.error && <p className='mt-2 text-xs text-ui-warning'>{data.tenableIntegration.error}</p>}
                    {data.tenableIntegration?.configured && !data.tenableScans.length && <p className='mt-3 text-sm text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available. Check the Tenable account and scanner permissions.'}</p>}
                </section>
                <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Engine coverage</h2><UvmHelp label='Engine coverage' text='Engine coverage describes what each profile checks. Automated scans find some issues, but do not establish that an application is secure or replace a penetration test.' /></div>
                    {data.engines.map(engine => <div key={engine.id} className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                        <div className='flex flex-wrap items-center gap-2 text-sm'><strong>{engine.name}</strong><span className={engine.status === 'available' ? 'text-ui-success' : 'text-ui-warning'}>{engine.status}</span>{engine.version && <span className='text-xs text-ui-muted'>v{engine.version}</span>}</div>
                        {engine.reason && <p className='mt-1 text-xs text-ui-warning'>{engine.reason}</p>}
                        {engine.profiles.map(profile => <details key={profile.id} className='mt-2 text-xs'><summary className='cursor-pointer font-semibold'>{profile.name} · coverage details</summary><div className='mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2'><p><span className='font-semibold'>Checks:</span> {engine.coverage.join(' · ') || 'Not reported'}</p><p><span className='font-semibold'>Limits:</span> {engine.notCovered.join(' · ') || 'Not reported'}</p></div></details>)}
                    </div>)}
                    {!data.engines.length && <p className='mt-2 text-sm text-ui-warning'>{data.scannerError || 'No scanner engines are available.'}</p>}
                </section>
            </>}
            {view === 'runs' && <section className='rounded-lg border border-ui-border bg-ui-panel p-4'><div className='flex items-center justify-between gap-2'><h2 className='text-lg font-semibold'>Scanner runs</h2><span className='text-xs text-ui-muted'>{dashboardUnavailable ? 'Unavailable' : `${data.runs.length} recent`}</span></div><div className='mt-3 grid gap-3'>{data.runs.map((run, index) => <RunCard key={run.id} run={run} defaultOpen={run.id === selectedRunId || (selectedRunId === null && index === 0)} cancelBusy={busy === `run:${run.id}`} onCancel={() => void cancelRun(run)} />)}{!data.runs.length && <p className='text-sm text-ui-muted'>{dashboardUnavailable ? 'Unavailable — Scanner data could not be loaded.' : 'No scanner runs yet.'}</p>}</div></section>}
        </fieldset>
    </div>}
