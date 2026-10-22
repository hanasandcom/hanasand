import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DashboardDataFallback, DashboardPage } from 'hanasand/dashboard'
import { getUvm, getWebScan } from '@/utils/monitoring/data'
import { cancelUvmRunAction, configureUvmTenableAction, createUvmAssetAction, disconnectUvmTenableAction, refreshUvmAction, refreshWebScan, runUvmAssetScanAction, runUvmAssetTenableScanAction, runWebScanAction, updateUvmAssetScheduleAction, updateUvmFindingAction, updateWebScanScheduleAction, verifyUvmAssetAction } from '../vulnerabilities/actions'
import WebScanPanel from '../vulnerabilities/webScanPanel'
import UvmPanel from './uvmPanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Security Scanner', description: 'Configure Tenable and Nmap assessments, scan verified assets, and triage vulnerability findings.' }

export default function ScannerPage() {
    return <DashboardPage><Suspense fallback={<DashboardDataFallback label='scanner results' />}><ScannerData /></Suspense></DashboardPage>
}

async function ScannerData() {
    const [uvm, webScan] = await Promise.all([getUvm(), getWebScan()])
    return <div className='grid gap-6'><UvmPanel initialData={uvm} refreshAction={refreshUvmAction} createAssetAction={createUvmAssetAction} verifyAssetAction={verifyUvmAssetAction} runScanAction={runUvmAssetScanAction} scheduleAction={updateUvmAssetScheduleAction} configureTenableAction={configureUvmTenableAction} disconnectTenableAction={disconnectUvmTenableAction} runTenableScanAction={runUvmAssetTenableScanAction} updateFindingAction={updateUvmFindingAction} cancelRunAction={cancelUvmRunAction} /><section><h2 className='mb-3 text-lg font-semibold'>Safe web checks</h2><WebScanPanel initialData={webScan} refreshAction={refreshWebScan} runAction={runWebScanAction} scheduleAction={updateWebScanScheduleAction} /></section></div>
}
