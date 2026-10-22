export function buildRecoveryNotice(_savedConversationId: string | null, nextConversationId: string, conversation: AIConversation | null, runtimeState: AIRuntimeState | null | undefined, lastShownKey: string | null = null) {
    const failure = runtimeState?.lastFailure
    const detail = failure?.message || null
    if (!detail) return null
    const recoveryKey = `${nextConversationId}:${failure?.updatedAt || ''}:${detail}`
    if (lastShownKey === recoveryKey) return null
    return {
        message: `Previous run failed: ${detail}`,
        conversationId: nextConversationId,
        workspaceId: conversation?.workspaceId || null,
        recoveryKey,
    }
}
