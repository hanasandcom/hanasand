import { listGptClients, gpt } from '#utils/ws/handleGptMessage.ts'
import type { AiConversationRow, AiMessageRow } from './shared.ts'
import { buildAiRuntimeState } from './runtime.ts'
import { queryAccessibleConversations, queryAccessibleMessages } from './workspaceQueries.ts'

export async function getAiRuntimeSnapshot(ownerId: string): Promise<AIRuntimeState> {
    const [conversationResult, messageResult] = await Promise.all([
        queryAccessibleConversations(ownerId),
        queryAccessibleMessages(ownerId),
    ])
    const messagesByConversation = new Map<string, AiMessageRow[]>()

    for (const message of messageResult.rows as AiMessageRow[]) {
        const messages = messagesByConversation.get(message.conversation_id) || []
        messages.push(message)
        messagesByConversation.set(message.conversation_id, messages)
    }

    return buildAiRuntimeState({
        conversations: (conversationResult.rows as AiConversationRow[]).map((conversation) => ({
            id: conversation.id,
            workspaceId: conversation.workspace_id,
            workspaceKind: conversation.workspace_kind,
            shareIds: conversation.share_ids || [],
            workspaceMeta: conversation.workspace_meta || {},
            archivedAt: conversation.archived_at,
            updatedAt: conversation.updated_at,
            messages: (messagesByConversation.get(conversation.id) || []).map((message) => ({
                role: message.role,
                content: message.content,
                error: message.error,
                metadata: message.metadata || {},
                createdAt: message.created_at,
            })),
        })),
        clients: listGptClients('gpt'),
        participants: gpt.get('gpt')?.size || 0,
    })
}
