'use client'

import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'
import { getScannerSuiteCatalog } from './scannerSuiteCatalog'
import { UVM_ASSET_ASSESSMENT_ENGINE_IDS } from './uvmPanelAssessmentControls'

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
    const [productQuery, setProductQuery] = useState('')
    const integration = data.tenableIntegration
    const productCatalog = getScannerSuiteCatalog(data.scannerCatalog)
    const assetEngineCount = productCatalog.filter(item => UVM_ASSET_ASSESSMENT_ENGINE_IDS.includes(item.integration as typeof UVM_ASSET_ASSESSMENT_ENGINE_IDS[number])).length
    const imageToolCount = productCatalog.filter(item => item.integration === 'image-worker' || item.integration === 'grype').length
    const filteredProducts = productCatalog.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(productQuery.trim().toLowerCase()))
    const renderProducts = (products: typeof productCatalog) => products.map(item => {
        const engine = ['nmap', 'naabu', 'tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei', 'nikto', 'sslyze', 'wapiti', 'whatweb', 'httpx', 'tlsx', 'katana', 'wafw00f'].includes(item.integration)
            ? data.engines.find(candidate => candidate.id === item.integration)
            : undefined
        const status = item.setup === 'desktop-only' ? 'Windows app · no API'
            : item.setup === 'cli-review-needed' ? 'GUI bridge needed'
                : item.setup === 'license-and-adapter-needed' ? 'License + adapter needed'
                    : item.setup === 'adapter-needed' ? 'Adapter needed'
                        : servicesPaused ? 'Stopped'
                            : item.integration === 'image-worker' || item.integration === 'grype' ? 'Integrated · image worker'
                                : engine?.status || 'Unavailable'
        const statusClass = item.setup !== 'configured' ? 'text-ui-muted'
            : servicesPaused ? 'text-ui-warning'
                : engine?.status === 'available' || item.integration === 'image-worker' || item.integration === 'grype' ? 'text-ui-success' : 'text-ui-warning'
        return <div key={item.id || item.name} className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ui-border py-2 text-sm'>
            <span className='font-medium'>{item.name}<span className='ml-2 text-xs font-normal text-ui-muted'>{item.category}</span></span>
            <span className={`text-xs ${statusClass}`}>{status}</span>
        </div>
    })
    return <>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'><div><h2 className='text-lg font-semibold'>Scanner suite</h2><p className='mt-1 text-xs text-ui-muted'>{productCatalog.length} products · {assetEngineCount} asset engines · {imageToolCount} image tools{servicesPaused ? ' · 0 running · stopped pending disk' : ''}</p></div><UvmHelp label='Scanner suite' text='Asset engines scan verified public assets. Image tools inspect container images. Other products are catalog entries awaiting an adapter, license, or supported host.' /></div>
            {servicesPaused && <p role='status' className='mt-2 text-xs text-ui-warning'>Configured services are stopped pending disk expansion. No scanner is running.</p>}
            <label className='mt-3 block'><span className='sr-only'>Filter scanners</span><input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder='Filter scanners' className='h-9 w-full rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text placeholder:text-ui-muted' /></label>
            <div className='mt-2 max-h-80 overflow-y-auto rounded-md border border-ui-border px-3'><div className='grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3'>{renderProducts(filteredProducts)}</div>{filteredProducts.length === 0 && <p className='py-3 text-sm text-ui-muted'>No scanners match that filter.</p>}</div>
        </section>
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'><div className='flex items-center gap-2'><h2 className='text-lg font-semibold'>Nessus via Tenable VM</h2><UvmHelp label='Tenable VM connection' text='This connects a Tenable cloud account and launches its enabled Nessus scan configurations. Standalone Nessus Pro hosts are not connected.' /></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${integration?.configured ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>{servicesPaused && !integration?.configured ? 'Unavailable while stopped' : integration?.configured ? `Connected · ${integration.region}` : 'Not configured'}</span></div>
            {servicesPaused && !integration?.configured ? <p className='mt-2 text-sm text-ui-warning'>Connection setup is unavailable while Scanner is stopped.</p>
                : !integration?.configured ? <form onSubmit={onSave} className='mt-4 grid gap-3 sm:grid-cols-2'>
                    <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={region} onChange={event => setRegion(event.target.value as TenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                    <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={accessKey} onChange={event => setAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={secretKey} onChange={event => setSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text' /></label>
                    <button disabled={busy === 'tenable' || !accessKey.trim() || !secretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
                </form> : <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {integration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(integration.testedAt)}</span><button type='button' onClick={onDisconnect} disabled={servicesPaused || busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text disabled:opacity-50'>Disconnect</button></div>}
            {integration?.error && <p className='mt-2 text-xs text-ui-warning'>{integration.error}</p>}
            {integration?.configured && !data.tenableScans.length && <p className='mt-3 text-sm text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available.'}</p>}
        </section>
    </>
}
