import { aiClientRequest } from '@/utils/ai/client'
import type { PendingEdit, PendingShareChange } from './shareChatTypes'
import { beginnerActionFailure, plainPathLabel } from './shareChatPresentation'

export async function approvePendingShareChange(pendingEdit: PendingEdit, change: PendingShareChange, share: Share) {
    const response = await aiClientRequest('/tools/ai', {
        method: 'POST',
        body: JSON.stringify({
            action: 'audit_agent_action',
            toolAction: 'share_file_write',
            approved: true,
            approvalId: pendingEdit.id,
            target: change.path,
            path: change.path,
            content: change.content,
            metadata: {
                shareId: change.shareId || null,
                rootShareId: share.id,
                created: Boolean(change.created),
                checkpoint: 'share_pending_edit_apply',
                changeCount: pendingEdit.changes.length,
            },
        }),
    })
    if (response.ok) {
        return { ok: true as const }
    }

    const payload = await response.json().catch(() => null) as {
        error?: string
        decision?: { safeAlternative?: string }
    } | null
    return {
        ok: false as const,
        error: [
            `Hanasand could not safely apply ${plainPathLabel(change.path)}.`,
            beginnerActionFailure(payload?.error),
            payload?.decision?.safeAlternative ? `Try this instead: ${payload.decision.safeAlternative}` : '',
        ].filter(Boolean).join(' '),
    }
}

export async function requestShareChat(init: RequestInit & { body?: BodyInit | null }) {
    let lastResponse: Response | null = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const response = await aiClientRequest('/tools/ai', init)
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                return response
            }
            lastResponse = response
        } catch {
            // Retry transient browser/network failures before surfacing a calm fallback.
        }
        await wait(Math.min(350 * 2 ** attempt, 3000))
    }
    if (lastResponse) {
        return lastResponse
    }
    throw new Error('Chat connection failed.')
}

export function friendlyChatError(status: number) {
    if (status === 429) {
        return 'The AI limit is cooling down. Try again in a moment.'
    }
    if (status === 401 || status === 403) {
        return 'The chat session is reconnecting. Try again in a moment.'
    }
    return 'The workspace assistant is reconnecting. Try again in a moment.'
}

export function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}
