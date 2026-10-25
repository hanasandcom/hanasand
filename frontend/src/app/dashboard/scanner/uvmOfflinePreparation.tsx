'use client'

import { useEffect, useMemo, useState } from 'react'
import type { NetworkScanProfile, UvmAssessmentMode, UvmEngineId } from '@/utils/monitoring/types'
import { buildUvmAssessmentEnginePlan } from './uvmPanelEnginePlans'
import { getScannerSuiteCatalog } from './scannerSuiteCatalog'
import { UVM_ASSET_ASSESSMENT_ENGINE_IDS } from './uvmPanelAssessmentControls'
import { UvmHelp } from './uvmPanelHelp'

type PreparationDraft = { targets: string, mode: UvmAssessmentMode, engines: UvmEngineId[], nmapProfile: NetworkScanProfile }
const emptyDraft: PreparationDraft = { targets: '', mode: 'automatic', engines: ['tenable-vm'], nmapProfile: 'tcp-top-1000' }
const supportedEngines = new Set<string>(UVM_ASSET_ASSESSMENT_ENGINE_IDS)

export default function UvmOfflinePreparation({ storageScope }: { storageScope: string }) {
    const storageKey = `scanner-offline-preparation-v1:${encodeURIComponent(storageScope || 'no-organization')}`
    const [draft, setDraft] = useState(emptyDraft)
    const [hydrated, setHydrated] = useState(false)
    const [authorized, setAuthorized] = useState(false)
    const catalog = useMemo(() => getScannerSuiteCatalog().filter(item => item.setup === 'configured' && supportedEngines.has(item.integration)), [])
    const plan = buildUvmAssessmentEnginePlan(draft.engines, '', draft.nmapProfile, draft.mode)
    const targetNames = draft.targets.split('\n').map(target => target.trim()).filter(Boolean)
    const automaticVulnerabilityEngine = draft.engines.some(engine => engine === 'tenable-vm' || engine === 'gvm')

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<PreparationDraft>
                setDraft({
                    targets: typeof parsed.targets === 'string' ? parsed.targets : '',
                    mode: parsed.mode === 'manual' ? 'manual' : 'automatic',
                    engines: Array.isArray(parsed.engines) ? parsed.engines.filter((engine): engine is UvmEngineId => typeof engine === 'string' && supportedEngines.has(engine)) : emptyDraft.engines,
                    nmapProfile: ['tcp-top-100', 'tcp-top-1000', 'tcp-top-1000-safe-vuln', 'tcp-all', 'udp-top-100'].includes(parsed.nmapProfile || '') ? parsed.nmapProfile as NetworkScanProfile : 'tcp-top-1000',
                })
            }
        } catch { /* Keep an empty draft when browser storage is unavailable or invalid. */ }
        setHydrated(true)
    }, [storageKey])

    useEffect(() => {
        if (!hydrated) return
        try { window.localStorage.setItem(storageKey, JSON.stringify(draft)) }
        catch { /* The export button remains available when browser storage is full. */ }
    }, [draft, hydrated, storageKey])

    function exportDraft() {
        const payload = {
            schema: 'hanasand-scanner-preparation-v1',
            createdAt: new Date().toISOString(),
            organizationScope: storageScope || null,
            execution: 'not-started',
            authorizationConfirmed: authorized,
            targets: targetNames,
            mode: draft.mode,
            engines: plan,
            note: 'Preparation draft only. Re-verify asset ownership, DNS scope, engine readiness, and authorization before creating a live assessment.',
        }
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = 'scanner-assessment-preparation.json'
        link.click()
        URL.revokeObjectURL(url)
    }

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>Assessment plan draft</h2>
            <UvmHelp label='Offline preparation' text='This draft stays in this browser and does not contact Scanner. It cannot register assets, verify DNS, save credentials, queue jobs, or launch scans.' />
        </div>
        <p className='mt-1 text-xs text-ui-muted'>Saved locally for this organization · no scans sent</p>
        <div className='mt-4 grid gap-4'>
            <label className='grid gap-1 text-sm font-medium'>Targets to prepare<textarea value={draft.targets} onChange={event => setDraft(current => ({ ...current, targets: event.target.value }))} rows={3} placeholder='example.com' className='rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-sm font-normal text-ui-text' /><small className='text-xs font-normal text-ui-muted'>One hostname per line. The live service will require DNS verification and a fresh scope check.</small></label>
            <fieldset className='grid gap-2'>
                <legend className='text-sm font-semibold'>Assessment mode</legend>
                <div className='flex gap-2'>
                    {(['automatic', 'manual'] as const).map(mode => <button key={mode} type='button' aria-pressed={draft.mode === mode} onClick={() => setDraft(current => ({ ...current, mode }))} className={`rounded-md border px-3 py-2 text-xs font-semibold ${draft.mode === mode ? 'border-ui-primary text-ui-primary' : 'border-ui-border text-ui-muted'}`}>{mode === 'automatic' ? 'Automatic' : 'Manual order'}</button>)}
                </div>
            </fieldset>
            <fieldset className='grid gap-2'>
                <legend className='text-sm font-semibold'>Configured asset engines</legend>
                <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>{catalog.map(item => {
                    const engine = item.integration as UvmEngineId
                    const checked = draft.engines.includes(engine)
                    return <label key={item.id || item.name} className='flex items-start gap-2 rounded-md border border-ui-border p-3 text-sm'>
                        <input type='checkbox' checked={checked} onChange={event => setDraft(current => ({ ...current, engines: event.target.checked ? [...new Set([...current.engines, engine])] : current.engines.filter(value => value !== engine) }))} className='mt-0.5 accent-ui-primary' />
                        <span><span className='font-semibold'>{item.name}</span><small className='block text-xs text-ui-warning'>Configured adapter · runtime not verified</small></span>
                    </label>
                })}</div>
                {draft.mode === 'manual' && draft.engines.includes('nmap') && <label className='grid w-fit gap-1 text-xs text-ui-muted'>Nmap profile<select value={draft.nmapProfile} onChange={event => setDraft(current => ({ ...current, nmapProfile: event.target.value as NetworkScanProfile }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP</option><option value='tcp-top-100'>Quick · top 100 TCP</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000 TCP</option><option value='tcp-all'>Thorough · all TCP ports</option><option value='udp-top-100'>UDP · top 100</option></select></label>}
            </fieldset>
            <div className='rounded-md border border-ui-border p-3'>
                <h3 className='text-sm font-semibold'>{draft.mode === 'automatic' ? 'Automatic sequence' : 'Manual sequence'}</h3>
                <ol className='mt-2 grid gap-1 text-xs text-ui-muted'>{plan.map((step, index) => <li key={`${step.engine}-${index}`}>Stage {index + 1} · {step.engine}{step.profile ? ` · ${step.profile}` : ''}{step.engine === 'tenable-vm' ? ' · choose a Tenable scan configuration when connected' : ''}</li>)}</ol>
                {draft.mode === 'automatic' && !automaticVulnerabilityEngine && <p className='mt-2 text-xs text-ui-warning'>Add Nessus via Tenable VM or Greenbone for vulnerability assessment coverage.</p>}
            </div>
            <label className='flex items-start gap-2 text-xs text-ui-muted'><input type='checkbox' checked={authorized} onChange={event => setAuthorized(event.target.checked)} className='mt-0.5 accent-ui-primary' /><span>I confirm I’m authorized to assess every listed target.</span></label>
            <div className='flex flex-wrap items-center gap-3'>
                <button type='button' onClick={exportDraft} disabled={!targetNames.length || !authorized} className='rounded-md bg-ui-text px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>Download draft</button>
                <span className='text-xs text-ui-warning'>Export only · live setup and scans require the Scanner API and database.</span>
            </div>
        </div>
    </section>
}
