// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { buildRecoveryNotice } from '../src/components/ai/workbench/recoveryNotice'

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
    expect(buildRecoveryNotice('conversation-1', 'conversation-1', { workspaceId: 'repo-1' } as AIConversation, runtimeState,
        'conversation-1:2026-10-22T10:00:00.000Z:Build failed')).toBeNull()
})
