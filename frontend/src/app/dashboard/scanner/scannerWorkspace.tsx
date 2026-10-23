'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import type { UvmDashboard } from '@/utils/monitoring/types'
import UvmPanel from './uvmPanel'
import ScannerPauseNotice, { SCANNER_SERVICES_PAUSED } from './scannerPauseNotice'
import { createScannerClient, emptyUvmDashboard } from './scannerClient'

export default function ScannerWorkspace() {
    const { organizationId } = useWorkspace()
    const client = useMemo(() => createScannerClient(organizationId), [organizationId])
    const organizationRef = useRef(organizationId)
    organizationRef.current = organizationId
    const [dataState, setDataState] = useState<{ organizationId: string | null, data: UvmDashboard }>({ organizationId, data: emptyUvmDashboard })
    const data = dataState.organizationId === organizationId ? dataState.data : emptyUvmDashboard
    const setData = useCallback((next: UvmDashboard | ((current: UvmDashboard) => UvmDashboard)) => {
        const owner = organizationId
        if (organizationRef.current !== owner) return
        setDataState(current => {
            const base = current.organizationId === owner ? current.data : emptyUvmDashboard
            return { organizationId: owner, data: typeof next === 'function' ? next(base) : next }
        })
    }, [organizationId])
    const refresh = useCallback(async () => {
        if (SCANNER_SERVICES_PAUSED) {
            const paused = { ...emptyUvmDashboard, scannerError: 'Scanner services are stopped pending disk expansion.' }
            setData(paused)
            return paused
        }
        if (!organizationId) {
            const noOrganization = { ...emptyUvmDashboard, scannerError: 'Choose an organization from the workspace selector to use Scanner.' }
            setData(noOrganization)
            return noOrganization
        }
        try {
            const next = await client.getDashboard()
            setData(next)
            return next
        } catch (error) {
            setData(current => ({
                ...current,
                scannerError: error instanceof Error ? error.message : 'Scanner service is unavailable.',
            }))
            throw error
        }
    }, [client, organizationId])

    useEffect(() => {
        void refresh().catch(() => undefined)
    }, [refresh])

    return <div className='grid gap-4'>
        <ScannerPauseNotice />
        <UvmPanel
            key={organizationId || 'personal-workspace'}
            initialData={data}
            servicesPaused={SCANNER_SERVICES_PAUSED}
            refreshAction={refresh}
            createAssetAction={client.createAsset}
            verifyAssetAction={client.verifyAsset}
            saveZapApiDefinitionAction={client.saveZapApiDefinition}
            runScanAction={client.runAsset}
            scheduleAction={client.scheduleAsset}
            configureTenableAction={client.configureTenable}
            disconnectTenableAction={client.disconnectTenable}
            runTenableScanAction={client.runTenable}
            runGvmScanAction={client.runGvm}
            runZapScanAction={client.runZap}
            updateFindingAction={client.updateFinding}
            cancelRunAction={client.cancelRun}
            startAssessmentAction={client.startAssessment}
            cancelAssessmentAction={client.cancelAssessment}
            getAssessmentReportAction={client.getAssessmentReport}
        />
    </div>
}
