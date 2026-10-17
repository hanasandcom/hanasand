import { countPhrase, formatCountLabel, formatDeploymentAttempt, formatDeploymentWindow, formatEvidenceParts, formatVerificationAttempt, readinessItem, readinessStatus } from './formatting.ts'
import type { CommercialReadinessContext } from './readinessContext.ts'

export function buildPlatformReadinessItems(context: CommercialReadinessContext) {
    const { reliability, deploymentCount, recentDeploymentCount, runningDeployments, healthcheckedDeployments, deploymentsWithSyncEvents, deploymentsWithStack, deploymentsWithAccessPolicy, releaseCount, recentReleaseCount, rollbackReadyReleases, currentReleases, supersededReleases, failedReleases, hasDeploymentOwnership, hasTrustRecovery, hasVerificationSamples, hasQueueTelemetry, timingSampleCount, lastVerificationAttempt, latestDeployment, latestRelease } = context
    return [
        readinessItem({
            id: 'durable_async_verification',
            priority: 1,
            label: 'Durable async verification jobs',
            status: readinessStatus(hasVerificationSamples && hasQueueTelemetry, hasVerificationSamples || hasQueueTelemetry),
            evidence: [
                'Control is wired through ai_verification_jobs: queue position, running state, retry count, cancel time, artifacts, and latency timestamps are persisted.',
                timingSampleCount > 0
                    ? `${timingSampleCount} completed verification timing samples are inside the selected usage window.`
                    : 'No completed verification timing samples are recorded for this owner in the selected usage window.',
                hasQueueTelemetry
                    ? `${formatCountLabel(reliability.capacity.totalQueued, 'queued job')} and ${formatCountLabel(reliability.capacity.totalAvailableSessions, 'live lane slot')} are visible now.`
                    : 'No queued jobs or live lane capacity is reported for this owner.',
            ],
            action: hasVerificationSamples ? 'Keep build, browser, deploy, and design verification jobs flowing through the durable queue.' : 'Enqueue browser/build/deploy verification jobs through POST /api/tools/verification-jobs so p50/p95 latency has current samples.',
            owner: 'AI platform',
            control: '/api/tools/verification-jobs plus ai_verification_jobs',
            lastAttempt: formatVerificationAttempt(lastVerificationAttempt),
            measurable: hasVerificationSamples || hasQueueTelemetry,
        }),
        readinessItem({
            id: 'deployment_ownership',
            priority: 2,
            label: 'Deployment ownership: domain, env, build, logs, rollback',
            status: readinessStatus(hasDeploymentOwnership && hasTrustRecovery, deploymentCount > 0 || releaseCount > 0),
            evidence: [
                deploymentCount > 0
                    ? `${formatDeploymentWindow(deploymentCount, recentDeploymentCount)}; ${formatEvidenceParts([
                        countPhrase(runningDeployments, 'running'),
                        countPhrase(healthcheckedDeployments, 'with health-check URLs'),
                    ], 'ownership details are still being captured')}.`
                    : 'No deployment records are linked for this owner.',
                deploymentCount > 0
                    ? formatEvidenceParts([
                        countPhrase(deploymentsWithSyncEvents, 'with sync/build/run/health event logs'),
                        countPhrase(deploymentsWithStack, 'with detected stack type'),
                        countPhrase(deploymentsWithAccessPolicy, 'with access policy'),
                    ], 'Deployment records exist, but event logs, stack type, and access policy are still being captured.')
                    : 'No deploy sync/build/health event log has been captured for this owner.',
                releaseCount > 0
                    ? `${formatDeploymentWindow(releaseCount, recentReleaseCount, 'release')}; ${formatEvidenceParts([
                        countPhrase(currentReleases, 'current'),
                        countPhrase(supersededReleases, 'superseded'),
                        countPhrase(failedReleases, 'failed'),
                        countPhrase(rollbackReadyReleases, 'linked to deploy preview records'),
                    ], 'rollback state is still being captured')}.`
                    : 'No release record is linked to a deploy preview for this owner.',
            ],
            action: hasDeploymentOwnership && hasTrustRecovery ? 'Keep release records linked to deployment ids so rollback state remains auditable.' : 'Run POST /api/ai/deployments for an owned repo and confirm ai_deployments.events contains sync/build/health entries plus an ai_releases current record.',
            owner: 'Deploy ops',
            control: '/api/ai/deployments, ai_deployments, ai_releases',
            lastAttempt: formatDeploymentAttempt(latestDeployment, latestRelease),
            measurable: deploymentCount > 0 || releaseCount > 0,
        }),
        readinessItem({
            id: 'safety_enforcement',
            priority: 3,
            label: 'Real safety enforcement',
            status: 'operational',
            evidence: [
                'Backend action policy blocks secrets, broad deletes, production DB writes, SSH keys, and destructive actions.',
                'Risky tool calls require checkpoints or safe alternatives before execution.',
                'Tool metadata can be audited against policy outcome and approval state.',
            ],
            action: 'Add every new tool or deploy target to the action-policy smoke contract before exposing it.',
            owner: 'Security',
            control: 'AI action policy and smoke-ai-action-policy.ts',
            lastAttempt: 'Policy contract is part of the API smoke suite.',
            measurable: true,
        }),
    ]
}
