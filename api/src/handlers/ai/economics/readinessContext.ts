import { numberValue } from './numberValue.ts'
import { latestAttempt } from './formatting.ts'
import type { CommercialReadinessInput } from './types.ts'

export function prepareCommercialReadiness(input: CommercialReadinessInput) {
    const { reliability, deployment, release, designQuality, latestVerificationJobs = [], eventCount, verifiedUnits, costNok, productiveMinutes } = input
    const deploymentCount = numberValue(deployment?.deployment_count)
    const recentDeploymentCount = numberValue(deployment?.recent_deployment_count)
    const runningDeployments = numberValue(deployment?.running_deployments)
    const healthcheckedDeployments = numberValue(deployment?.healthchecked_deployments)
    const deploymentsWithSyncEvents = numberValue(deployment?.deployments_with_sync_events)
    const deploymentsWithStack = numberValue(deployment?.deployments_with_stack)
    const deploymentsWithAccessPolicy = numberValue(deployment?.deployments_with_access_policy)
    const releaseCount = numberValue(release?.release_count)
    const recentReleaseCount = numberValue(release?.recent_release_count)
    const rollbackReadyReleases = numberValue(release?.rollback_ready_releases)
    const currentReleases = numberValue(release?.current_releases)
    const supersededReleases = numberValue(release?.superseded_releases)
    const failedReleases = numberValue(release?.failed_releases)
    const designCompleted = numberValue(designQuality?.completed)
    const designFailed = numberValue(designQuality?.failed)
    const designTotal = numberValue(designQuality?.total)
    const designAvgScore = numberValue(designQuality?.avg_score)
    const latestVerificationByKind = new Map(latestVerificationJobs.map((row) => [row.kind, row]))
    const lastVerificationAttempt = latestAttempt(latestVerificationJobs)
    const hasVerificationSamples = reliability.verificationLatency.some((row) => row.sampleCount > 0) || reliability.buildDeploy.some((row) => row.total > 0)
    const hasQueueTelemetry = reliability.queueDepth.length > 0 || reliability.capacity.totalAvailableSessions > 0
    const hasMeasuredEconomics = eventCount > 0 && (verifiedUnits > 0 || costNok > 0 || productiveMinutes > 0)
    const hasDeploymentOwnership = deploymentCount > 0 && deploymentsWithSyncEvents > 0 && deploymentsWithAccessPolicy > 0 && (runningDeployments > 0 || healthcheckedDeployments > 0 || releaseCount > 0)
    const hasTrustRecovery = releaseCount > 0 && rollbackReadyReleases > 0 && currentReleases > 0
    const hasDesignProof = designTotal > 0
    const designPassRate = designTotal > 0 ? designCompleted / designTotal : 0
    const timingSampleCount = reliability.verificationLatency.reduce((sum, row) => sum + row.sampleCount, 0)
    const hasPromptUxEvidence = reliability.promptTiming.sampleCount > 0
    const hasDeployTimingEvidence = reliability.deployTiming.sampleCount > 0
    return {
        ...input,
        reliability, eventCount, verifiedUnits, costNok, productiveMinutes,
        deploymentCount, recentDeploymentCount, runningDeployments, healthcheckedDeployments,
        deploymentsWithSyncEvents, deploymentsWithStack, deploymentsWithAccessPolicy,
        releaseCount, recentReleaseCount, rollbackReadyReleases, currentReleases,
        supersededReleases, failedReleases, designCompleted, designFailed, designTotal,
        designAvgScore, latestVerificationByKind, lastVerificationAttempt,
        hasVerificationSamples, hasQueueTelemetry, hasMeasuredEconomics,
        hasDeploymentOwnership, hasTrustRecovery, hasDesignProof, designPassRate,
        timingSampleCount, hasPromptUxEvidence, hasDeployTimingEvidence,
    }
}
export type CommercialReadinessContext = ReturnType<typeof prepareCommercialReadiness>
