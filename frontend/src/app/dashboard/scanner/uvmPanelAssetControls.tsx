'use client'

import type { UvmAsset } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import type { AssetViewProps } from './uvmPanelViews'

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

export function ScheduleControl({ asset, props, canSchedule, scheduleEngine, scheduleScanId }: {
    asset: UvmAsset
    props: AssetViewProps
    canSchedule: boolean
    scheduleEngine: 'nmap' | 'tenable-vm'
    scheduleScanId: string
}) {
    const { data, busy, authorization } = props
    return <>
        <label className='grid gap-1 text-[11px] text-ui-muted'>Interval in minutes
            <input type='number' min='5' max='1440' value={props.intervals[asset.id] ?? String(asset.intervalMinutes)} onChange={event => props.setIntervals(current => ({ ...current, [asset.id]: event.target.value }))} className='h-8 w-28 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' />
        </label>
        <label className='grid gap-1 text-[11px] text-ui-muted'>Schedule engine
            <select value={scheduleEngine} onChange={event => props.setScheduleEngines(current => ({ ...current, [asset.id]: event.target.value as 'nmap' | 'tenable-vm' }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'>
                <option value='nmap'>Nmap · TCP top 100</option><option value='tenable-vm'>Nessus scans via Tenable VM</option>
            </select>
        </label>
        {scheduleEngine === 'tenable-vm' && <label className='grid gap-1 text-[11px] text-ui-muted'>Scheduled Tenable template
            <select value={scheduleScanId} onChange={event => props.setScheduleScanIds(current => ({ ...current, [asset.id]: event.target.value }))} disabled={!data.tenableIntegration?.configured || !data.tenableScans.some(scan => scan.enabled)} className='h-8 min-w-44 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'>
                <option value=''>Choose an enabled template</option>{data.tenableScans.filter(scan => scan.enabled).map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}
            </select>
        </label>}
        <button type='button' onClick={() => props.onSchedule(asset, true)} disabled={busy === asset.id || !canSchedule || (!asset.scanAuthorizedAt && authorization[asset.id] !== true)} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold disabled:opacity-50'>Enable schedule</button>
        {asset.scheduleEnabled && <button type='button' onClick={() => props.onSchedule(asset, false)} disabled={busy === asset.id} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold'>Pause schedule</button>}
        {asset.scheduleEnabled && asset.nextRunAt && <span className='text-xs text-ui-muted'>Next run {formatDate(asset.nextRunAt)}</span>}
    </>
}

