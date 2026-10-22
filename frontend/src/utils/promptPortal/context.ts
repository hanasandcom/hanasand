import type { PromptPortalContextMessage } from './store'

export function serializePromptContext(hanasandMessages: AIConversationMessage[], chatGPTMessages: AIConversationMessage[]): PromptPortalContextMessage[] {
    return [...hanasandMessages, ...chatGPTMessages]
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .filter(message => !(message.role === 'assistant' && ['queued', 'running'].includes(String(message.metadata?.promptPortalStatus))))
        .filter(message => message.content.trim().length > 0)
        .map(message => {
            const itemId = typeof message.metadata?.promptPortalId === 'string' ? message.metadata.promptPortalId : ''
            const files = itemId && Array.isArray(message.metadata?.files)
                ? (message.metadata.files as Array<{ id?: unknown }>).flatMap(file => typeof file.id === 'string' ? [{ itemId, fileId: file.id }] : [])
                : []
            return {
                role: message.role as 'user' | 'assistant',
                content: message.content,
                ...(message.modelName ? { modelName: message.modelName } : {}),
                ...(files.length ? { files } : {}),
            }
        })
}
