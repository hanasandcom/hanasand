import { useCallback } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import { getTree } from '@/utils/share/getTree'
import { listTreePaths } from '@/components/share/workspaceTree'
import { withFocusedWorkspaceFile, withWorkspaceActivity } from './repositoryModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkspaceAttachmentActions(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    patchConversation: (id: string, patch: Partial<AIConversation>) => Promise<void>
) {
    const {
        importedRepos, shareTrees, setShareTrees, hydrateShareRef, hydrateShareFileRef,
        setShareContents,
    } = state

    const attachShare = useCallback(async (shareId: string) => {
        if (!activeConversation) return
        const nextShareIds = Array.from(new Set([shareId, ...(activeConversation.shareIds || [])]))
        const share = await hydrateShareRef.current(shareId)
        const token = getCookie('access_token') || undefined
        const userId = getCookie('id') || undefined
        const tree = shareTrees[shareId] || await getTree({ id: shareId, token, userId })
        if (tree) setShareTrees((prev) => ({ ...prev, [shareId]: tree }))
        const treePaths = listTreePaths(tree || null)
        const selectedFilePath = treePaths[0] || ''
        await patchConversation(activeConversation.id, {
            workspaceId: shareId,
            workspaceKind: 'share',
            shareIds: nextShareIds,
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                selectedFilePath,
            }, {
                action: 'Attached share workspace',
                path: selectedFilePath || undefined,
                source: 'share',
            }),
        })
        if (selectedFilePath) await hydrateShareFileRef.current(shareId, selectedFilePath)
        if (share) setShareContents((prev) => ({ ...prev, [shareId]: share.content }))
    }, [activeConversation, patchConversation, shareTrees, setShareTrees, hydrateShareRef, hydrateShareFileRef, setShareContents])

    const attachRepo = useCallback(async (repoId: string, importedRepo?: AIImportedRepo) => {
        const repo = importedRepo || importedRepos.find((item) => item.id === repoId)
        if (!repo || !activeConversation) return
        const shareId = repo.id
        const nextShareIds = Array.from(new Set([shareId, ...(activeConversation.shareIds || [])]))
        await patchConversation(activeConversation.id, {
            workspaceId: shareId,
            workspaceKind: 'repo',
            shareIds: nextShareIds,
            workspaceMeta: withWorkspaceActivity({
                ...activeConversation.workspaceMeta,
                repositoryId: repo.id,
                repositoryName: repo.fullName,
                repositoryBranch: repo.branch,
                repositorySourceUrl: repo.sourceUrl,
                selectedFilePath: repo.files[0]?.path || '',
            }, {
                action: 'Attached repository mirror',
                path: repo.files[0]?.path || undefined,
                source: 'repository-sync',
            }),
        })
        await hydrateShareRef.current(shareId)
        if (repo.files[0]?.path) await hydrateShareFileRef.current(shareId, repo.files[0].path)
    }, [activeConversation, importedRepos, patchConversation, hydrateShareRef, hydrateShareFileRef])

    const selectRepoFile = useCallback(async (path: string) => {
        if (!activeConversation || typeof activeConversation.workspaceMeta?.repositoryId !== 'string' || !activeConversation.workspaceId) return
        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: withFocusedWorkspaceFile(activeConversation.workspaceMeta, path, 'Focused repository file'),
        })
    }, [activeConversation, patchConversation, hydrateShareFileRef])

    const selectShareFile = useCallback(async (path: string) => {
        if (!activeConversation || !activeConversation.workspaceId) return
        await hydrateShareFileRef.current(activeConversation.workspaceId, path)
        await patchConversation(activeConversation.id, {
            workspaceMeta: withFocusedWorkspaceFile(activeConversation.workspaceMeta, path, 'Focused share file'),
        })
    }, [activeConversation, patchConversation, hydrateShareFileRef])

    return { attachShare, attachRepo, selectRepoFile, selectShareFile }
}
