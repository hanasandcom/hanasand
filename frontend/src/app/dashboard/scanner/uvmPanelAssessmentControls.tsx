'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { NmapScanProfile, UvmDashboard } from '@/utils/monitoring/types'
import { UvmHelp } from './uvmPanelHelp'
import { getScannerSuiteCatalog } from './scannerSuiteCatalog'

export type UvmAssessmentEngineId = 'nmap' | 'gvm' | 'tenable-vm' | 'zap' | 'testssl' | 'nuclei'
type NmapProfile = NmapScanProfile

export function UvmAssessmentEngineChoices({ data, selectedEngines, setSelectedEngines, scanId, setScanId, nmapProfile, setNmapProfile, servicesPaused, onSetup }: {
    data: UvmDashboard
    selectedEngines: UvmAssessmentEngineId[]
    setSelectedEngines: Dispatch<SetStateAction<UvmAssessmentEngineId[]>>
    scanId: string
    setScanId: Dispatch<SetStateAction<string>>
    nmapProfile: NmapProfile
    setNmapProfile: Dispatch<SetStateAction<NmapProfile>>
    servicesPaused: boolean
    onSetup: () => void
}) {
    const productCatalog = getScannerSuiteCatalog(data.scannerCatalog)
    const selectedReadyEngines = selectedEngines.filter(id => {
        const engine = data.engines.find(item => item.id === id)
        return !servicesPaused && engine?.status === 'available' && (id !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled)))
    })
    const engineLabel = (id: UvmAssessmentEngineId) => id === 'nmap' ? 'Nmap' : id === 'gvm' ? 'Greenbone' : id === 'zap' ? 'OWASP ZAP' : id === 'testssl' ? 'testssl.sh' : id === 'nuclei' ? 'Nuclei' : 'Nessus via Tenable VM'
    const engineProfile = (id: UvmAssessmentEngineId) => id === 'nmap'
        ? nmapProfile === 'tcp-all' ? 'all TCP ports' : nmapProfile === 'tcp-top-100' ? 'top 100 TCP ports' : nmapProfile === 'tcp-top-1000-safe-vuln' ? 'top 1,000 TCP ports + NSE checks' : 'top 1,000 TCP ports'
        : id === 'gvm' ? 'Full and Fast'
            : id === 'zap' ? 'same-origin web assessment'
                : id === 'testssl' ? 'TLS configuration checks'
                    : id === 'nuclei' ? 'Pinned safe HTTP templates'
                    : data.tenableScans.find(scan => scan.id === scanId)?.name || 'Choose configuration'
    function moveEngine(id: UvmAssessmentEngineId, offset: -1 | 1) {
        setSelectedEngines(current => {
            const ordered = current.filter(engine => selectedReadyEngines.includes(engine))
            const index = ordered.indexOf(id)
            const destination = index + offset
            if (index < 0 || destination < 0 || destination >= ordered.length) return current
            const [moved] = ordered.splice(index, 1)
            if (!moved) return current
            ordered.splice(destination, 0, moved)
            return ordered
        })
    }
    return <fieldset className='grid gap-2'>
        <legend className='text-sm font-semibold'>Scanner products · {productCatalog.length}</legend>
        <div className='flex justify-end'><UvmHelp label='Assessment engines' text='Nmap inventories selected TCP ports and can optionally run bounded NSE checks. Greenbone uses Full and Fast. Nessus configurations run through Tenable VM. OWASP ZAP assesses the web origin. testssl.sh checks TLS configuration. Nuclei currently checks pinned security headers on the root URL.' /></div>
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>{productCatalog.map(item => {
            const engineId: UvmAssessmentEngineId | null = item.integration === 'nmap' || item.integration === 'gvm' || item.integration === 'tenable-vm' || item.integration === 'zap' || item.integration === 'testssl' || item.integration === 'nuclei'
                ? item.integration
                : null
            const engine = engineId ? data.engines.find(candidate => candidate.id === engineId) : undefined
            const tenableReady = engineId !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled))
            const ready = Boolean(engineId && !servicesPaused && engine?.status === 'available' && tenableReady)
            const selected = Boolean(ready && engineId && selectedEngines.includes(engineId))
            const reason = item.setup === 'desktop-only' ? 'Desktop app'
                : item.setup === 'cli-review-needed' ? 'CLI review needed'
                    : item.setup === 'license-and-adapter-needed' ? 'License + adapter needed'
                        : item.setup === 'adapter-needed' ? 'Adapter needed'
                            : item.integration === 'image-worker' ? servicesPaused ? 'Image worker stopped · pending disk' : 'Image assets only'
                                : servicesPaused ? item.integration === 'tenable-vm' && !tenableReady ? 'Credentials + disk required' : 'Stopped · pending disk'
                                    : engine?.status === 'available' && !tenableReady ? 'Connect Tenable and enable a scan configuration'
                                        : engine?.status || 'Unavailable'
            return <label key={item.id || item.name} className={`grid gap-1 rounded-md border border-ui-border p-3 text-sm ${ready ? 'cursor-pointer' : 'opacity-75'}`}>
                <span className='flex items-start gap-2'><input type='checkbox' checked={selected} disabled={!ready || !engineId} onChange={event => {
                    if (!engineId) return
                    setSelectedEngines(current => event.target.checked ? [...current, engineId] : current.filter(id => id !== engineId))
                }} className='mt-1 accent-ui-primary' /><span className='font-semibold'>{item.name}<small className='ml-2 font-normal text-ui-muted'>{item.category}</small><small className={`block font-normal ${ready ? 'text-ui-success' : 'text-ui-warning'}`}>{ready ? 'Ready' : reason}</small></span></span>
                {ready && engineId === 'nmap' && selected && <span className='ml-6 flex flex-wrap items-center gap-2 text-xs text-ui-muted'><label className='grid gap-1'>Port coverage<select aria-label='Nmap port coverage' value={nmapProfile} onChange={event => setNmapProfile(event.target.value as NmapProfile)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP ports</option><option value='tcp-top-100'>Quick · top 100 TCP ports</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000 TCP ports</option><option value='tcp-all'>Thorough · all 65,535 TCP ports</option></select></label>{nmapProfile === 'tcp-all' && <small className='text-ui-warning'>Full sweep · up to 20 min/address, 100 min/run.</small>}{nmapProfile === 'tcp-top-1000-safe-vuln' && <UvmHelp label='Nmap NSE checks' text='Runs scripts tagged both safe and vuln. Nmap cannot guarantee no adverse effects. Results are heuristic evidence and do not confirm exploitability.' />}</span>}
                {ready && engineId === 'tenable-vm' && selected && <span className='ml-6 grid gap-1 text-xs text-ui-muted'>Enabled scan configuration<select aria-label='Tenable scan configuration' value={scanId} onChange={event => setScanId(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value=''>Choose configuration</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}</select></span>}
            </label>
        })}</div>
        {selectedReadyEngines.length > 0 && <div className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
            <div><h3 className='text-sm font-semibold'>Run sequence</h3><p className='text-xs text-ui-muted'>Each stage runs across the selected assets before the next stage.</p></div>
            <ol aria-label='Assessment run sequence' className='grid gap-1'>
                {selectedReadyEngines.map((id, index) => <li key={id} className='flex items-center justify-between gap-3 rounded border border-ui-border bg-ui-panel px-2 py-2 text-sm'>
                    <span><span className='mr-2 text-xs text-ui-muted'>Stage {index + 1}</span><strong>{engineLabel(id)}</strong><span className='ml-2 text-xs text-ui-muted'>{engineProfile(id)}</span></span>
                    <span className='flex shrink-0 gap-1'>
                        <button type='button' aria-label={`Move ${engineLabel(id)} earlier`} onClick={() => moveEngine(id, -1)} disabled={index === 0} className='rounded border border-ui-border px-2 py-1 text-xs disabled:opacity-40'>↑</button>
                        <button type='button' aria-label={`Move ${engineLabel(id)} later`} onClick={() => moveEngine(id, 1)} disabled={index === selectedReadyEngines.length - 1} className='rounded border border-ui-border px-2 py-1 text-xs disabled:opacity-40'>↓</button>
                    </span>
                </li>)}
            </ol>
        </div>}
        {!servicesPaused && !data.engines.length && <p className='text-sm text-ui-warning'>{data.scannerError || 'No scanner engines are available.'} <button type='button' onClick={onSetup} className='font-semibold underline'>Scanner setup</button></p>}
    </fieldset>
}
