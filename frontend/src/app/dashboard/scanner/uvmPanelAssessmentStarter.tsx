import type { UvmDashboard } from '@/utils/monitoring/types'
import { UvmHelp } from './uvmPanelHelp'

export function UvmAssessmentStarter({ data, servicesPaused = false, onManageAssets, onConfigureScanners, onStartAssessment }: {
    data: UvmDashboard
    servicesPaused?: boolean
    onManageAssets: () => void
    onConfigureScanners: () => void
    onStartAssessment: () => void
}) {
    const verifiedAssets = data.assets.filter(asset => asset.verificationStatus === 'verified').length
    const tenableReady = data.tenableIntegration?.configured === true && data.tenableScans.some(scan => scan.enabled)
    const selectable = (engine: UvmDashboard['engines'][number]) => engine.status === 'available' && (engine.id !== 'tenable-vm' || tenableReady)
    const readyEngines = data.engines.filter(selectable)
    const unavailableEngineCount = data.engines.filter(engine => !selectable(engine)).length
    const statusUnavailable = Boolean(data.scannerError)
    const nextAction = servicesPaused ? onConfigureScanners : !verifiedAssets ? onManageAssets : readyEngines.length ? onStartAssessment : onConfigureScanners
    const nextLabel = servicesPaused ? 'Review scanner setup' : !verifiedAssets ? 'Add and verify an asset' : readyEngines.length ? 'Choose scope and scanners' : 'Configure a scanner'

    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
            <h2 className='text-base font-semibold'>Assessment readiness</h2>
            <div className='flex items-center gap-2'><UvmHelp label='Assessment scope and engines' text='Nmap inventories selected TCP or UDP services; Tenable VM and Greenbone check known vulnerabilities; ZAP checks the web origin. DNS scope is rechecked at launch.' /><button type='button' onClick={nextAction} disabled={statusUnavailable} className='rounded-md bg-ui-text px-3 py-2 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{statusUnavailable ? 'Unavailable' : nextLabel}</button></div>
        </div>
        {statusUnavailable ? <p className='mt-2 text-sm text-ui-warning'>Scanner status unavailable: {data.scannerError}</p> : <p className='mt-2 text-sm text-ui-muted'>{servicesPaused ? 'Assessment execution is paused.' : `${verifiedAssets} verified asset${verifiedAssets === 1 ? '' : 's'} · ${readyEngines.length} engines ready${unavailableEngineCount ? ` · ${unavailableEngineCount} unavailable` : ''}`}</p>}
        {!statusUnavailable && !servicesPaused && !readyEngines.length && <p className='mt-2 text-sm text-ui-warning'>No engines ready. <button type='button' onClick={onConfigureScanners} className='font-semibold underline underline-offset-2'>Scanner setup</button></p>}
        {!statusUnavailable && !servicesPaused && readyEngines.length > 0 && unavailableEngineCount > 0 && <button type='button' onClick={onConfigureScanners} className='mt-2 w-fit text-xs font-semibold text-ui-muted underline underline-offset-2'>View scanner status</button>}
    </section>
}
