'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { NetworkScanProfile, UvmAssessmentMode, UvmDashboard } from '@/utils/monitoring/types'
import { UvmHelp } from './uvmPanelHelp'
import { buildUvmAssessmentEnginePlan } from './uvmPanelEnginePlans'
import { getScannerSuiteCatalog } from './scannerSuiteCatalog'

export type UvmAssessmentEngineId = 'nmap' | 'naabu' | 'masscan' | 'angry-ip-scanner' | 'gvm' | 'tenable-vm' | 'zap' | 'testssl' | 'nuclei' | 'nikto' | 'sslyze' | 'wapiti' | 'whatweb' | 'httpx' | 'tlsx' | 'katana' | 'wafw00f'
export const UVM_ASSET_ASSESSMENT_ENGINE_IDS: UvmAssessmentEngineId[] = ['nmap', 'naabu', 'masscan', 'angry-ip-scanner', 'tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei', 'nikto', 'sslyze', 'wapiti', 'whatweb', 'httpx', 'tlsx', 'katana', 'wafw00f']
type NmapProfile = NetworkScanProfile

export function getSafeReadyAssessmentEngines(data: UvmDashboard, servicesPaused: boolean): UvmAssessmentEngineId[] {
    if (servicesPaused) return []
    return UVM_ASSET_ASSESSMENT_ENGINE_IDS.filter(id => {
        if (id === 'angry-ip-scanner') return false
        const engine = data.engines.find(item => item.id === id)
        return engine?.status === 'available' && engine.profiles.some(profile => profile.safe === true)
    })
}

export function UvmAssessmentEngineChoices({ data, selectedEngines, setSelectedEngines, mode, setMode, scanId, setScanId, nmapProfile, setNmapProfile, servicesPaused, onSetup }: {
    data: UvmDashboard
    selectedEngines: UvmAssessmentEngineId[]
    setSelectedEngines: Dispatch<SetStateAction<UvmAssessmentEngineId[]>>
    mode: UvmAssessmentMode
    setMode: Dispatch<SetStateAction<UvmAssessmentMode>>
    scanId: string
    setScanId: Dispatch<SetStateAction<string>>
    nmapProfile: NmapProfile
    setNmapProfile: Dispatch<SetStateAction<NmapProfile>>
    servicesPaused: boolean
    onSetup: () => void
}) {
    const productCatalog = getScannerSuiteCatalog(data.scannerCatalog)
    const assessmentEngines = UVM_ASSET_ASSESSMENT_ENGINE_IDS.flatMap(id => {
        const product = productCatalog.find(item => item.integration === id)
        return product ? [{ id, product }] : []
    })
    const selectedReadyEngines = selectedEngines.filter(id => {
        const product = productCatalog.find(item => item.integration === id)
        const engine = data.engines.find(item => item.id === id)
        const tenableReady = id !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled))
        return product?.setup === 'configured' && Boolean(engine) && tenableReady && (servicesPaused || engine?.status === 'available')
    })
    const automaticPlan = buildUvmAssessmentEnginePlan(selectedReadyEngines, scanId, nmapProfile, 'automatic')
    const sequence = (mode === 'automatic' ? automaticPlan.map(choice => choice.engine) : selectedReadyEngines) as UvmAssessmentEngineId[]
    const autoReady = !servicesPaused && ['nmap', 'httpx'].every(id => data.engines.some(engine => engine.id === id && engine.status === 'available'))
    const engineLabel = (id: UvmAssessmentEngineId) => id === 'nmap' ? 'Nmap' : id === 'naabu' ? 'Naabu' : id === 'masscan' ? 'Masscan' : id === 'angry-ip-scanner' ? 'Angry IP Scanner' : id === 'gvm' ? 'Greenbone' : id === 'zap' ? 'OWASP ZAP' : id === 'testssl' ? 'testssl.sh' : id === 'nuclei' ? 'Nuclei' : id === 'nikto' ? 'Nikto' : id === 'sslyze' ? 'SSLyze' : id === 'wapiti' ? 'Wapiti' : id === 'whatweb' ? 'WhatWeb' : id === 'httpx' ? 'httpx' : id === 'tlsx' ? 'tlsx' : id === 'katana' ? 'Katana' : id === 'wafw00f' ? 'WAFW00F' : 'Nessus via Tenable VM'
    const engineProfile = (id: UvmAssessmentEngineId) => id === 'masscan' ? 'SYN · 22 TCP ports · 10 packets/second' : id === 'angry-ip-scanner' ? 'authorized IPv4 reachability' : id === 'naabu' ? 'top 100 TCP ports · 25 probes/second' : id === 'nmap'
        ? nmapProfile === 'udp-top-100' ? 'top 100 UDP ports' : nmapProfile === 'tcp-all' ? 'all TCP ports' : nmapProfile === 'tcp-top-100' ? 'top 100 TCP ports' : nmapProfile === 'tcp-top-1000-safe-vuln' ? 'top 1,000 TCP ports + NSE checks' : 'top 1,000 TCP ports'
        : id === 'gvm' ? 'Full and Fast'
            : id === 'zap' ? 'same-origin web assessment'
                : id === 'testssl' ? 'TLS configuration checks'
                    : id === 'nuclei' ? 'Pinned safe HTTP templates'
                        : id === 'nikto' ? 'Safe web checks · nikto-safe-web-v1'
                            : id === 'sslyze' ? 'TLS checks · sslyze-tls-safe-v1'
                                : id === 'wapiti' ? 'Passive web checks · wapiti-passive-web-v1'
                                    : id === 'whatweb' ? 'Single-request fingerprint · whatweb-stealthy-host-v1'
                                        : id === 'httpx' ? 'HTTPS root metadata · httpx-root-probe-v1'
                                            : id === 'tlsx' ? 'TLS certificate metadata · tlsx-certificate-metadata-v1'
                                                : id === 'katana' ? 'Bounded same-origin crawl · katana-same-origin-crawl-v1'
                                                    : id === 'wafw00f' ? 'Exact-origin WAF detection · wafw00f-exact-origin-detection-v1'
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
        <legend className='text-sm font-semibold'>Assessment engines · {assessmentEngines.length}</legend>
        <div className='flex items-center justify-between gap-3'><div role='group' aria-label='Assessment mode' className='flex gap-1'>
            <button type='button' aria-pressed={mode === 'automatic'} onClick={() => setMode('automatic')} className={`rounded border px-2 py-1 text-xs font-semibold ${mode === 'automatic' ? 'border-ui-primary text-ui-primary' : 'border-ui-border text-ui-muted'}`}>Automatic</button>
            <button type='button' aria-pressed={mode === 'manual'} onClick={() => setMode('manual')} className={`rounded border px-2 py-1 text-xs font-semibold ${mode === 'manual' ? 'border-ui-primary text-ui-primary' : 'border-ui-border text-ui-muted'}`}>Manual order</button>
        </div><UvmHelp label='Assessment mode' text='Automatic includes ready safe-profile engines and requires Nessus or Greenbone for vulnerability analysis. TLS and web checks follow discovery evidence. Manual order can run discovery-only scans.' /></div>
        {mode === 'automatic' && <p className='text-xs text-ui-muted'>Select Nessus with an enabled scan configuration or Greenbone. Choose Manual order for Nmap/HTTPX discovery only.</p>}
        <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>{assessmentEngines.map(({ id: engineId, product: item }) => {
            const engine = data.engines.find(candidate => candidate.id === engineId)
            const tenableReady = engineId !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled))
            const ready = Boolean(item.setup === 'configured' && engine && tenableReady && (servicesPaused || engine.status === 'available'))
            const outputCheckPending = engineId === 'angry-ip-scanner' && Boolean(engine?.reason)
            const selected = ready && selectedEngines.includes(engineId)
            const reason = item.setup === 'desktop-only' ? 'Desktop app'
                : item.setup === 'cli-review-needed' ? 'GUI bridge needed'
                    : item.setup === 'license-and-adapter-needed' ? 'License + adapter needed'
                        : item.setup === 'adapter-needed' ? 'Adapter needed'
                            : item.integration === 'image-worker' || item.integration === 'grype' ? servicesPaused ? 'Worker stopped' : 'Image assets only'
                                : servicesPaused ? 'Stopped'
                                    : engine?.status === 'available' && !tenableReady ? 'Connect Tenable and enable a scan configuration'
                                        : engine?.status || 'Unavailable'
            return <label key={item.id || item.name} className={`grid gap-1 rounded-md border border-ui-border p-3 text-sm ${ready ? 'cursor-pointer' : 'opacity-75'}`}>
                <span className='flex items-start gap-2'><input type='checkbox' checked={selected} disabled={!ready} onChange={event => {
                    setSelectedEngines(current => event.target.checked ? [...current, engineId] : current.filter(id => id !== engineId))
                }} className='mt-1 accent-ui-primary' /><span className='font-semibold'>{item.name}<small className='ml-2 font-normal text-ui-muted'>{item.category}</small><small className={`block font-normal ${ready && !servicesPaused && !outputCheckPending ? 'text-ui-success' : 'text-ui-warning'}`}>{ready ? servicesPaused ? 'Configured · stopped pending disk expansion' : outputCheckPending ? 'Ready · output check pending' : 'Ready' : reason}</small></span></span>
                {mode === 'manual' && ready && engineId === 'nmap' && selected && <span className='ml-6 flex flex-wrap items-center gap-2 text-xs text-ui-muted'><label className='grid gap-1'>Port coverage<select aria-label='Nmap port coverage' value={nmapProfile} onChange={event => setNmapProfile(event.target.value as NmapProfile)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP ports</option><option value='tcp-top-100'>Quick · top 100 TCP ports</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000 TCP ports</option><option value='tcp-all'>Thorough · all 65,535 TCP ports</option><option value='udp-top-100'>UDP · top 100 ports</option></select></label>{nmapProfile === 'tcp-all' && <small className='text-ui-warning'>Full sweep · up to 20 min/address, 100 min/run.</small>}{nmapProfile === 'udp-top-100' && <small className='text-ui-warning'>UDP results may be open or open|filtered.</small>}{nmapProfile === 'tcp-top-1000-safe-vuln' && <UvmHelp label='Nmap NSE checks' text='Runs scripts tagged both safe and vuln. Nmap cannot guarantee no adverse effects. Results are heuristic evidence and do not confirm exploitability.' />}</span>}
                {ready && engineId === 'naabu' && selected && <small className='ml-6 text-xs text-ui-muted'>Top 100 TCP ports · 25 probes/second</small>}
                {ready && engineId === 'tenable-vm' && selected && <span className='ml-6 grid gap-1 text-xs text-ui-muted'>Enabled scan configuration<select aria-label='Tenable scan configuration' value={scanId} onChange={event => setScanId(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value=''>Choose configuration</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}</select></span>}
            </label>
        })}</div>
        {sequence.length > 0 && <div className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
            <div><h3 className='text-sm font-semibold'>{mode === 'automatic' ? 'Automatic sequence' : 'Run sequence'}</h3>{mode === 'automatic' && <small className='text-xs text-ui-muted'>{!autoReady ? 'Nmap + HTTPS probe unavailable' : !selectedReadyEngines.some(id => id === 'tenable-vm' || id === 'gvm') ? 'Add Nessus or Greenbone' : 'Conditional follow-ups'}</small>}</div>
            <ol aria-label='Assessment run sequence' className='grid gap-1'>
                {sequence.map((id, index) => {
                    const sourceHttpx = ['wafw00f', 'whatweb', 'katana', 'zap', 'nuclei', 'nikto', 'wapiti'].includes(id)
                    const condition = mode === 'automatic' && ['tlsx', 'testssl', 'sslyze'].includes(id) && sequence.includes('nmap') ? 'if Nmap confirms TCP/443'
                        : mode === 'automatic' && sourceHttpx && sequence.includes('httpx') ? 'if HTTPS responds' : null
                    const profile = mode === 'automatic' && id === 'nmap' ? 'top 1,000 TCP ports'
                        : mode === 'automatic' && id === 'httpx' ? 'HTTPS baseline' : engineProfile(id)
                    return <li key={id} className='flex items-center justify-between gap-3 rounded border border-ui-border bg-ui-panel px-2 py-2 text-sm'>
                        <span><span className='mr-2 text-xs text-ui-muted'>Stage {index + 1}</span><strong>{engineLabel(id)}</strong><span className='ml-2 text-xs text-ui-muted'>{profile}</span>{condition && <small className='ml-2 block text-xs text-ui-primary'>{condition}</small>}</span>
                        {mode === 'manual' && <span className='flex shrink-0 gap-1'>
                            <button type='button' aria-label={`Move ${engineLabel(id)} earlier`} onClick={() => moveEngine(id, -1)} disabled={index === 0} className='rounded border border-ui-border px-2 py-1 text-xs disabled:opacity-40'>↑</button>
                            <button type='button' aria-label={`Move ${engineLabel(id)} later`} onClick={() => moveEngine(id, 1)} disabled={index === selectedReadyEngines.length - 1} className='rounded border border-ui-border px-2 py-1 text-xs disabled:opacity-40'>↓</button>
                        </span>}
                    </li>})}
            </ol>
        </div>}
        {!servicesPaused && !data.engines.length && <p className='text-sm text-ui-warning'>{data.scannerError || 'No scanner engines are available.'} <button type='button' onClick={onSetup} className='font-semibold underline'>Scanner setup</button></p>}
    </fieldset>
}
