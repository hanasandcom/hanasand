export const RECOVERY_NOTICE_STORAGE_KEY = 'hanasand.ai.recoveryNotices'
export const MAX_RECOVERY_NOTICE_HISTORY = 50
const MAX_RECOVERY_NOTICE_FINGERPRINT_LENGTH = 32

type RecoveryNoticeHistory = {
    version: 1
    keys: string[]
}

function fingerprintRecoveryKey(value: string) {
    let first = 0x811c9dc5
    let second = 0x9e3779b9

    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        first = Math.imul(first ^ code, 0x01000193)
        second = Math.imul(second ^ code, 0x85ebca6b)
    }

    return `${value.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`
}

export function readRecoveryNoticeHistory(serialized: string | null): string[] {
    if (!serialized || serialized.length > 4096) return []

    try {
        const parsed = JSON.parse(serialized) as Partial<RecoveryNoticeHistory> | null
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.keys)) return []
        return parsed.keys
            .filter((key): key is string => typeof key === 'string'
                && key.length <= MAX_RECOVERY_NOTICE_FINGERPRINT_LENGTH
                && /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/.test(key))
            .slice(0, MAX_RECOVERY_NOTICE_HISTORY)
    } catch {
        return []
    }
}

export function rememberRecoveryNotice(keys: readonly string[], recoveryKey: string): string[] {
    const fingerprint = fingerprintRecoveryKey(recoveryKey)
    return [fingerprint, ...keys.filter((key) => key !== fingerprint)].slice(0, MAX_RECOVERY_NOTICE_HISTORY)
}

export function serializeRecoveryNoticeHistory(keys: readonly string[]): string {
    const history: RecoveryNoticeHistory = {
        version: 1,
        keys: [...new Set(keys.filter((key) => key.length <= MAX_RECOVERY_NOTICE_FINGERPRINT_LENGTH
            && /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/.test(key)))].slice(0, MAX_RECOVERY_NOTICE_HISTORY),
    }
    return JSON.stringify(history)
}

export function buildRecoveryNotice(_savedConversationId: string | null, nextConversationId: string, conversation: AIConversation | null, runtimeState: AIRuntimeState | null | undefined, shownRecoveryKeys: readonly string[] = []) {
    const failure = runtimeState?.lastFailure
    const detail = failure?.message || null
    if (!detail) return null
    const recoveryKey = `${nextConversationId}:${failure?.updatedAt || ''}:${detail}`
    if (shownRecoveryKeys.includes(fingerprintRecoveryKey(recoveryKey))) return null
    return {
        message: `Previous run failed: ${detail}`,
        conversationId: nextConversationId,
        workspaceId: conversation?.workspaceId || null,
        recoveryKey,
    }
}
