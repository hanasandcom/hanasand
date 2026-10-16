import randomId from '@/utils/random/randomId'
import { updateShare } from '@/utils/share/put'
import postShare from '@/utils/share/post'
import { approvePendingShareChange } from './shareChatApi'
import { fileNameFromPath, parentIdForPath } from './shareChatChanges'
import type { PendingEdit, Message, ShareChatProps } from './shareChatTypes'
import type { Dispatch, SetStateAction } from 'react'

type Options = Pick<ShareChatProps, 'share' | 'tree' | 'setShare' | 'setEditorPatch'> & {
    pendingEdit: PendingEdit | null
    setPendingEdit: Dispatch<SetStateAction<PendingEdit | null>>
    setMessages: Dispatch<SetStateAction<Message[]>>
}

export function useShareChatPendingEdit({ share, tree, setShare, setEditorPatch, pendingEdit, setPendingEdit, setMessages }: Options) {
    async function applyPendingEdit() {
        if (!share || !pendingEdit || pendingEdit.status === 'applying') return
        setPendingEdit(current => current ? { ...current, status: 'applying', error: undefined } : current)
        const applied: Share[] = []
        for (const change of pendingEdit.changes) {
            const policyCheck = await approvePendingShareChange(pendingEdit, change, share)
            if (!policyCheck.ok) {
                setPendingEdit(current => current ? { ...current, status: 'error', error: policyCheck.error } : current)
                return
            }
            const updated = change.shareId
                ? await updateShare(change.shareId, { content: change.content, path: change.path })
                : await postShare({
                    includeTree: true,
                    id: randomId(),
                    content: change.content,
                    name: fileNameFromPath(change.path),
                    path: change.path,
                    parent: parentIdForPath(tree || null, change.path) || share.parent || undefined,
                    type: 'file',
                })
            if (!updated) {
                setPendingEdit(current => current ? { ...current, status: 'error', error: `Unable to apply ${change.path}.` } : current)
                return
            }
            applied.push(updated)
        }
        const activeUpdate = applied.find(updated => updated.id === share.id)
        if (activeUpdate) {
            setShare(activeUpdate)
            setEditorPatch({ value: activeUpdate.content, nonce: Date.now() })
        }
        setPendingEdit(current => current ? { ...current, status: 'applied' } : current)
        setMessages(current => [...current, {
            id: randomId(), role: 'tool',
            content: `Applied ${pendingEdit.changes.length} file change${pendingEdit.changes.length === 1 ? '' : 's'}.`,
            createdAt: new Date().toISOString(),
        }])
        if (pendingEdit.changes.some(change => !change.shareId)) window.setTimeout(() => window.location.reload(), 500)
    }

    function discardPendingEdit() {
        if (pendingEdit?.status === 'applying') return
        setPendingEdit(null)
    }

    return { applyPendingEdit, discardPendingEdit }
}
