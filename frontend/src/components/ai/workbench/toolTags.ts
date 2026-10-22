'use client'

import randomId from '@/utils/random/randomId'
import type { AiToolCall } from './aiToolTypes'
export type { AiToolCall } from './aiToolTypes'

export function parseToolCalls(content: string): AiToolCall[] {
    const matches = [...content.matchAll(/<hanasand-tool>([\s\S]*?)<\/hanasand-tool>/g)]
    const results: AiToolCall[] = []
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]) as AiToolCall
            if (parsed?.action) {
                results.push(parsed)
            }
        } catch (error) {
            console.error('Invalid Hanasand tool payload', error)
        }
    }
    return results
}

export function inferExplicitNextjsProjectRequest(messages: AIConversationMessage[]): AiToolCall | null {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || ''
    const request = latestUserMessage.trim()
    if (!request || /\b(how to|how do i|what is|what's|explain|describe|tell me about)\b/i.test(request)) return null
    if (!/\b(build|create|make|generate|scaffold|start)\b/i.test(request)) return null
    if (!/\b(next\.?js|nextjs)\b/i.test(request) || !/\b(app|application|website|site)\b/i.test(request)) return null
    return { action: 'create_project' }
}

export function resolveAssistantToolCalls(content: string, conversation: Pick<AIConversation, 'messages' | 'workspaceId' | 'shareIds'>): AiToolCall[] {
    const toolCalls = parseToolCalls(content)
    if (toolCalls.length || conversation.workspaceId || conversation.shareIds.length) return toolCalls
    const inferredProjectCall = inferExplicitNextjsProjectRequest(conversation.messages)
    return inferredProjectCall ? [inferredProjectCall] : []
}

export function stripToolTags(content: string) {
    return content.replace(/<hanasand-tool>[\s\S]*?<\/hanasand-tool>/g, '').replace(/\n{3,}/g, '\n\n')
}

export function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || `vm-${randomId(6).toLowerCase()}`
}
