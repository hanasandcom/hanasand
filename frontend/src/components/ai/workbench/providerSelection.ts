export type AssistantProvider = 'hanasand' | 'chatgpt'
export type ConversationProviderPreferences = Record<string, AssistantProvider>

export function parseConversationProviderPreferences(value: string | null): ConversationProviderPreferences {
    if (!value) return {}
    try {
        const parsed: unknown = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, AssistantProvider] =>
            typeof entry[0] === 'string' && (entry[1] === 'hanasand' || entry[1] === 'chatgpt')))
    } catch {
        return {}
    }
}

export function setConversationProvider(preferences: ConversationProviderPreferences, conversationId: string, provider: AssistantProvider) {
    return conversationId ? { ...preferences, [conversationId]: provider } : preferences
}

export function mergeConversationMessages(existing: AIConversationMessage[], providerMessages: AIConversationMessage[]) {
    return [...existing, ...providerMessages].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}
