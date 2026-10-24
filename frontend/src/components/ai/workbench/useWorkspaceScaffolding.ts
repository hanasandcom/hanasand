import { useCallback } from 'react'
import { getCookie } from 'hanasand/cookies'
import { scaffoldNextjsDockerWorkspace } from '@/utils/ai/scaffoldWorkspace'
import { withWorkspaceActivity } from './repositoryModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkspaceScaffolding(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    attachShare: (shareId: string) => Promise<void>,
    selectShareFile: (path: string) => Promise<void>,
    patchConversation: (id: string, patch: Partial<AIConversation>) => Promise<void>
) {
    const { setShares, resetShareWorkspaceCache, setStatusNotice } = state
    return useCallback(async (template: 'nextjs_docker', projectName?: string | null, targetShareId?: string | null, projectFiles?: Array<{ path: string, content: string }>) => {
        if (!activeConversation) return
        if (template !== 'nextjs_docker') {
            setStatusNotice(`Unsupported starter template: ${template}`)
            return
        }
        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            setStatusNotice('Sign in to create a repository.')
            return
        }

        try {
            setStatusNotice('Creating a Next.js + Docker repository...')
            const scaffold = await scaffoldNextjsDockerWorkspace({
                projectName,
                shareId: targetShareId || (activeConversation.workspaceKind === 'share' ? activeConversation.workspaceId : null),
                token,
                userId,
                projectFiles,
            })
            setShares((prev) => {
                const existing = prev.find((share) => share.id === scaffold.rootId)
                const nextShare: Share = existing ? {
                    ...existing,
                    path: scaffold.rootPath,
                    alias: scaffold.rootName,
                    content: existing.content || '',
                } : {
                    id: scaffold.rootId,
                    path: scaffold.rootPath,
                    alias: scaffold.rootName,
                    content: '',
                    wordCount: 0,
                    estimatedMinutes: 0,
                    timestamp: new Date().toISOString(),
                    git: null,
                    locked: false,
                    owner: userId,
                    parent: '',
                }
                return [nextShare, ...prev.filter((share) => share.id !== scaffold.rootId)]
            })
            resetShareWorkspaceCache(scaffold.rootId)
            await attachShare(scaffold.rootId)
            await selectShareFile(scaffold.selectedFilePath)
            await patchConversation(activeConversation.id, {
                workspaceMeta: withWorkspaceActivity({
                    ...activeConversation.workspaceMeta,
                    selectedFilePath: scaffold.selectedFilePath,
                }, {
                    action: 'Scaffolded Next.js + Docker starter',
                    path: scaffold.selectedFilePath,
                    source: 'scaffold',
                }),
            })
            setStatusNotice(`Repository ready: ${scaffold.rootName}. Created ${scaffold.fileCount} files.`)
            return scaffold
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create the Next.js repository.'
            setStatusNotice(message)
            throw new Error(message, { cause: error })
        }
    }, [activeConversation, attachShare, selectShareFile, patchConversation, resetShareWorkspaceCache, setShares, setStatusNotice])
}
