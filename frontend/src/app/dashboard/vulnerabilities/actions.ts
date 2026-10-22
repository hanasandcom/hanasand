'use server'

import { cancelUvmAssessment, cancelUvmRun, configureUvmTenable, createUvmAsset, disconnectUvmTenable, getUvm, getVulnerabilities, getWebScan, startUvmAssessment, startUvmAssetScan, startUvmTenableScan, triggerVulnerabilityScan, triggerWebScan, updateUvmAssetSchedule, updateUvmFinding, updateWebScanSchedule, verifyUvmAsset } from '@/utils/monitoring/data'

export async function refreshVulnerabilityData() {
    return await getVulnerabilities()
}

export async function runVulnerabilityScanAction() {
    return await triggerVulnerabilityScan()
}

export async function refreshWebScan() { return await getWebScan() }
export async function runWebScanAction() { return await triggerWebScan() }
export async function updateWebScanScheduleAction(input: { enabled?: boolean, intervalMinutes?: number }) { return await updateWebScanSchedule(input) }
export async function refreshUvmAction() { return await getUvm() }
export async function createUvmAssetAction(input: { hostname: string }) { return await createUvmAsset(input) }
export async function verifyUvmAssetAction(assetId: string) { return await verifyUvmAsset(assetId) }
export async function runUvmAssetScanAction(assetId: string, authorized: boolean) { return await startUvmAssetScan(assetId, authorized) }
export async function updateUvmAssetScheduleAction(assetId: string, input: { enabled: boolean, intervalMinutes: number, authorized: boolean, engine: 'nmap' | 'tenable-vm', scanId?: string }) { return await updateUvmAssetSchedule(assetId, input) }
export async function configureUvmTenableAction(input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) { return await configureUvmTenable(input) }
export async function disconnectUvmTenableAction() { return await disconnectUvmTenable() }
export async function runUvmAssetTenableScanAction(assetId: string, scanId: string, authorized: boolean) { return await startUvmTenableScan(assetId, scanId, authorized) }
export async function updateUvmFindingAction(findingId: string, input: { status: 'open' | 'in_progress' | 'pending_verification' | 'accepted_risk' | 'false_positive' | 'resolved', note: string }) { return await updateUvmFinding(findingId, input) }
export async function cancelUvmRunAction(runId: string) { return await cancelUvmRun(runId) }
export async function startUvmAssessmentAction(input: Parameters<typeof startUvmAssessment>[0]) { return await startUvmAssessment(input) }
export async function cancelUvmAssessmentAction(assessmentId: string) { return await cancelUvmAssessment(assessmentId) }
