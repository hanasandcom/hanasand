import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DashboardDataFallback, DashboardPage } from 'hanasand/dashboard'
import { getUvm, getWebScan } from '@/utils/monitoring/data'
import { cancelUvmAssessmentAction, cancelUvmRunAction, configureUvmTenableAction, createUvmAssetAction, disconnectUvmTenableAction, refreshUvmAction, refreshWebScan, runUvmAssetScanAction, runUvmAssetTenableScanAction, runWebScanAction, startUvmAssessmentAction, updateUvmAssetScheduleAction, updateUvmFindingAction, updateWebScanScheduleAction, verifyUvmAssetAction } from '../vulnerabilities/actions'
import WebScanPanel from '../vulnerabilities/webScanPanel'
import UvmPanel from './uvmPanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Security Scanner', description: 'Configure vulnerability scanners, launch authorized multi-asset assessments, and triage findings with coverage.' }

export default function ScannerPage() {
    return <DashboardPage><Suspense fallback={<DashboardDataFallback label='scanner results' />}><ScannerData /></Suspense></DashboardPage>
}

async function ScannerData() {
    const [uvm, webScan] = await Promise.all([getUvm(), getWebScan()])
    return <div className='grid gap-6'>
        <UvmPanel initialData={uvm} refreshAction={refreshUvmAction} createAssetAction={createUvmAssetAction} verifyAssetAction={verifyUvmAssetAction} runScanAction={runUvmAssetScanAction} scheduleAction={updateUvmAssetScheduleAction} configureTenableAction={configureUvmTenableAction} disconnectTenableAction={disconnectUvmTenableAction} runTenableScanAction={runUvmAssetTenableScanAction} updateFindingAction={updateUvmFindingAction} cancelRunAction={cancelUvmRunAction} startAssessmentAction={startUvmAssessmentAction} cancelAssessmentAction={cancelUvmAssessmentAction} />
        <details className='rounded-lg border border-ui-border bg-ui-panel p-4'>
            <summary className='cursor-pointer text-sm font-semibold'>Basic HTTP checks</summary>
            <p className='mt-2 text-sm text-ui-muted'>These checks inspect HTTPS reachability and response headers. They do not run a vulnerability assessment; use the authorized assessment workflow above for Nmap, Tenable VM, or Greenbone scans.</p>
            <div className='mt-4'><WebScanPanel initialData={webScan} refreshAction={refreshWebScan} runAction={runWebScanAction} scheduleAction={updateWebScanScheduleAction} /></div>
        </details>
    </div>
}
