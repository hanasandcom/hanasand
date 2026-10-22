'use client'

import { listTreePaths } from '@/components/share/workspaceTree'
import { workspaceRepositoryId } from './workspaceMetadata'

export async function buildWorkspaceContext(
    conversation: AIConversation,
    importedRepos: AIImportedRepo[],
    shareContents: Record<string, string>,
    shareTrees: Record<string, Tree>,
    shareFileContents: Record<string, string>,
) {
    const sections: string[] = []

    if (conversation.shareIds.length) {
        const activeShareId = conversation.workspaceId || conversation.shareIds[0]
        const fileSummary = conversation.shareIds.map((shareId) => {
            const content = shareContents[shareId] || ''
            const prefix = shareId === activeShareId ? 'active' : 'attached'
            return `${prefix} repository file ${shareId}:\n${content.slice(0, shareId === activeShareId ? 12000 : 2500)}`
        })
        sections.push(`Repository files:\n${fileSummary.join('\n\n')}`)
    }

    const repositoryId = workspaceRepositoryId(conversation)
    if (repositoryId) {
        const repo = importedRepos.find((item) => item.id === repositoryId)
        if (repo) {
            const rootId = conversation.workspaceId || repo.id
            const selectedPath = String(conversation.workspaceMeta?.selectedFilePath || repo.files[0]?.path || '')
            const selectedFile = repo.files.find((file) => file.path === selectedPath) || repo.files[0]
            const treePaths = listTreePaths(shareTrees[rootId])
            const liveContent = shareFileContents[`${rootId}:${selectedPath}`]
            sections.push([
                `Repository: ${repo.fullName} on branch ${repo.branch}.`,
                `Repository files:\n${(treePaths.length ? treePaths : repo.files.map((file) => file.path)).slice(0, 80).join('\n')}`,
                selectedFile ? `Focused file (${selectedFile.path}):\n${(liveContent || selectedFile.content).slice(0, 12000)}` : null,
            ].filter(Boolean).join('\n\n'))
        }
    }

    return sections.join('\n\n').trim()
}
