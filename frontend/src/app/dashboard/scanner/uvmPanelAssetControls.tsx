'use client'

import type { NmapScanProfile, UvmAsset, UvmEngineSelection } from '@/utils/monitoring/types'
import { formatDate, isNmapScanProfile } from './uvmPanelHelpers'
import type { AssetViewProps } from './uvmPanelViews'
import { UvmHelp } from './uvmPanelHelp'

export function DnsRecord({ asset }: { asset: UvmAsset }) {
    return <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3 text-xs'>
        <p className='font-semibold'>Publish this DNS TXT record to prove domain control</p>
        <p className='mt-2 text-ui-muted'>Name</p><code className='mt-1 block break-all font-mono'>{asset.verificationRecordName}</code>
        <p className='mt-2 text-ui-muted'>Value</p><code className='mt-1 block break-all font-mono'>{asset.verificationRecordValue}</code>
    </div>
}

export function TenableScanControl({ asset, props }: { asset: UvmAsset, props: AssetViewProps }) {
    const { data, busy, authorization, tenableScanIds, setTenableScanIds } = props
    const selected = tenableScanIds[asset.id] || data.tenableScans[0]?.id || ''
    const enabled = data.tenableScans.some(scan => scan.id === selected && scan.enabled)
    return <>
        <label className='grid gap-1 text-[11px] text-ui-muted'>Tenable scan template
            <select value={selected} onChange={event => setTenableScanIds(current => ({ ...current, [asset.id]: event.target.value }))} className='h-8 min-w-44 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'>
                {data.tenableScans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}{scan.enabled ? '' : ' (disabled)'}</option>)}
            </select>
        </label>
        <button type='button' onClick={() => props.onScanWithTenable(asset)} disabled={busy === `${asset.id}:tenable` || !enabled || (!asset.scanAuthorizedAt && authorization[asset.id] !== true)} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>Run Nessus scan via Tenable VM</button>
    </>
}

export function ScheduleControl({ asset, props, canSchedule, schedulePlan, scheduleScanId }: {
    asset: UvmAsset
    props: AssetViewProps
    canSchedule: boolean
    schedulePlan: UvmEngineSelection[]
    scheduleScanId: string
}) {
    const { data, busy, authorization } = props
    const engineOptions: Array<{ id: UvmEngineSelection['engine'], label: string }> = [
        { id: 'nmap', label: 'Nmap inventory' }, { id: 'tenable-vm', label: 'Nessus via Tenable VM' },
        { id: 'gvm', label: 'Greenbone' }, { id: 'zap', label: 'OWASP ZAP' }, { id: 'testssl', label: 'testssl.sh TLS checks' }, { id: 'nuclei', label: 'Nuclei safe HTTP checks' },
    ]
    function toggleEngine(engine: UvmEngineSelection['engine'], checked: boolean) {
        props.setSchedulePlans(current => {
            const selected = current[asset.id] || schedulePlan
            return { ...current, [asset.id]: checked
                ? [...selected, { engine, ...(engine === 'nmap' ? { profile: 'tcp-top-1000' as const } : {}) }]
                : selected.filter(choice => choice.engine !== engine) }
        })
    }
    function moveEngine(index: number, offset: -1 | 1) {
        props.setSchedulePlans(current => {
            const selected = [...(current[asset.id] || schedulePlan)]
            const target = index + offset
            if (target < 0 || target >= selected.length) return current
            ;[selected[index], selected[target]] = [selected[target], selected[index]]
            return { ...current, [asset.id]: selected }
        })
    }
    return <>
        <label className='grid gap-1 text-[11px] text-ui-muted'>Interval in minutes
            <input type='number' min='5' max='1440' value={props.intervals[asset.id] ?? String(asset.intervalMinutes)} onChange={event => props.setIntervals(current => ({ ...current, [asset.id]: event.target.value }))} className='h-8 w-28 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' />
        </label>
        <fieldset className='grid gap-2 text-[11px] text-ui-muted'>
            <legend>Recurring engines · run in order</legend>
            <div className='flex flex-wrap gap-3'>{engineOptions.map(option => <label key={option.id} className='flex items-center gap-1.5'>
                <input type='checkbox' checked={schedulePlan.some(choice => choice.engine === option.id)} onChange={event => toggleEngine(option.id, event.target.checked)} className='accent-ui-primary' />{option.label}
            </label>)}</div>
            {schedulePlan.map((choice, index) => <div key={choice.engine} className='flex flex-wrap items-end gap-2 rounded border border-ui-border bg-ui-raised p-2'>
                <span className='pb-2 font-semibold'>{index + 1}. {engineOptions.find(option => option.id === choice.engine)?.label}</span>
                <button type='button' aria-label={`Move ${choice.engine} earlier`} onClick={() => moveEngine(index, -1)} disabled={index === 0} className='rounded border border-ui-border px-2 py-1 disabled:opacity-40'>↑</button>
                <button type='button' aria-label={`Move ${choice.engine} later`} onClick={() => moveEngine(index, 1)} disabled={index === schedulePlan.length - 1} className='rounded border border-ui-border px-2 py-1 disabled:opacity-40'>↓</button>
                {choice.engine === 'nmap' && <label className='grid gap-1'>Nmap profile
                    <select value={props.scheduleProfiles[asset.id] || (isNmapScanProfile(choice.profile) ? choice.profile : 'tcp-top-1000')} onChange={event => props.setScheduleProfiles(current => ({ ...current, [asset.id]: event.target.value as NmapScanProfile }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='tcp-top-1000'>Standard · top 1,000</option><option value='tcp-top-100'>Quick · top 100</option><option value='tcp-top-1000-safe-vuln'>NSE checks · top 1,000</option><option value='tcp-all'>Thorough · all TCP ports</option></select>
                    {props.scheduleProfiles[asset.id] === 'tcp-top-1000-safe-vuln' && <UvmHelp label='Nmap NSE checks' text='Runs scripts tagged both safe and vuln. Nmap cannot guarantee no adverse effects. Results are heuristic evidence and do not confirm exploitability.' />}
                </label>}
                {choice.engine === 'tenable-vm' && <label className='grid gap-1'>Tenable template
                    <select value={scheduleScanId} onChange={event => props.setScheduleScanIds(current => ({ ...current, [asset.id]: event.target.value }))} disabled={!data.tenableIntegration?.configured || !data.tenableScans.some(scan => scan.enabled)} className='h-8 min-w-44 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'>
                        <option value=''>Choose an enabled template</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}
                    </select>
                </label>}
            </div>)}
        </fieldset>
        <button type='button' onClick={() => props.onSchedule(asset, true)} disabled={busy === asset.id || !canSchedule || (!asset.scanAuthorizedAt && authorization[asset.id] !== true)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>Enable schedule</button>
        {asset.scheduleEnabled && <button type='button' onClick={() => props.onSchedule(asset, false)} disabled={busy === asset.id} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Pause schedule</button>}
        {asset.scheduleEnabled && asset.nextRunAt && <span className='text-xs text-ui-muted'>Next run {formatDate(asset.nextRunAt)}</span>}
    </>
}

