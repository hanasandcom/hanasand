import randomId from '@/utils/random/randomId'
import { getTree } from '@/utils/share/getTree'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import { findTreeFileId } from '@/components/share/workspaceTree'
import { pruneRemovedEntries } from './syncRepositoryPrune'
import { ensureRepositoryParentFolder, registerRepositoryFolders } from './repositoryShareFolders'

type SyncRepositoryToShareProps = {
    repo: AIImportedRepo
    token?: string | null
    userId?: string | null
    onProgress?: (progress: AISyncProgress) => void
}

export async function syncRepositoryToShare({
    repo,
    token,
    userId,
    onProgress,
}: SyncRepositoryToShareProps) {
    if (!token || !userId) {
        throw new Error('You must be signed in to sync a repository into the editor.')
    }

    const tree = await getTree({ id: repo.id, token, userId })
    if (!tree) {
        return importRepositoryToShareFallback({ repo, token, userId, onProgress })
    }

    const folderIds = new Map<string, string>([['', repo.id]])
    registerRepositoryFolders(tree, '', folderIds)

    let syncedFiles = 0
    onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: null })
    for (const file of repo.files) {
        const parentId = await ensureRepositoryParentFolder({
            folderIds,
            filePath: file.path,
            rootId: repo.id,
            token,
            userId,
        })
        const fileId = findTreeFileId(tree, file.path)
        if (fileId) {
            await updateShare(fileId, { content: file.content })
            syncedFiles += 1
            onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: file.path })
            continue
        }

        const name = file.path.split('/').pop()
        if (!name) {
            continue
        }

        const created = await postShare({
            id: randomId(),
            includeTree: false,
            content: file.content,
            name,
            parent: parentId,
            type: 'file',
            token,
            userId,
        })
        if (!created) {
            throw new Error(`Failed to create file ${file.path}.`)
        }
        syncedFiles += 1
        onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: file.path })
    }

    await pruneRemovedEntries({
        tree,
        nextFiles: new Set(repo.files.map((file) => file.path)),
        token,
        userId,
    })
    await updateShare(repo.id, { path: repo.fullName })
    return repo.id
}

async function importRepositoryToShareFallback({
    repo,
    token,
    userId,
    onProgress,
}: {
    repo: AIImportedRepo
    token: string
    userId: string
    onProgress?: (progress: AISyncProgress) => void
}) {
    const { importRepositoryToShare } = await import('./importRepositoryToShare')
    return importRepositoryToShare({ repo, token, userId, onProgress })
}
