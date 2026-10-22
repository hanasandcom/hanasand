const pendingDraftKey = 'hanasand.ai.pendingConversationDraft'
const composerDraftPrefix = 'hanasand.ai.composerDraft:'

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type StoredConversationDraft = {
    conversation: AIConversation
    composer: string
}

export function reusePendingConversationDraft(
    current: AIConversation | null,
    stored: StoredConversationDraft | null,
    create: () => AIConversation
) {
    return current || stored?.conversation || create()
}

export function promoteDraftOnce<T>(draftId: string, runningPromotions: Map<string, Promise<T>>, promote: () => Promise<T>) {
    const current = runningPromotions.get(draftId)
    if (current) return current
    const promotion = promote()
    runningPromotions.set(draftId, promotion)
    void promotion.finally(() => {
        if (runningPromotions.get(draftId) === promotion) runningPromotions.delete(draftId)
    }).catch(() => {})
    return promotion
}

export function readPendingConversationDraft(storage: DraftStorage | null = browserStorage()): StoredConversationDraft | null {
    if (!storage) return null
    try {
        const stored = storage.getItem(pendingDraftKey)
        if (!stored) return null
        const parsed = JSON.parse(stored) as Partial<StoredConversationDraft>
        if (!isConversationDraft(parsed.conversation)) return null
        return { conversation: parsed.conversation, composer: typeof parsed.composer === 'string' ? parsed.composer : '' }
    } catch {
        return null
    }
}

export function writePendingConversationDraft(draft: StoredConversationDraft, storage: DraftStorage | null = browserStorage()) {
    if (!storage) return
    try { storage.setItem(pendingDraftKey, JSON.stringify(draft)) } catch { /* Keep the in-memory draft if browser storage is unavailable. */ }
}

export function clearPendingConversationDraft(storage: DraftStorage | null = browserStorage()) {
    if (!storage) return
    try { storage.removeItem(pendingDraftKey) } catch { /* A persisted draft is safer than losing the current one. */ }
}

export function readComposerDraft(conversationId: string | null, storage: DraftStorage | null = browserStorage()) {
    if (!conversationId || !storage) return ''
    try { return storage.getItem(`${composerDraftPrefix}${conversationId}`) || '' } catch { return '' }
}

export function writeComposerDraft(conversationId: string | null, composer: string, storage: DraftStorage | null = browserStorage()) {
    if (!conversationId || !storage) return
    try { storage.setItem(`${composerDraftPrefix}${conversationId}`, composer) } catch { /* Keep the in-memory composer if browser storage is unavailable. */ }
}

function isConversationDraft(value: unknown): value is AIConversation {
    if (!value || typeof value !== 'object') return false
    const conversation = value as Partial<AIConversation>
    return typeof conversation.id === 'string'
        && typeof conversation.title === 'string'
        && Array.isArray(conversation.messages)
        && Array.isArray(conversation.shareIds)
        && typeof conversation.workspaceMeta === 'object'
        && conversation.workspaceMeta !== null
}

function browserStorage(): DraftStorage | null {
    if (typeof window === 'undefined') return null
    try { return window.localStorage } catch { return null }
}
