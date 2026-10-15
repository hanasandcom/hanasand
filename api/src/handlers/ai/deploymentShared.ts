import run from '#db'
import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

export type DeploymentRow = {
    id: string
    owner_id: string
    conversation_id: string
    repository_id: string | null
    workspace_kind: 'share' | 'repo' | null
    workspace_id: string | null
    vm_name: string
    service_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    started_by: string | null
    status: AIDeploymentStatus
    preview_url: string | null
    healthcheck_url: string | null
    events: AIDeploymentEvent[] | null
    failure_reason: string | null
    created_at: string
    updated_at: string
    completed_at: string | null
}

const DEPLOY_WINDOW_MINUTES = 15
const DEPLOY_WINDOW_LIMIT = 5
const DEPLOY_RUNNING_LIMIT = 2

export function toDeployment(row: DeploymentRow): AIDeployment {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        repositoryId: row.repository_id,
        workspaceKind: row.workspace_kind,
        workspaceId: row.workspace_id,
        vmName: row.vm_name,
        serviceName: row.service_name,
        stackType: row.stack_type || 'unknown',
        accessPolicy: row.access_policy || 'owner_only',
        startedBy: row.started_by,
        status: row.status,
        previewUrl: buildAiPreviewUrl(row.id),
        healthcheckUrl: row.healthcheck_url,
        events: Array.isArray(row.events) ? row.events : [],
        failureReason: row.failure_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
    }
}

export async function getDeployQuota(ownerId: string): Promise<AIDeployQuota> {
    const result = await run(`
        SELECT COUNT(*)::int AS count
        FROM ai_deployments
        WHERE owner_id = $1
          AND created_at > NOW() - ($2::text)::interval
    `, [ownerId, `${DEPLOY_WINDOW_MINUTES} minutes`])
    const activeResult = await run(`
        SELECT COUNT(*)::int AS count
        FROM (
            SELECT DISTINCT ON (conversation_id) conversation_id, status
            FROM ai_deployments
            WHERE owner_id = $1
            ORDER BY conversation_id, updated_at DESC, created_at DESC
        ) AS latest
        WHERE status IN ('planned', 'syncing', 'building', 'healthchecking', 'running')
    `, [ownerId])
    const used = Number(result.rows[0]?.count || 0)
    const activeRunning = Number(activeResult.rows[0]?.count || 0)
    return {
        used,
        limit: DEPLOY_WINDOW_LIMIT,
        remaining: Math.max(DEPLOY_WINDOW_LIMIT - used, 0),
        windowMinutes: DEPLOY_WINDOW_MINUTES,
        resetsAt: new Date(Date.now() + DEPLOY_WINDOW_MINUTES * 60 * 1000).toISOString(),
        activeRunning,
        maxRunning: DEPLOY_RUNNING_LIMIT,
        runningRemaining: Math.max(DEPLOY_RUNNING_LIMIT - activeRunning, 0),
        sharedAcrossCollaborators: true,
    }
}
