'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'
import { scannerSuiteCatalog } from './scannerSuiteCatalog'

export type TenableRegion = 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp'

export function UvmPanelScannerSetup({ data, busy, region, setRegion, accessKey, setAccessKey, secretKey, setSecretKey, servicesPaused, onSave, onDisconnect }: {
    data: UvmDashboard
    busy: string
    region: TenableRegion
    setRegion: Dispatch<SetStateAction<TenableRegion>>
    accessKey: string
    setAccessKey: Dispatch<SetStateAction<string>>
    secretKey: string
    setSecretKey: Dispatch<SetStateAction<string>>
    servicesPaused: boolean
    onSave: (event: FormEvent<HTMLFormElement>) => void
    onDisconnect: () => void
}) {
    const integration = data.tenableIntegration
    return <>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'><div className='flex items-center gap-2'><h2 className='text-lg font-semibold'>Nessus via Tenable VM</h2><UvmHelp label='Tenable VM connection' text='This connects a Tenable cloud account and launches its enabled Nessus scan configurations. Standalone Nessus Pro hosts are not connected.' /></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${integration?.configured ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{integration?.configured ? `Connected · ${integration.region}` : 'Not configured'}</span></div>
            {!integration?.configured ? <form onSubmit={onSave} className='mt-4 grid gap-3 sm:grid-cols-2'>
                <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={region} onChange={event => setRegion(event.target.value as TenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={accessKey} onChange={event => setAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={secretKey} onChange={event => setSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                <button disabled={busy === 'tenable' || !accessKey.trim() || !secretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
            </form> : <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {integration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(integration.testedAt)}</span><button type='button' onClick={onDisconnect} disabled={busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text'>Disconnect</button></div>}
            {integration?.error && <p className='mt-2 text-xs text-ui-warning'>{integration.error}</p>}
            {integration?.configured && !data.tenableScans.length && <p className='mt-3 text-sm text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available.'}</p>}
        </section>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Scanner suite · {scannerSuiteCatalog.length}</h2><UvmHelp label='Scanner suite' text='Integrated engines are shown with live status. Catalog entries need a compatible adapter and license review before they can run.' /></div>
            {servicesPaused && <p role='status' className='mt-2 text-xs text-ui-warning'>Configured services are stopped pending disk expansion. No scanner is running.</p>}
            <div className='mt-3 grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3'>
                {scannerSuiteCatalog.map(item => {
                    const engine = ['nmap', 'tenable-vm', 'gvm', 'zap'].includes(item.integration)
                        ? data.engines.find(candidate => candidate.id === item.integration)
                        : undefined
                    const status = item.integration === 'desktop-only' ? 'Desktop only'
                        : item.integration === 'cli-review' ? 'CLI validation needed'
                            : item.integration === 'catalog-only' ? 'Adapter setup needed'
                            : servicesPaused && item.integration === 'nmap' ? 'Stopped · disk and license review'
                                : servicesPaused ? 'Stopped · disk expansion'
                                    : engine?.status || (item.integration === 'image-worker' ? 'Integrated · image worker' : 'Unavailable')
                    const statusClass = servicesPaused && !['desktop-only', 'cli-review', 'catalog-only'].includes(item.integration)
                        ? 'text-ui-warning'
                        : item.integration === 'catalog-only' || item.integration === 'desktop-only' || item.integration === 'cli-review'
                            ? 'text-ui-muted'
                            : engine?.status === 'available' ? 'text-ui-success' : 'text-ui-warning'
                    return <div key={item.name} className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ui-border py-2 text-sm'>
                        <span className='font-medium'>{item.name}<span className='ml-2 text-xs font-normal text-ui-muted'>{item.category}</span></span>
                        <span className={`text-xs ${statusClass}`}>{status}</span>
                    </div>
                })}
            </div>
        </section>
    </>
}
