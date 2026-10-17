import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import { cleanWorkspaceKind } from './model.ts'
import type { VerificationJobRow, VerificationUsageDetails } from './model.ts'
import run from '#db'

export async function completeJobWithArtifact(job: VerificationJobRow, {
    status,
    currentStep,
    artifact,
    error,
}: {
    status: 'completed' | 'failed'
    currentStep: string
    artifact: Record<string, unknown>
    error: string | null
}) {
    const completed = await run(`
        UPDATE ai_verification_jobs
        SET status = $2,
            current_step = $3,
            artifacts = artifacts || $4::jsonb,
            error = $5,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND status = 'running'
        RETURNING id
    `, [job.id, status, currentStep, JSON.stringify([artifact]), error])
    return completed.rows.length > 0
}

export async function recordVerificationUsage(job: VerificationJobRow, details: VerificationUsageDetails) {
    await recordAiUsageEvent({
        ownerId: job.owner_id,
        actorId: job.owner_id,
        workspaceKind: cleanWorkspaceKind(job.workspace_kind),
        workspaceId: job.workspace_id,
        billingMode: job.lane,
        ...details,
    })
}

export function createArtifact<T extends Record<string, unknown>>(type: string, name: string, data: T) {
    return { id: crypto.randomUUID(), type, name, createdAt: new Date().toISOString(), data }
}
