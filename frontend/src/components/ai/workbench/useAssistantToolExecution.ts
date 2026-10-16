import { useEffect } from 'react'
import { parseToolCalls } from './toolTags'
import type { WorkbenchState } from './useWorkbenchState'

export function useAssistantToolExecution(
    state: WorkbenchState,
    persistMessage: (conversationId: string, message: AIConversationMessage) => Promise<void>
) {
    const { executeAssistantToolsRef, runToolCallRef, conversationsRef, setConversations } = state
    useEffect(() => {
        executeAssistantToolsRef.current = async (conversation, message) => {
            const toolCalls = parseToolCalls(message.content)
            if (!toolCalls.length) return
            for (const toolCall of toolCalls) {
                const latestConversation = conversationsRef.current.find((entry) => entry.id === conversation.id) || conversation
                let result: Awaited<ReturnType<typeof runToolCallRef.current>>
                try {
                    result = await runToolCallRef.current(latestConversation, toolCall)
                } catch (error) {
                    result = {
                        ok: false,
                        message: error instanceof Error ? `Tool ${toolCall.action} failed: ${error.message}` : `Tool ${toolCall.action} failed.`,
                    }
                }
                const toolMessage: AIConversationMessage = {
                    id: crypto.randomUUID(),
                    role: 'tool',
                    content: result.message,
                    error: !result.ok,
                    createdAt: new Date().toISOString(),
                    metadata: {
                        tool: toolCall.action,
                        toolState: result.ok ? 'completed' : 'error',
                        ...(result.artifacts ? { artifacts: result.artifacts } : {}),
                    },
                }
                setConversations((prev) => {
                    const next = prev.map((entry) => entry.id === conversation.id
                        ? { ...entry, updatedAt: new Date().toISOString(), messages: [...entry.messages, toolMessage] }
                        : entry)
                    conversationsRef.current = next
                    return next
                })
                void persistMessage(conversation.id, toolMessage)
            }
        }
    }, [conversationsRef, executeAssistantToolsRef, persistMessage, runToolCallRef, setConversations])
}
