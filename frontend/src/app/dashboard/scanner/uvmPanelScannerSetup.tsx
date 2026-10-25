'use client'

import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'
import { formatDate } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'
import { getScannerSuiteCatalog, type ScannerCatalogEntry } from './scannerSuiteCatalog'
import { UVM_ASSET_ASSESSMENT_ENGINE_IDS } from './uvmPanelAssessmentControls'
import UvmOfflinePreparation from './uvmOfflinePreparation'
import type { PreparationDraft } from './uvmOfflinePreparation'
import type { TenableRegion } from './uvmPanelTenableActions'

const scannerCategories = [
    { id: 'web', label: 'Web' }, { id: 'discovery', label: 'Discovery' }, { id: 'cloud', label: 'Cloud' },
] as const
type ScannerCategory = typeof scannerCategories[number]['id']

export function getScannerSuiteCategory(item: ScannerCatalogEntry): ScannerCategory {
    return item.category === 'Web' ? 'web' : item.category === 'Cloud and code' ? 'cloud' : 'discovery'
}

export function UvmPanelScannerSetup({ data, busy, region, setRegion, accessKey, setAccessKey, secretKey, setSecretKey, servicesPaused, preparationStorageScope = '', createAssetAction, onAssetsRegistered, onDraftChange, onSave, onDisconnect }: {
    data: UvmDashboard
    busy: string
    region: TenableRegion
    setRegion: Dispatch<SetStateAction<TenableRegion>>
    accessKey: string
    setAccessKey: Dispatch<SetStateAction<string>>
    secretKey: string
    setSecretKey: Dispatch<SetStateAction<string>>
    servicesPaused: boolean
    preparationStorageScope?: string
    createAssetAction: (input: { hostname: string }) => Promise<unknown>
    onAssetsRegistered: () => Promise<void>
    onDraftChange: (draft: PreparationDraft) => void
    onSave: (event: FormEvent<HTMLFormElement>) => void
    onDisconnect: () => void
}) {
    const [productQuery, setProductQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<ScannerCategory>('web')
    const [tenableSetupOpen, setTenableSetupOpen] = useState(false)
    const categoryTabRefs = useRef<Array<HTMLButtonElement | null>>([])
    const categoryPanelId = 'scanner-suite-category-panel'
    const integration = data.tenableIntegration
    const apiUnavailable = Boolean(data.scannerError)
    const productCatalog = getScannerSuiteCatalog(data.scannerCatalog)
    const assetEngineCount = productCatalog.filter(item => UVM_ASSET_ASSESSMENT_ENGINE_IDS.includes(item.integration as typeof UVM_ASSET_ASSESSMENT_ENGINE_IDS[number])).length
    const imageToolCount = productCatalog.filter(item => item.integration === 'image-worker' || item.integration === 'grype').length
    const query = productQuery.trim().toLowerCase()
    const filteredProducts = productCatalog.filter(item => getScannerSuiteCategory(item) === activeCategory && `${item.name} ${item.category}`.toLowerCase().includes(query))
    const renderProducts = (products: typeof productCatalog) => products.map(item => {
        const engine = ['nmap', 'naabu', 'masscan', 'angry-ip-scanner', 'tenable-vm', 'gvm', 'zap', 'testssl', 'nuclei', 'nikto', 'sslyze', 'wapiti', 'whatweb', 'httpx', 'tlsx', 'katana', 'wafw00f'].includes(item.integration)
            ? data.engines.find(candidate => candidate.id === item.integration)
            : undefined
        const outputCheckPending = item.integration === 'angry-ip-scanner' && Boolean(engine?.reason)
        const imageWorkerProduct = item.integration === 'image-worker' || item.integration === 'grype'
        const isDockerScout = item.name.toLowerCase().includes('docker scout')
        const imageWorker = data.imageWorker
        const imageWorkerStatus = servicesPaused ? 'Worker stopped'
            : imageWorker?.status === 'available'
                ? isDockerScout && !imageWorker.scoutCredentialsPresent ? 'Scout credentials missing' : 'Worker ready'
                : imageWorker?.status === 'unavailable' ? 'Worker unavailable' : 'Worker status unavailable'
        const imageWorkerDetail = imageWorker?.reason || (isDockerScout
            ? imageWorker?.scoutCredentialsPresent
                ? 'Docker Scout credentials are present. A successful scan validates them.'
                : 'Docker Scout credentials are not configured for the image worker.'
            : 'The image worker has not reported readiness.')
        const status = item.setup === 'desktop-only' ? 'Windows app · no API'
            : item.setup === 'cli-review-needed' ? 'GUI bridge needed'
                : item.setup === 'license-and-adapter-needed' ? 'License + adapter needed'
                    : item.setup === 'adapter-needed' ? 'Adapter needed'
                        : imageWorkerProduct ? imageWorkerStatus
                            : servicesPaused ? 'Stopped'
                                : item.integration === 'zap-addon' ? 'Included in ZAP'
                                    : outputCheckPending && engine?.status === 'available' ? 'Ready · output check pending'
                                        : engine?.status || 'Unavailable'
        const statusClass = item.setup !== 'configured' ? 'text-ui-muted'
            : servicesPaused ? 'text-ui-warning'
                : imageWorkerProduct ? imageWorker?.status === 'available' && (!isDockerScout || imageWorker.scoutCredentialsPresent) ? 'text-ui-success' : 'text-ui-warning'
                    : (engine?.status === 'available' && !outputCheckPending) || item.integration === 'zap-addon' ? 'text-ui-success' : 'text-ui-warning'
        return <div key={item.id || item.name} className='border-t border-ui-border py-2 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
                <span className='flex items-center gap-2'><span className='font-medium'>{item.integration === 'tenable-vm' ? 'Nessus' : item.name}</span>{item.integration === 'angry-ip-scanner' && <UvmHelp label='Angry IP Scanner' text='Confirms host reachability only. The first authorized run also checks its CSV output format.' />}{imageWorkerProduct && <UvmHelp label={`${item.name} status`} text={imageWorkerDetail} />}</span>
                <span className='flex items-center gap-3'><span className={`text-xs ${statusClass}`}>{status}</span>{item.integration === 'tenable-vm' && <button type='button' aria-expanded={tenableSetupOpen} onClick={() => setTenableSetupOpen(open => !open)} className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold'>{integration?.configured ? 'Settings' : 'Configure'}</button>}</span>
            </div>
            {item.integration === 'tenable-vm' && tenableSetupOpen && <div className='mt-3 rounded-md border border-ui-border bg-ui-canvas p-3'>
                <div className='mb-3 flex items-center justify-between gap-2'><span className='text-sm font-medium'>Tenable VM</span><UvmHelp label='Tenable connection' text='Use a Tenable VM account to manage enabled Nessus scan configurations.' />{integration?.configured && <span className='text-xs text-ui-muted'>Connected · {integration.region}</span>}</div>
                {!integration?.configured ? <form onSubmit={onSave} className='grid gap-3 sm:grid-cols-2'>
                    <label className='grid gap-1 text-xs text-ui-muted'>Cloud region<select value={region} onChange={event => setRegion(event.target.value as TenableRegion)} className='h-10 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text'><option value='us'>United States</option><option value='eu'>Europe</option><option value='de'>Germany</option><option value='au'>Australia</option><option value='ca'>Canada</option><option value='jp'>Japan</option></select></label><div />
                    <label className='grid gap-1 text-xs text-ui-muted'>Access key<input autoComplete='off' value={accessKey} onChange={event => setAccessKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text' /></label>
                    <label className='grid gap-1 text-xs text-ui-muted'>Secret key<input autoComplete='new-password' type='password' value={secretKey} onChange={event => setSecretKey(event.target.value)} className='h-10 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text' /></label>
                    <button disabled={apiUnavailable || busy === 'tenable' || !accessKey.trim() || !secretKey.trim()} className='h-10 w-fit rounded-md bg-ui-text px-4 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy === 'tenable' ? 'Checking…' : 'Connect Tenable'}</button>
                </form> : <div className='flex flex-wrap items-center gap-3 text-xs text-ui-muted'><span>Access key {integration.accessKeyHint || 'stored'}</span><span>Last checked {formatDate(integration.testedAt)}</span><button type='button' onClick={onDisconnect} disabled={apiUnavailable || busy === 'tenable'} className='rounded-md border border-ui-border px-3 py-2 font-semibold text-ui-text disabled:opacity-50'>Disconnect</button></div>}
                {apiUnavailable && <p role='status' className='mt-3 text-xs text-ui-warning'>Scanner API unavailable. Setup changes cannot be saved.</p>}
                {integration?.error && <p role='status' className='mt-2 text-xs text-ui-warning'>{integration.error}</p>}
                {integration?.configured && !data.tenableScans.length && <p className='mt-2 text-xs text-ui-muted'>{data.scannerError || 'No Tenable scan templates are available.'}</p>}
            </div>}
        </div>
    })
    return <>
        {servicesPaused && <UvmOfflinePreparation key={preparationStorageScope} storageScope={preparationStorageScope} apiAvailable={!apiUnavailable} onRegisterAsset={createAssetAction} onAssetsRegistered={onAssetsRegistered} onDraftChange={onDraftChange} />}
        <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'><div><h2 className='text-lg font-semibold'>Scanner suite</h2><p className='mt-1 text-xs text-ui-muted'>{productCatalog.length} products · {assetEngineCount} asset engines · {imageToolCount} image tools{servicesPaused ? ' · 0 running' : ''}</p></div><UvmHelp label='Scanner suite' text='Readiness labels mark tools that still need an adapter, license, or supported host.' /></div>
            <label className='mt-3 block'><span className='sr-only'>Filter scanners</span><input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder='Filter scanners' className='h-9 w-full rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text placeholder:text-ui-muted' /></label>
            <div role='tablist' aria-label='Scanner categories' onKeyDown={event => {
                const currentIndex = scannerCategories.findIndex(category => category.id === activeCategory)
                const nextIndex = event.key === 'ArrowRight' ? (currentIndex + 1) % scannerCategories.length
                    : event.key === 'ArrowLeft' ? (currentIndex - 1 + scannerCategories.length) % scannerCategories.length
                        : event.key === 'Home' ? 0 : event.key === 'End' ? scannerCategories.length - 1 : -1
                if (nextIndex < 0) return
                event.preventDefault()
                setActiveCategory(scannerCategories[nextIndex].id)
                categoryTabRefs.current[nextIndex]?.focus()
            }} className='mt-3 grid grid-cols-3 gap-1 rounded-lg border border-ui-border bg-ui-canvas p-1'>
                {scannerCategories.map((category, index) => <button key={category.id} ref={element => { categoryTabRefs.current[index] = element }} type='button' role='tab' id={`${categoryPanelId}-tab-${category.id}`} aria-selected={activeCategory === category.id} aria-controls={categoryPanelId} tabIndex={activeCategory === category.id ? 0 : -1} onClick={() => setActiveCategory(category.id)} className={`min-h-10 min-w-0 rounded-md px-1.5 text-xs font-medium leading-4 transition-colors sm:px-3 sm:text-sm ${activeCategory === category.id ? 'bg-ui-raised text-ui-text shadow-sm' : 'text-ui-muted hover:bg-ui-raised/60 hover:text-ui-text'}`}>
                    {category.label}
                </button>)}
            </div>
            <section role='tabpanel' id={categoryPanelId} aria-labelledby={`${categoryPanelId}-tab-${activeCategory}`} tabIndex={0} className='mt-2 max-h-80 min-w-0 overflow-y-auto rounded-md border border-ui-border px-3 outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                <div className='grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3'>
                    {filteredProducts.length ? renderProducts(filteredProducts) : <p className='py-3 text-sm text-ui-muted'>{query ? 'No scanners match that filter.' : 'No scanners in this category.'}</p>}
                </div>
            </section>
            {apiUnavailable && <p role='status' className='mt-3 text-xs text-ui-warning'>Scanner API unavailable.</p>}
        </section>
    </>
}
