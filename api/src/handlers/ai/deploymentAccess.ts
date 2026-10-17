import { hasVmAccess } from '#utils/vms/access.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import { agentTargetSelect } from '#utils/vms/agentTargetQuery.ts'
import type { getConversationForUser } from './shared.ts'

export type VMRow = {
    name: string
    owner: string
    created_by: string
    access_users: string[] | null
    device_eth0_ipv4_address: string
}

export type RepositoryRow = {
    id: string
    owner_id: string
    name: string
    full_name: string
    branch: string
    source_path: string
    stack_type: AIStackType
    stack_reason: string | null
    files: AIImportedRepoFile[]
}

export type StartDeploymentBody = {
    conversationId?: string
    vmName?: string
    port?: number | string
    healthPath?: string
    accessPolicy?: AIDeploymentAccessPolicy
    environment?: 'staging' | 'production'
}

export async function getAccessibleVm(req: FastifyRequest, res: FastifyReply, vmName: string, userId: string) {
    const { valid: isAdmin } = await hasHanasandInternalRouteAccess(req)
    const result = await run(`
        ${agentTargetSelect}
        WHERE v.name = $1
        LIMIT 1
    `, [vmName])

    if (!result.rows.length) {
        res.status(404).send({ error: 'VM not found.' })
        return null
    }

    const vm = result.rows[0] as VMRow
    const canAccess = isAdmin || await hasVmAccess(vm.name, userId)
    if (!canAccess) {
        res.status(403).send({ error: 'Forbidden.' })
        return null
    }

    return vm
}

export async function getConversationRepository(conversation: Awaited<ReturnType<typeof getConversationForUser>>, ownerId: string) {
    const repositoryId = typeof conversation?.workspace_meta?.repositoryId === 'string'
        ? conversation.workspace_meta.repositoryId
        : conversation?.workspace_kind === 'repo'
            ? conversation.workspace_id
            : null

    if (!repositoryId) {
        return null
    }

    const result = await run(`
        SELECT repositories.id, repositories.owner_id, repositories.name, repositories.full_name, repositories.branch,
               repositories.source_path, repositories.stack_type, repositories.stack_reason,
               COALESCE(
                   JSON_AGG(JSON_BUILD_OBJECT('path', files.path, 'name', files.name, 'content', files.content))
                   FILTER (WHERE files.path IS NOT NULL),
                   '[]'::json
               ) AS files
        FROM ai_imported_repositories AS repositories
        LEFT JOIN ai_imported_repository_files AS files
          ON files.repository_id = repositories.id
        WHERE repositories.id = $1
          AND repositories.owner_id = $2
        GROUP BY repositories.id
        LIMIT 1
    `, [repositoryId, ownerId])

    return (result.rows[0] as RepositoryRow | undefined) || null
}

export function normalizeAccessPolicy(value: StartDeploymentBody['accessPolicy']): AIDeploymentAccessPolicy {
    return value === 'collaborators' || value === 'public_preview' ? value : 'owner_only'
}

export function normalizeEnvironment(value: StartDeploymentBody['environment']) {
    return value === 'production' ? 'production' : 'staging'
}
