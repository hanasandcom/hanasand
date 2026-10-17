import type { VerificationJobRow } from './model.ts'
import { completeJobWithArtifact, recordVerificationUsage, createArtifact } from './artifacts.ts'

export async function completeNonBrowserJob(job: VerificationJobRow) {
    const artifact = createArtifact(`${job.kind}_receipt`, `${job.kind} verification receipt`, {
        message: `${job.kind} verification job recorded. Attach a runner to stream build logs, Docker output, deploy URLs, and health checks.`,
        deployUrl: job.deploy_url,
        requestId: job.request_id,
    })
    const saved = await completeJobWithArtifact(job, {
        status: 'completed',
        currentStep: 'Receipt stored',
        artifact,
        error: job.error,
    })
    if (!saved) return
    const durationMinutes = Math.max(1, Math.ceil(((job.started_at ? Date.now() - Date.parse(job.started_at) : 0) || 60000) / 60000))
    const kind = job.kind === 'deploy' ? 'deploy_minutes_recorded' : 'build_minutes_recorded'
    await recordVerificationUsage(job, {
        kind,
        units: durationMinutes,
        billableUnits: durationMinutes,
        estimatedCostNok: durationMinutes * (job.kind === 'deploy' ? 0.24 : 0.16),
        outcome: job.kind === 'deploy' ? 'deployed' : 'verified',
        metadata: {
            jobId: job.id,
            requestId: job.request_id,
            deployUrl: job.deploy_url,
            currentStep: 'Receipt stored',
        },
    })
}

