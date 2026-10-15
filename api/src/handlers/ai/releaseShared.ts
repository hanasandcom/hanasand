import { buildAiPreviewUrl } from '#utils/ai/preview.ts'

export type ReleaseRow = {
    id: string
    owner_id: string
    conversation_id: string
    deployment_id: string | null
    vm_name: string
    stack_type: AIStackType
    access_policy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    preview_url: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    notes: string | null
}

export function toReleaseBase(row: ReleaseRow): Omit<AIRelease, 'trust'> {
    return {
        id: row.id,
        ownerId: row.owner_id,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        vmName: row.vm_name,
        stackType: row.stack_type,
        accessPolicy: row.access_policy,
        status: row.status,
        previewUrl: row.deployment_id ? buildAiPreviewUrl(row.deployment_id) : row.preview_url,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        notes: row.notes,
    }
}
