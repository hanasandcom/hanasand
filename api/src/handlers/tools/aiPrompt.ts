import type { FastifyReply, FastifyRequest } from 'fastify'
import { listGptClients } from '#utils/ws/handleGptMessage.ts'
import { auditAgentAction, evaluateAgentActionPolicy, redactAgentText } from '#utils/ai/actionPolicy.ts'
import { buildShareProjectResponse } from './aiProjectBuilder.ts'
import { recordBuilderResponse, recordToolAiEconomics } from './aiToolAccounting.ts'
import { enforceGeneratedToolPolicy, parseGeneratedToolCalls, safetyMessage } from './aiToolPolicy.ts'
import { chatResponse, parseBrowserOpenTarget } from './aiToolIntents.ts'
import { chooseWorkMode, completeWithRetry, pickModelClient } from './aiToolModels.ts'
import type { AiToolRequest } from './aiToolContracts.ts'

export async function handleAiPrompt(req: FastifyRequest, res: FastifyReply, actorId: string | null, body: AiToolRequest & { prompt: string }) {
    const { prompt, context, maxTokens } = body
    const promptDecision = await evaluateAgentActionPolicy({
        action: 'ai_prompt',
        actorId,
        prompt,
        context,
        metadata: { source: 'tools_ai' },
    })
    await auditAgentAction(req, {
        action: 'ai_prompt',
        actorId,
        prompt,
        context,
        metadata: { source: 'tools_ai', promptLength: prompt.length, contextLength: context?.length || 0 },
    }, promptDecision)
    if (promptDecision.status !== 'allowed') {
        return res.status(promptDecision.status === 'blocked' ? 403 : 409).send({
            status: promptDecision.status,
            provider: 'hanasand-ai',
            model: 'policy',
            message: safetyMessage(promptDecision),
            decision: promptDecision,
        })
    }

    // Extraction callers require model output even when quoted source material
    // contains words that normally select a project generator or desktop tool.
    const completionOnly = body.action === 'complete'
    const scaffoldRequested = body.action === 'scaffold'
    const directResponse = completionOnly ? null : chatResponse(prompt)
    if (directResponse) {
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_completed',
            outcome: 'answered',
            prompt,
            context,
            responseText: directResponse,
            model: 'direct',
            startedAt: Date.now(),
        })
        return res.send({
            status: 'completed',
            provider: 'hanasand-ai',
            model: 'direct',
            message: directResponse,
        })
    }

    const browserTarget = completionOnly ? null : parseBrowserOpenTarget(prompt)
    if (browserTarget) {
        return res.send({
            status: 'handled',
            provider: 'hanasand-desktop',
            intent: 'open_browser',
            message: `Open ${browserTarget.title} in the Hanasand browser.`,
            target: browserTarget,
        })
    }

    const strategy = chooseWorkMode(prompt, context, body.billingMode, scaffoldRequested)
    const builderResponse = scaffoldRequested ? buildShareProjectResponse(prompt) : null
    if (builderResponse) {
        await recordBuilderResponse({
            actorId,
            prompt,
            context,
            response: builderResponse,
            billingMode: body.billingMode,
            strategy,
        })
        return res.send(await enforceGeneratedToolPolicy(req, actorId, {
            ...builderResponse,
            modelStrategy: strategy,
        }))
    }

    const clients = listGptClients('gpt')
    const preferredClient = pickModelClient(clients, strategy)

    if (!preferredClient) {
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_platform_error',
            outcome: 'platform_error',
            prompt,
            context,
            responseText: 'No connected model client.',
            model: 'none',
            startedAt: Date.now(),
            strategy,
        })
        return res.send({
            status: 'connecting',
            provider: 'hanasand-ai',
            model: null,
            message: 'Hanasand AI is connecting. Try again in a moment.',
        })
    }

    try {
        const conversationId = `tools-${crypto.randomUUID()}`
        const startedAt = Date.now()
        const completion = await completeWithRetry({
            conversationId,
            clientName: preferredClient.name,
            maxTokens: Math.min(Math.max(Number(maxTokens) || strategy.maxTokens, 300), strategy.route === 'strong_model' ? 6200 : 4200),
            prompt,
            context,
            strategy,
            completionOnly,
        })
        const responseId = `tools-response-${crypto.randomUUID()}`
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_completed',
            outcome: 'completed',
            prompt,
            context,
            responseText: completion.content || '',
            model: preferredClient.name,
            conversationId,
            metrics: completion.metrics,
            startedAt,
            toolCalls: parseGeneratedToolCalls(completion.content || '').length,
            strategy,
        })

        return res.send(await enforceGeneratedToolPolicy(req, actorId, {
            status: 'completed',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            modelVersion: preferredClient.modelId || null,
            modelStrategy: strategy,
            message: redactAgentText(completion.content || ''),
            artifacts: completion.artifacts || [],
            metrics: completion.metrics || null,
            conversationId,
            responseId,
        }))
    } catch (error) {
        req.log.error({ error, promptLength: prompt.length, clientName: preferredClient.name }, 'Hanasand AI tool request failed')
        await recordToolAiEconomics({
            actorId,
            billingMode: body.billingMode,
            kind: 'ai_run_platform_error',
            outcome: 'platform_error',
            prompt,
            context,
            responseText: error instanceof Error ? error.message : 'Model request failed.',
            model: preferredClient.name,
            startedAt: Date.now(),
        })
        return res.send({
            status: 'retryable',
            provider: 'hanasand-ai',
            model: preferredClient.name,
            message: 'Hanasand AI lost the connection while answering. Please try again.',
        })
    }
}
