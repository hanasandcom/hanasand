import type {
    NmapScanProfile,
    UvmAsset,
    UvmAssessment,
    UvmAssessmentHistoryPage,
    UvmAssessmentMode,
    UvmAssessmentReport,
    UvmDashboard,
    UvmEngineSelection,
    UvmAssetCriticality,
    UvmFindingHistoryPage,
    UvmFindingGroupHistoryPage,
    UvmFindingHistoryScope,
    UvmFindingTriageHistoryPage,
    UvmFindingUpdate,
    UvmImageReport,
    UvmImageScanHistoryPage,
    UvmImageScanRun,
    UvmRun,
    UvmRunHistoryPage,
    UvmZapAuthenticationInput,
    UvmZapAuthenticationStatus,
} from '@/utils/monitoring/types'

export type UvmPanelProps = {
    initialData: UvmDashboard
    servicesPaused?: boolean
    preparationStorageScope?: string
    refreshAction: () => Promise<UvmDashboard>
    getImageReportAction: () => Promise<UvmImageReport>
    runImageScanAction: () => Promise<{ queued: boolean, started: boolean, jobId: string | null, report: UvmImageReport }>
    getImageHistoryAction: (cursor: string | null) => Promise<UvmImageScanHistoryPage>
    getImageHistoryRunAction: (runId: string) => Promise<{ run: UvmImageScanRun }>
    getRunAction: (runId: string, engine: string) => Promise<UvmRun>
    getRunHistoryAction: (cursor: string | null) => Promise<UvmRunHistoryPage>
    assessmentHistoryAction: (cursor: string | null) => Promise<UvmAssessmentHistoryPage>
    findingHistoryAction: (cursor: string | null, scope?: UvmFindingHistoryScope) => Promise<UvmFindingHistoryPage>
    findingGroupsAction: (cursor: string | null) => Promise<UvmFindingGroupHistoryPage>
    findingTriageHistoryAction: (findingId: string, cursor: string | null) => Promise<UvmFindingTriageHistoryPage>
    createAssetAction: (input: { hostname: string }) => Promise<{ asset: UvmAsset }>
    updateAssetCriticalityAction: (assetId: string, criticality: UvmAssetCriticality) => Promise<{ asset: UvmAsset }>
    verifyAssetAction: (assetId: string) => Promise<{ asset: UvmAsset }>
    saveZapApiDefinitionAction: (assetId: string, path: string | null) => Promise<{ asset: UvmAsset }>
    configureZapAuthenticationAction: (assetId: string, input: UvmZapAuthenticationInput) => Promise<{ authentication: UvmZapAuthenticationStatus }>
    removeZapAuthenticationAction: (assetId: string) => Promise<{ authentication: UvmZapAuthenticationStatus }>
    runScanAction: (assetId: string, authorized: boolean, profile: NmapScanProfile) => Promise<{ run: UvmRun }>
    runNaabuAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runMasscanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runAngryIpAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    scheduleAction: (assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engines: UvmEngineSelection[], mode: UvmAssessmentMode }) => Promise<{ asset: UvmAsset }>
    configureTenableAction: (input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    disconnectTenableAction: () => Promise<{ integration: NonNullable<UvmDashboard['tenableIntegration']> }>
    runTenableScanAction: (assetId: string, scanId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runGvmScanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runZapScanAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runTestsslAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runNucleiAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runNiktoAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runSslyzeAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWapitiAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWhatwebAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runHttpxAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runTlsxAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runKatanaAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    runWafw00fAction: (assetId: string, authorized: boolean) => Promise<{ run: UvmRun }>
    updateFindingAction: (findingId: string, input: UvmFindingUpdate) => Promise<unknown>
    cancelRunAction: (runId: string) => Promise<{ run: UvmRun }>
    startAssessmentAction: (input: { requestId: string, assetIds: string[], engines: UvmEngineSelection[], mode: UvmAssessmentMode, authorized: boolean }) => Promise<{ assessment: UvmAssessment }>
    cancelAssessmentAction: (assessmentId: string) => Promise<{ assessment: UvmAssessment }>
    getAssessmentReportAction: (assessmentId: string) => Promise<{ assessment: UvmAssessmentReport }>
}
