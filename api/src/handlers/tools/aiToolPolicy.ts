import type { FastifyRequest } from 'fastify'
import { auditAgentAction, evaluateAgentActionPolicy, redactAgentText } from '#utils/ai/actionPolicy.ts'

type ToolCall = {
    action?: string
    path?: string
    content?: string
    actions?: ToolCall[]
}

export async function enforceGeneratedToolPolicy(req: FastifyRequest, actorId: string | null, response: Record<string, unknown>) {
    const message = typeof response.message === 'string' ? response.message : ''
    const calls = parseGeneratedToolCalls(message)

    for (const call of calls) {
        if (!['update_share', 'upsert_share', 'create_share'].includes(call.action || '')) {
            continue
        }

        const decision = await evaluateAgentActionPolicy({
            action: 'generated_tool_call',
            actorId,
            path: call.path,
            content: call.content,
            metadata: { generatedAction: call.action, phase: 'staged_tool_tag' },
        })
        await auditAgentAction(req, {
            action: 'generated_tool_call',
            actorId,
            path: call.path,
            content: call.content,
            metadata: { generatedAction: call.action, phase: 'staged_tool_tag' },
        }, decision)

        if (decision.status !== 'allowed') {
            return {
                ...response,
                status: decision.status,
                model: 'policy',
                message: safetyMessage(decision),
                decision,
            }
        }
    }

    return {
        ...response,
        message: redactAgentText(message),
    }
}

export function parseGeneratedToolCalls(content: string): ToolCall[] {
    return [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)].flatMap((match) => {
        try {
            const parsed = JSON.parse(match[1]) as ToolCall
            return Array.isArray(parsed.actions) ? parsed.actions : [parsed]
        } catch {
            return []
        }
    })
}

export function safetyMessage(decision: Awaited<ReturnType<typeof evaluateAgentActionPolicy>>) {
    return [
        `Blocked by Hanasand safety policy: ${decision.reason}`,
        `Safer path: ${decision.safeAlternative}`,
    ].join('\n')
}
