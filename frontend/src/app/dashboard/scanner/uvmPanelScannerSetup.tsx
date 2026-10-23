'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'

export type TenableRegion = 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp'

export function UvmPanelScannerSetup({ data, busy, region, setRegion, accessKey, setAccessKey, secretKey, setSecretKey, onSave, onDisconnect }: {
    data: UvmDashboard
    busy: string
    region: TenableRegion
    setRegion: Dispatch<SetStateAction<TenableRegion>>
    accessKey: string
    setAccessKey: Dispatch<SetStateAction<string>>
    secretKey: string
    setSecretKey: Dispatch<SetStateAction<string>>
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
            <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Engine coverage</h2><UvmHelp label='Engine coverage' text='Engine coverage describes what each profile checks. Automated scans find some issues, but do not establish that an application is secure or replace a penetration test.' /></div>
            {data.engines.map(engine => <div key={engine.id} className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-center gap-2 text-sm'><strong>{engine.name}</strong><span className={engine.status === 'available' ? 'text-ui-success' : 'text-ui-warning'}>{engine.status}</span>{engine.version && <span className='text-xs text-ui-muted'>v{engine.version}</span>}</div>
                {engine.reason && <p className='mt-1 text-xs text-ui-warning'>{engine.reason}</p>}
                {engine.profiles.map(profile => <details key={profile.id} className='mt-2 text-xs'><summary className='cursor-pointer font-semibold'>{profile.name} · coverage details</summary><div className='mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2'><p><span className='font-semibold'>Checks:</span> {engine.coverage.join(' · ') || 'Not reported'}</p><p><span className='font-semibold'>Limits:</span> {engine.notCovered.join(' · ') || 'Not reported'}</p></div></details>)}
            </div>)}
            {!data.engines.length && <p className='mt-2 text-sm text-ui-warning'>{data.scannerError || 'No scanner engines are available.'}</p>}
        </section>
    </>
}
