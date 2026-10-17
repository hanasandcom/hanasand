import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { getConversationForUser, requireAiUser } from './shared.ts'
import { getDeployQuota, toDeployment, type DeploymentRow } from './deploymentShared.ts'
import { getAccessibleVm, getConversationRepository, normalizeAccessPolicy, normalizeEnvironment, type StartDeploymentBody } from './deploymentAccess.ts'
import { executeDeployment } from './deploymentExecution.ts'
import { persistDeployment } from './deploymentPersistence.ts'

export async function getAiDeployments(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return

    const { conversationId } = req.query as { conversationId?: string }
    const params = conversationId ? [userId, conversationId] : [userId]
    const result = await run(`
        SELECT ai_deployments.*
        FROM ai_deployments
        JOIN ai_conversations
          ON ai_conversations.id = ai_deployments.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_deployments.conversation_id
         AND collaborators.user_id = $1
        WHERE (
            ai_deployments.owner_id = $1
            OR collaborators.user_id = $1
        )
        ${conversationId ? 'AND ai_deployments.conversation_id = $2' : ''}
        ORDER BY ai_deployments.updated_at DESC, ai_deployments.created_at DESC
        LIMIT 25
    `, params)

    return res.send({
        deployments: (result.rows as DeploymentRow[]).map(toDeployment),
        quota: await getDeployQuota(userId),
    })
}

export async function postAiDeployment(req: FastifyRequest, res: FastifyReply) {
    const userId = await requireAiUser(req, res)
    if (!userId) return

    const body = (req.body as StartDeploymentBody | undefined) ?? {}
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
    const vmName = typeof body.vmName === 'string' ? body.vmName.trim() : ''
    const accessPolicy = normalizeAccessPolicy(body.accessPolicy)
    const environment = normalizeEnvironment(body.environment)

    if (!conversationId) {
        return res.status(400).send({ error: 'Missing conversationId.' })
    }

    if (!vmName) {
        return res.status(400).send({ error: 'Missing vmName.' })
    }

    const conversation = await getConversationForUser(conversationId, userId)
    if (!conversation) {
        return res.status(404).send({ error: 'Conversation not found.' })
    }

    const repository = await getConversationRepository(conversation, userId)
    if (!repository) {
        return res.status(400).send({ error: 'Attach an imported repository before deploying from AI.' })
    }

    const quota = await getDeployQuota(userId)
    if (quota.remaining <= 0) {
        return res.status(429).send({
            error: `Deploy limit reached. Try again after ${quota.resetsAt}.`,
            quota,
        })
    }
    if (quota.runningRemaining <= 0) {
        return res.status(429).send({
            error: `Live deploy limit reached. This owner already has ${quota.activeRunning}/${quota.maxRunning} active deployments. Wait for one to finish or roll back before starting another.`,
            quota,
        })
    }

    const vm = await getAccessibleVm(req, res, vmName, userId)
    if (!vm) {
        return
    }

    const execution = await executeDeployment({ repository, vm, body, userId, conversation, accessPolicy, environment })
    const deployment = await persistDeployment({ userId, conversation, repository, vm, execution })
    const { status } = execution

    return res.status(status === 'running' ? 201 : 202).send({ deployment: toDeployment(deployment), quota: await getDeployQuota(userId) })
}

export { toDeployment }
