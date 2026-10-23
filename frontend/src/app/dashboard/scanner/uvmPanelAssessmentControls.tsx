'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'

export type UvmAssessmentEngineId = 'nmap' | 'gvm' | 'tenable-vm' | 'zap'
type NmapProfile = 'tcp-top-100' | 'tcp-top-1000'

export function UvmAssessmentEngineChoices({ data, selectedEngines, setSelectedEngines, scanId, setScanId, nmapProfile, setNmapProfile, onSetup }: {
    data: UvmDashboard
    selectedEngines: UvmAssessmentEngineId[]
    setSelectedEngines: Dispatch<SetStateAction<UvmAssessmentEngineId[]>>
    scanId: string
    setScanId: Dispatch<SetStateAction<string>>
    nmapProfile: NmapProfile
    setNmapProfile: Dispatch<SetStateAction<NmapProfile>>
    onSetup: () => void
}) {
    return <fieldset className='grid gap-2'>
        <legend className='text-sm font-semibold'>Engines</legend>
        <div className='grid gap-2 sm:grid-cols-2'>{data.engines.map(engine => {
            const tenableReady = engine.id !== 'tenable-vm' || (data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled))
            const ready = engine.status === 'available' && tenableReady
            const selected = ready && selectedEngines.includes(engine.id as UvmAssessmentEngineId)
            const label = engine.id === 'nmap' ? 'Nmap · service inventory' : engine.id === 'gvm' ? 'Greenbone · Full and Fast vulnerability scan' : engine.id === 'zap' ? 'OWASP ZAP · web assessment' : 'Nessus via Tenable VM'
            const reason = engine.id === 'tenable-vm' && !tenableReady ? 'Connect Tenable VM and enable a network scan configuration.' : engine.reason || 'Engine is unavailable.'
            return <label key={engine.id} className={`grid gap-1 rounded-md border border-ui-border p-3 text-sm ${ready ? 'cursor-pointer' : 'opacity-75'}`}>
                <span className='flex items-start gap-2'><input type='checkbox' checked={selected} disabled={!ready} onChange={event => setSelectedEngines(current => event.target.checked ? [...current, engine.id as UvmAssessmentEngineId] : current.filter(id => id !== engine.id))} className='mt-1 accent-ui-primary' /><span className='font-semibold'>{label}<small className={`block font-normal ${ready ? 'text-ui-success' : 'text-ui-warning'}`}>{ready ? engine.status : reason}</small></span></span>
                {ready && engine.id === 'nmap' && selected && <span className='ml-6 grid gap-1 text-xs text-ui-muted'>Port coverage<select aria-label='Nmap port coverage' value={nmapProfile} onChange={event => setNmapProfile(event.target.value as NmapProfile)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000 TCP ports</option><option value='tcp-top-100'>Quick · top 100 TCP ports</option></select></span>}
                {ready && engine.id === 'tenable-vm' && selected && <span className='ml-6 grid gap-1 text-xs text-ui-muted'>Enabled scan configuration<select aria-label='Tenable scan configuration' value={scanId} onChange={event => setScanId(event.target.value)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value=''>Choose configuration</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}</select></span>}
            </label>
        })}</div>
        {!data.engines.length && <p className='text-sm text-ui-warning'>{data.scannerError || 'No scanner engines are available.'} <button type='button' onClick={onSetup} className='font-semibold underline'>Scanner setup</button></p>}
    </fieldset>
}
