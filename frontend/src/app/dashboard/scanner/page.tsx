import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DashboardPage } from 'hanasand/dashboard'
import ScannerWorkspace from './scannerWorkspace'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Security Scanner', description: 'Configure vulnerability scanners, launch authorized multi-asset assessments, and triage findings with coverage.' }

export default function ScannerPage() {
    return <DashboardPage><Suspense fallback={<div className='p-4 text-sm text-ui-muted'>Loading Scanner…</div>}><ScannerWorkspace /></Suspense></DashboardPage>
}
