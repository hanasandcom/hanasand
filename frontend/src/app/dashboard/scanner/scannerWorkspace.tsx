'use client'

import { useCallback, useEffect, useState } from 'react'
import type { UvmDashboard } from '@/utils/monitoring/types'
import UvmPanel from './uvmPanel'
import ScannerPauseNotice, { SCANNER_SERVICES_PAUSED } from './scannerPauseNotice'
import {
    cancelScannerAssessment, cancelScannerRun, configureScannerTenable, createScannerAsset,
    disconnectScannerTenable, emptyUvmDashboard, getScannerDashboard, runScannerAsset,
    runScannerTenable, scheduleScannerAsset, startScannerAssessment, updateScannerFinding,
    verifyScannerAsset,
} from './scannerClient'

export default function ScannerWorkspace() {
    const [data, setData] = useState<UvmDashboard>(emptyUvmDashboard)
    const refresh = useCallback(async () => {
        const next = await getScannerDashboard()
        setData(next)
        return next
    }, [])

    useEffect(() => {
        void getScannerDashboard().then(setData).catch(error => setData({
            ...emptyUvmDashboard,
            scannerError: error instanceof Error ? error.message : 'Scanner service is unavailable.',
        }))
    }, [])

    return <div className='grid gap-4'>
        {SCANNER_SERVICES_PAUSED && <ScannerPauseNotice />}
        <UvmPanel
            initialData={data}
            servicesPaused={SCANNER_SERVICES_PAUSED}
            refreshAction={refresh}
            createAssetAction={createScannerAsset}
            verifyAssetAction={verifyScannerAsset}
            runScanAction={runScannerAsset}
            scheduleAction={scheduleScannerAsset}
            configureTenableAction={configureScannerTenable}
            disconnectTenableAction={disconnectScannerTenable}
            runTenableScanAction={runScannerTenable}
            updateFindingAction={updateScannerFinding}
            cancelRunAction={cancelScannerRun}
            startAssessmentAction={startScannerAssessment}
            cancelAssessmentAction={cancelScannerAssessment}
        />
    </div>
}
