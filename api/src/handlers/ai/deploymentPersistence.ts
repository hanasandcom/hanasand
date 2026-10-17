import run from '#db'
import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import type { DeploymentRow } from './deploymentShared.ts'
import type { RepositoryRow, VMRow } from './deploymentAccess.ts'
import { getConversationForUser } from './shared.ts'
import type { executeDeployment } from './deploymentExecution.ts'

export async function persistDeployment({ userId, conversation, repository, vm, execution }: {
    userId: string
    conversation: NonNullable<Awaited<ReturnType<typeof getConversationForUser>>>
    repository: RepositoryRow
    vm: VMRow
    execution: Awaited<ReturnType<typeof executeDeployment>>
}) {
    const { id, detectedStack, status, failureReason, completedAt, events, serviceName, previewUrl, healthcheckUrl, accessPolicy, environment, ownedProfile, envPlaceholders } = execution
    const result = await run(`
    INSERT INTO ai_deployments (
        id, owner_id, conversation_id, repository_id, workspace_kind, workspace_id, vm_name, service_name,
        stack_type, access_policy, started_by, status, preview_url, healthcheck_url, events, failure_reason, completed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
    RETURNING *
`, [
        id,
        userId,
        conversation.id,
        repository.id,
        conversation.workspace_kind,
        conversation.workspace_id,
        vm.name,
        serviceName,
        detectedStack.stackType,
        accessPolicy,
        userId,
        status,
        previewUrl,
        healthcheckUrl,
        JSON.stringify(events),
        failureReason,
        completedAt ?? null,
    ])

    const deployment = (result.rows as DeploymentRow[])[0]
    await recordAiUsageEvent({
        ownerId: conversation.owner_id,
        actorId: userId,
        conversationId: conversation.id,
        repositoryId: repository.id,
        deploymentId: deployment.id,
        workspaceKind: conversation.workspace_kind,
        workspaceId: conversation.workspace_id,
        kind: 'deployment_started',
        metadata: {
            vmName: vm.name,
            status,
            accessPolicy,
            stackType: detectedStack.stackType,
            environment,
            domain: ownedProfile.domain,
            envPlaceholders,
            collaborative: conversation.owner_id !== userId,
        },
    })
    await recordRelease({
        deployment,
        ownerId: conversation.owner_id,
        status: status === 'running' ? 'current' : 'failed',
        previewUrl,
        createdBy: userId,
        notes: failureReason,
    })

    return deployment
}

async function recordRelease({
    deployment,
    ownerId,
    status,
    previewUrl,
    createdBy,
    notes,
}: {
    deployment: DeploymentRow
    ownerId: string
    status: 'current' | 'failed'
    previewUrl: string | null
    createdBy: string
    notes: string | null
}) {
    if (status === 'current') {
        await run(`
            UPDATE ai_releases
            SET status = 'superseded', updated_at = NOW()
            WHERE conversation_id = $1
              AND status = 'current'
        `, [deployment.conversation_id])
    }

    const releaseId = `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    await run(`
        INSERT INTO ai_releases (
            id, owner_id, conversation_id, deployment_id, vm_name,
            stack_type, access_policy, status, preview_url, created_by, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
        releaseId,
        ownerId,
        deployment.conversation_id,
        deployment.id,
        deployment.vm_name,
        deployment.stack_type || 'unknown',
        deployment.access_policy || 'owner_only',
        status,
        previewUrl,
        createdBy,
        notes,
    ])

    await recordAiUsageEvent({
        ownerId,
        actorId: createdBy,
        conversationId: deployment.conversation_id,
        repositoryId: deployment.repository_id,
        deploymentId: deployment.id,
        releaseId,
        workspaceKind: deployment.workspace_kind,
        workspaceId: deployment.workspace_id,
        kind: 'release_recorded',
        metadata: {
            status,
            vmName: deployment.vm_name,
            stackType: deployment.stack_type || 'unknown',
            accessPolicy: deployment.access_policy || 'owner_only',
        },
    })
}
