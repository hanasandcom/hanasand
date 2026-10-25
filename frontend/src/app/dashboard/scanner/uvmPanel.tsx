'use client'
import { useCallback, useEffect, useState } from 'react'
import type { NetworkScanProfile, NmapScanProfile, UvmAssessmentMode, UvmAsset, UvmAssetCriticality, UvmAssessmentReport, UvmEngineSelection, UvmFindingHistoryPage, UvmFindingHistoryScope, UvmFindingUpdate, UvmRun, UvmZapAuthenticationInput } from '@/utils/monitoring/types'
import type { UvmPanelProps } from './uvmPanelProps'
import { type UvmFindingFilters } from './uvmPanelHelpers'
import { buildUvmScheduleEnginePlan } from './uvmPanelEnginePlans'
import { UvmAssetsView, UvmFindingsView } from './uvmPanelViews'
import { UvmHelp } from './uvmPanelHelp'
import { UvmOverview } from './uvmPanelOverview'
import { getSafeReadyAssessmentEngines, UvmAssessmentEngineChoices, type UvmAssessmentEngineId } from './uvmPanelAssessmentControls'
import { createUvmPanelScanActions } from './uvmPanelScanActions'
import { createUvmPanelAssessmentActions } from './uvmPanelAssessmentActions'
import { UvmPanelNavigation, type UvmPanelView } from './uvmPanelNavigation'
import { UvmAssessmentReportView } from './uvmPanelAssessmentReport'
import { UvmAssessmentHistory, UvmRunHistory } from './uvmPanelHistory'
import { createUvmPanelHistoryActions } from './uvmPanelHistoryActions'
import { createUvmPanelFindingActions } from './uvmPanelFindingActions'
import { removeUvmZapAuthentication, saveUvmAssetCriticality, saveUvmZapApiDefinition, saveUvmZapAuthentication } from './uvmPanelAssetActions'
import { UvmPanelScannerSetup } from './uvmPanelScannerSetup'
import { createUvmPanelTenableActions, type TenableRegion } from './uvmPanelTenableActions'
import { deriveUvmPanelState } from './uvmPanelDerivedState'
import { cancelUvmPanelRun } from './uvmPanelRunActions'
import UvmPanelImages from './uvmPanelImages'
export { filterAndSortUvmFindings, type UvmFindingFilters } from './uvmPanelHelpers'
export default function UvmPanel({
    initialData, servicesPaused = false, refreshAction, getImageReportAction, runImageScanAction, getImageHistoryAction, getImageHistoryRunAction, getRunAction, getRunHistoryAction,
    assessmentHistoryAction, findingHistoryAction, findingGroupsAction, findingTriageHistoryAction, createAssetAction, verifyAssetAction,
    updateAssetCriticalityAction,
    saveZapApiDefinitionAction, configureZapAuthenticationAction, removeZapAuthenticationAction, runScanAction, runNaabuAction, runMasscanAction, runAngryIpAction, scheduleAction,
    configureTenableAction, disconnectTenableAction, runTenableScanAction, runGvmScanAction,
    runZapScanAction, runTestsslAction, runNucleiAction, runNiktoAction, runSslyzeAction,
    runWapitiAction, runWhatwebAction, runHttpxAction, runTlsxAction, runKatanaAction,
    runWafw00fAction, updateFindingAction, cancelRunAction, startAssessmentAction,
    cancelAssessmentAction, getAssessmentReportAction,
}: UvmPanelProps) {
    const [data, setData] = useState(initialData)
    const [hostname, setHostname] = useState('')
    const [authorization, setAuthorization] = useState<Record<string, boolean>>({})
    const [intervals, setIntervals] = useState<Record<string, string>>({})
    const [schedulePlans, setSchedulePlans] = useState<Record<string, UvmEngineSelection[]>>({})
    const [scheduleModes, setScheduleModes] = useState<Record<string, UvmAssessmentMode>>({})
    const [scheduleProfiles, setScheduleProfiles] = useState<Record<string, NetworkScanProfile>>({})
    const [scheduleScanIds, setScheduleScanIds] = useState<Record<string, string>>({})
    const [tenableRegion, setTenableRegion] = useState<TenableRegion>('us')
    const [tenableAccessKey, setTenableAccessKey] = useState('')
    const [tenableSecretKey, setTenableSecretKey] = useState('')
    const [tenableScanIds, setTenableScanIds] = useState<Record<string, string>>({})
    const [assessmentAssetIds, setAssessmentAssetIds] = useState<string[]>([])
    const [assessmentEngines, setAssessmentEngines] = useState<UvmAssessmentEngineId[]>(() => getSafeReadyAssessmentEngines(initialData, servicesPaused))
    const [assessmentMode, setAssessmentMode] = useState<UvmAssessmentMode>('automatic')
    const [assessmentScanId, setAssessmentScanId] = useState('')
    const [assessmentNmapProfile, setAssessmentNmapProfile] = useState<NetworkScanProfile>('tcp-top-1000')
    const [assetNmapProfiles, setAssetNmapProfiles] = useState<Record<string, NmapScanProfile>>({})
    const [zapApiDefinitionPaths, setZapApiDefinitionPaths] = useState<Record<string, string>>({})
    const [zapAuthenticationProfiles, setZapAuthenticationProfiles] = useState<Record<string, UvmZapAuthenticationInput>>({})
    const [findingUpdates, setFindingUpdates] = useState<Record<string, UvmFindingUpdate>>({})
    const [findingFilters, setFindingFilters] = useState<UvmFindingFilters>({ query: '', engine: 'all', severity: 'all', status: 'needs_attention', asset: 'all' })
    const [findingSort, setFindingSort] = useState<'severity' | 'criticality' | 'due-date'>('severity')
    const [findingScope, setFindingScope] = useState<UvmFindingHistoryScope | null>(null)
    const [findingSyncState, setFindingSyncState] = useState<UvmFindingHistoryPage['syncState']>()
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [view, setView] = useState<UvmPanelView>(servicesPaused ? 'scanners' : 'overview')
    const [selectedRun, setSelectedRun] = useState<UvmRun | null>(null)
    const [assessmentReport, setAssessmentReport] = useState<UvmAssessmentReport | null>(null)
    const { loadOlderFindings, openAssessmentFindings, openAssessmentReport, openRun, retryAssessmentFindings, showAllFindings } = createUvmPanelHistoryActions({ data, findingScope, getRunAction, findingHistoryAction, findingGroupsAction, getAssessmentReportAction,
        setBusy, setMessage, setSelectedRun, setAssessmentReport, setView, setData, setFindingScope, setFindingSyncState, setFindingFilters })
    const { dashboardUnavailable, activeRuns, activeAssessments, attentionFindings, actionableFindingCount, needsReviewFindingCount, attentionFindingCount,
        criticalOrHighFindingCount, visibleFindings, visibleFindingGroups, selectableAssessmentEngines,
        automaticPrerequisitesAvailable, plannedEngineCount } = deriveUvmPanelState({ data, servicesPaused, findingScope, findingFilters, findingSort,
        assessmentEngines, assessmentScanId, assessmentNmapProfile, assessmentMode })
    const refresh = useCallback(async () => {
        const refreshed = await refreshAction()
        if (!findingScope) {
            const findings = new Map(data.findings.map(finding => [finding.id, finding]))
            for (const finding of refreshed.findings) findings.set(finding.id, finding)
            const global = { ...refreshed, findings: [...findings.values()] }
            setData(global)
            return global
        }
        const page = await findingHistoryAction(null, findingScope)
        const scopedFindings = new Map(page.findings.map(finding => [finding.id, finding]))
        for (const finding of data.findings) {
            if (!scopedFindings.has(finding.id)) scopedFindings.set(finding.id, finding)
        }
        const scoped = { ...refreshed, findings: [...scopedFindings.values()], findingsNextCursor: data.findingsNextCursor }
        setData(scoped)
        setFindingSyncState(page.syncState)
        return scoped
    }, [data.findings, findingHistoryAction, findingScope, refreshAction])
    const { updateFinding } = createUvmPanelFindingActions({ findingUpdates, updateFindingAction, refresh, setBusy, setMessage, setData })
    const { saveTenable, disconnectTenable } = createUvmPanelTenableActions({
        region: tenableRegion, accessKey: tenableAccessKey, secretKey: tenableSecretKey,
        configure: configureTenableAction, disconnect: disconnectTenableAction, refresh,
        setAccessKey: setTenableAccessKey, setSecretKey: setTenableSecretKey, setBusy, setMessage,
    })
    const { scan, scanWithNaabu, scanWithMasscan, scanWithAngryIp, scanWithTenable, scanWithGvm, scanWithZap, scanWithTestssl, scanWithNuclei, scanWithNikto, scanWithSslyze, scanWithWapiti, scanWithWhatweb, scanWithHttpx, scanWithTlsx, scanWithKatana, scanWithWafw00f } = createUvmPanelScanActions({
        servicesPaused,
        authorization, assetNmapProfiles, tenableScanIds, defaultTenableScanId: data.tenableScans[0]?.id, setBusy, setMessage,
        refresh,
        runNmap: runScanAction, runNaabu: runNaabuAction, runMasscan: runMasscanAction, runAngryIp: runAngryIpAction, runTenable: runTenableScanAction, runGvm: runGvmScanAction, runZap: runZapScanAction, runTestssl: runTestsslAction, runNuclei: runNucleiAction, runNikto: runNiktoAction, runSslyze: runSslyzeAction, runWapiti: runWapitiAction, runWhatweb: runWhatwebAction, runHttpx: runHttpxAction, runTlsx: runTlsxAction, runKatana: runKatanaAction, runWafw00f: runWafw00fAction,
    })
    const { cancelAssessment, startAssessment } = createUvmPanelAssessmentActions({
        cancelAssessmentAction, startAssessmentAction, assetIds: assessmentAssetIds, engines: selectableAssessmentEngines,
        mode: assessmentMode, scanId: assessmentScanId, nmapProfile: assessmentNmapProfile,
        setAssetIds: setAssessmentAssetIds, setBusy, setMessage, refresh,
    })
    useEffect(() => { setData(initialData) }, [initialData])
    useEffect(() => {
        if (!data.runs.some(run => ['queued', 'launching', 'running', 'exporting', 'cancelling'].includes(run.status)) && !activeAssessments) return
        const timer = setInterval(() => { void refresh().catch(() => undefined) }, 3000)
        return () => clearInterval(timer)
    }, [activeAssessments, data.runs, refresh])
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
    const updateAssetCriticality = (asset: UvmAsset, criticality: UvmAssetCriticality) => saveUvmAssetCriticality({ asset, criticality, updateAction: updateAssetCriticalityAction, setBusy, setMessage, setData })
    async function saveZapApiDefinition(asset: UvmAsset) {
        return saveUvmZapApiDefinition({ asset, path: zapApiDefinitionPaths[asset.id]?.trim() || null,
            updateAction: saveZapApiDefinitionAction, setBusy, setMessage, setData, setPaths: setZapApiDefinitionPaths })
    }
    function saveZapAuthentication(asset: UvmAsset) {
        const profile = zapAuthenticationProfiles[asset.id]
        if (!profile) return
        return saveUvmZapAuthentication({ asset, profile, updateAction: configureZapAuthenticationAction,
            setBusy, setMessage, setData, setProfiles: setZapAuthenticationProfiles })
    }
    function removeZapAuthentication(asset: UvmAsset) {
        return removeUvmZapAuthentication({ asset, removeAction: removeZapAuthenticationAction,
            setBusy, setMessage, setData, setProfiles: setZapAuthenticationProfiles })
    }
    async function schedule(asset: UvmAsset, enabled: boolean) {
        setBusy(asset.id); setMessage('')
        try {
            const intervalMinutes = Number(intervals[asset.id] || asset.intervalMinutes)
            const currentPlan = schedulePlans[asset.id] || asset.schedulePlan || [{ engine: asset.scheduleEngine || 'nmap' }]
            const mode = scheduleModes[asset.id] || asset.scheduleMode || 'manual'
            const engines = buildUvmScheduleEnginePlan(currentPlan, scheduleProfiles[asset.id], scheduleScanIds[asset.id] || data.tenableScans.find(scan => scan.enabled)?.id || '', mode)
            const result = await scheduleAction(asset.id, { enabled, intervalMinutes, authorized: authorization[asset.id] === true, engines, mode })
            setData(current => ({ ...current, assets: current.assets.map(item => item.id === asset.id ? result.asset : item) }))
            setMessage(enabled ? `Schedule enabled for ${asset.hostname}.` : `Schedule paused for ${asset.hostname}.`)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Schedule could not be saved.') }
        finally { setBusy('') }
    }
    const cancelRun = (run: UvmRun) => cancelUvmPanelRun({ run, cancelRunAction, refresh, setBusy, setMessage })
    return <div className='grid gap-4'>
        <UvmPanelNavigation view={view} setView={setView} unavailable={dashboardUnavailable} servicesPaused={servicesPaused} assessmentCount={data.assessments.length} findingCount={attentionFindingCount} />
        <fieldset disabled={dashboardUnavailable && view !== 'scanners' && view !== 'images'} className='m-0 grid min-w-0 gap-4 border-0 p-0'>
            {view === 'overview' && <UvmOverview data={data} servicesPaused={servicesPaused} activeRunCount={activeRuns.length} openFindingCount={actionableFindingCount} needsReviewCount={needsReviewFindingCount} criticalOrHighCount={criticalOrHighFindingCount}
                onManageAssets={() => setView('assets')} onConfigureScanners={() => setView('scanners')} onStartAssessment={() => setView('assessments')} onViewRuns={() => setView('runs')} />}
            {view === 'assessments' && <section className='grid gap-4'><section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex items-start justify-between gap-3'><h2 className='text-lg font-semibold'>New assessment</h2><UvmHelp label='Assessment engines and scope' text='Nmap inventories the selected TCP ports. Greenbone uses Full and Fast; Tenable VM runs an enabled Nessus configuration. Scanner rechecks DNS and public IP scope at launch. Results are not a complete penetration test.' /></div>
                <form onSubmit={event => void startAssessment(event)} className='mt-4 grid gap-4'>
                    <fieldset className='grid gap-2'><legend className='text-sm font-semibold'>Verified assets</legend>{data.assets.filter(asset => asset.verificationStatus === 'verified').map(asset => <label key={asset.id} className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.includes(asset.id)} onChange={event => setAssessmentAssetIds(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} className='mt-1 accent-ui-primary' /><span>{asset.hostname}<small className='block text-xs text-ui-muted'>{asset.authorizedAddresses.length ? `${asset.authorizedAddresses.length} authorized IP${asset.authorizedAddresses.length === 1 ? '' : 's'}` : 'IP scope resolved at launch'}{asset.authorizedAddresses.length > 0 && <details className='inline-block ml-2'><summary className='cursor-pointer underline underline-offset-2'>View</summary><span className='block max-w-xl break-all pt-1'>{asset.authorizedAddresses.join(', ')}</span></details>}</small></span></label>)}{!data.assets.some(asset => asset.verificationStatus === 'verified') && <p className='text-sm text-ui-muted'>Add and verify an asset first.</p>}</fieldset>
                    <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={assessmentAssetIds.length > 0 && assessmentAssetIds.every(id => authorization[id] === true)} onChange={event => setAuthorization(current => Object.fromEntries([...new Set([...Object.keys(current), ...assessmentAssetIds])].map(id => [id, assessmentAssetIds.includes(id) ? event.target.checked : current[id] || false])))} className='mt-1 accent-ui-primary' /><span>I’m authorized to scan the selected assets and their public IPs.</span></label>
                    <UvmAssessmentEngineChoices data={data} selectedEngines={assessmentEngines} setSelectedEngines={setAssessmentEngines} mode={assessmentMode} setMode={setAssessmentMode} scanId={assessmentScanId} setScanId={setAssessmentScanId} nmapProfile={assessmentNmapProfile} setNmapProfile={setAssessmentNmapProfile} servicesPaused={servicesPaused} onSetup={() => setView('scanners')} />
                    {message && <p role='status' className='text-sm text-ui-primary'>{message}</p>}
                    <button type='submit' disabled={busy === 'assessment' || !assessmentAssetIds.length || (assessmentMode === 'manual' ? !selectableAssessmentEngines.length : !automaticPrerequisitesAvailable) || !assessmentAssetIds.every(id => authorization[id] === true) || (selectableAssessmentEngines.includes('tenable-vm') && !assessmentScanId)} className='w-fit rounded-md bg-ui-text px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'assessment' ? 'Starting…' : assessmentMode === 'automatic' ? `Start automatic assessment · ${assessmentAssetIds.length} assets × ${plannedEngineCount} stages` : `Start assessment · ${assessmentAssetIds.length} assets × ${plannedEngineCount} engines`}</button>
                </form>
            </section>
            <UvmAssessmentHistory assessments={data.assessments} unavailable={dashboardUnavailable} busy={busy} nextCursor={data.assessmentsNextCursor || null} loadOlder={assessmentHistoryAction}
                onOpenReport={assessment => void openAssessmentReport(assessment)} onCancel={assessment => void cancelAssessment(assessment)}
                onViewRun={(runId, engine) => void openRun(runId, engine)} />
            {assessmentReport && <UvmAssessmentReportView assessment={assessmentReport} busy={busy} onClose={() => setAssessmentReport(null)} onOpenFindings={(stepId, assetId, engine) => void openAssessmentFindings(assessmentReport.id, stepId, assetId, engine)} onOpenRun={(runId, engine) => void openRun(runId, engine)} />}
            </section>}
            {view === 'findings' && <UvmFindingsView data={data} attentionCount={findingScope ? attentionFindings.length : attentionFindingCount} busy={busy} filters={findingFilters} setFilters={setFindingFilters} sort={findingSort} setSort={setFindingSort} visibleFindings={visibleFindings} visibleGroups={visibleFindingGroups} findingUpdates={findingUpdates} setFindingUpdates={setFindingUpdates} nextCursor={findingScope ? data.findingsNextCursor || null : data.findingGroupsNextCursor || null} loadOlder={loadOlderFindings} findingTriageHistoryAction={findingTriageHistoryAction} onViewRun={(runId, engine) => void openRun(runId, engine)} onUpdate={finding => void updateFinding(finding)} syncState={findingSyncState} scoped={findingScope !== null} onShowAll={() => void showAllFindings()} onRetryScoped={() => void retryAssessmentFindings()} />}
            {view === 'assets' && <UvmAssetsView
                data={data} servicesPaused={servicesPaused} busy={busy} message={message} hostname={hostname} setHostname={setHostname}
                authorization={authorization} setAuthorization={setAuthorization} intervals={intervals} setIntervals={setIntervals}
                schedulePlans={schedulePlans} setSchedulePlans={setSchedulePlans} scheduleModes={scheduleModes} setScheduleModes={setScheduleModes} scheduleProfiles={scheduleProfiles} setScheduleProfiles={setScheduleProfiles}
                assetNmapProfiles={assetNmapProfiles} setAssetNmapProfiles={setAssetNmapProfiles}
                zapApiDefinitionPaths={zapApiDefinitionPaths} setZapApiDefinitionPaths={setZapApiDefinitionPaths}
                zapAuthenticationProfiles={zapAuthenticationProfiles} setZapAuthenticationProfiles={setZapAuthenticationProfiles}
                onSaveCriticality={(asset, criticality) => void updateAssetCriticality(asset, criticality)}
                onSaveZapApiDefinition={asset => void saveZapApiDefinition(asset)}
                onSaveZapAuthentication={asset => void saveZapAuthentication(asset)}
                onRemoveZapAuthentication={asset => void removeZapAuthentication(asset)}
                scheduleScanIds={scheduleScanIds} setScheduleScanIds={setScheduleScanIds}
                tenableScanIds={tenableScanIds} setTenableScanIds={setTenableScanIds}
                onRefresh={() => void refresh()} onAddAsset={event => void addAsset(event)} onVerify={assetId => void verify(assetId)}
                onScan={asset => void scan(asset)} onScanWithNaabu={asset => void scanWithNaabu(asset)} onScanWithMasscan={asset => void scanWithMasscan(asset)} onScanWithAngryIp={asset => void scanWithAngryIp(asset)}
                onScanWithTenable={asset => void scanWithTenable(asset)} onScanWithGvm={asset => void scanWithGvm(asset)} onScanWithZap={asset => void scanWithZap(asset)}
                onScanWithTestssl={asset => void scanWithTestssl(asset)} onScanWithNuclei={asset => void scanWithNuclei(asset)} onScanWithNikto={asset => void scanWithNikto(asset)}
                onScanWithSslyze={asset => void scanWithSslyze(asset)} onScanWithWapiti={asset => void scanWithWapiti(asset)} onScanWithWhatweb={asset => void scanWithWhatweb(asset)}
                onScanWithHttpx={asset => void scanWithHttpx(asset)} onScanWithTlsx={asset => void scanWithTlsx(asset)} onScanWithKatana={asset => void scanWithKatana(asset)}
                onScanWithWafw00f={asset => void scanWithWafw00f(asset)} onSchedule={(asset, enabled) => void schedule(asset, enabled)} />}
            {view === 'scanners' && <UvmPanelScannerSetup data={data} busy={busy} region={tenableRegion} setRegion={setTenableRegion} accessKey={tenableAccessKey} setAccessKey={setTenableAccessKey} secretKey={tenableSecretKey} setSecretKey={setTenableSecretKey} servicesPaused={servicesPaused} onSave={event => void saveTenable(event)} onDisconnect={() => void disconnectTenable()} />}
            {view === 'runs' && <UvmRunHistory key={selectedRun ? `${selectedRun.engine}:${selectedRun.id}` : 'recent'} data={data} unavailable={dashboardUnavailable} selectedRun={selectedRun} busy={busy} nextCursor={data.runsNextCursor || null} loadOlder={getRunHistoryAction} onCancel={cancelRun} />}
            {view === 'images' && <UvmPanelImages data={data} servicesPaused={servicesPaused} getReport={getImageReportAction} runScan={runImageScanAction} getHistory={getImageHistoryAction} getHistoryRun={getImageHistoryRunAction} />}
        </fieldset>
    </div>}
