// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import {
    buildRecoveryNotice,
    MAX_RECOVERY_NOTICE_HISTORY,
    readRecoveryNoticeHistory,
    rememberRecoveryNotice,
    serializeRecoveryNoticeHistory,
} from '../src/components/ai/workbench/recoveryNotice'

test('routine repository selection does not produce a recovery notice', () => {
    expect(buildRecoveryNotice('conversation-1', 'conversation-1', { workspaceId: 'repo-1' } as AIConversation, null)).toBeNull()
    expect(buildRecoveryNotice(null, 'conversation-1', { workspaceId: 'repo-1' } as AIConversation, {
        state: 'ready', lastToolRun: { detail: 'Repository checked', updatedAt: '2026-10-22T10:00:00.000Z' },
    } as AIRuntimeState)).toBeNull()
})

test('a recorded runtime failure remains visible as a recovery notice', () => {
    const runtimeState = {
        lastFailure: { message: 'Build failed', updatedAt: '2026-10-22T10:00:00.000Z' },
    } as AIRuntimeState
    expect(buildRecoveryNotice('conversation-1', 'conversation-1', { workspaceId: 'repo-1' } as AIConversation, runtimeState)).toEqual({
        message: 'Previous run failed: Build failed',
        conversationId: 'conversation-1',
        workspaceId: 'repo-1',
        recoveryKey: 'conversation-1:2026-10-22T10:00:00.000Z:Build failed',
    })
    const shownKeys = rememberRecoveryNotice([], 'conversation-1:2026-10-22T10:00:00.000Z:Build failed')
    expect(buildRecoveryNotice('conversation-1', 'conversation-1', { workspaceId: 'repo-1' } as AIConversation, runtimeState, shownKeys)).toBeNull()
})

test('recovery notices remain suppressed when switching between failed conversations and reloading', () => {
    const conversationA = {
        lastFailure: { message: 'A failed', updatedAt: '2026-10-22T10:00:00.000Z' },
    } as AIRuntimeState
    const conversationB = {
        lastFailure: { message: 'B failed', updatedAt: '2026-10-22T10:05:00.000Z' },
    } as AIRuntimeState
    let history: string[] = []

    const noticeA = buildRecoveryNotice(null, 'conversation-A', null, conversationA, history)
    expect(noticeA?.message).toBe('Previous run failed: A failed')
    history = rememberRecoveryNotice(history, noticeA!.recoveryKey)

    const noticeB = buildRecoveryNotice(null, 'conversation-B', null, conversationB, history)
    expect(noticeB?.message).toBe('Previous run failed: B failed')
    history = rememberRecoveryNotice(history, noticeB!.recoveryKey)

    const restoredHistory = readRecoveryNoticeHistory(serializeRecoveryNoticeHistory(history))
    expect(buildRecoveryNotice(null, 'conversation-A', null, conversationA, restoredHistory)).toBeNull()
    expect(buildRecoveryNotice(null, 'conversation-B', null, conversationB, restoredHistory)).toBeNull()
})

test('malformed recovery history is ignored and the serialized history remains bounded', () => {
    expect(readRecoveryNoticeHistory('{not json')).toEqual([])
    expect(readRecoveryNoticeHistory(JSON.stringify({ version: 2, keys: ['valid-1-2'] }))).toEqual([])
    expect(readRecoveryNoticeHistory(JSON.stringify({ version: 1, keys: ['x'.repeat(5000)] }))).toEqual([])

    let history: string[] = []
    for (let index = 0; index < MAX_RECOVERY_NOTICE_HISTORY + 10; index += 1) {
        history = rememberRecoveryNotice(history, `conversation-${index}:time:failure`)
    }

    const serialized = serializeRecoveryNoticeHistory(history)
    expect(serialized.length).toBeLessThan(4096)
    expect(readRecoveryNoticeHistory(serialized)).toHaveLength(MAX_RECOVERY_NOTICE_HISTORY)
})
