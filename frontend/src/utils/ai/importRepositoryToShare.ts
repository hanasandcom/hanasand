import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'
import { ensureRepositoryParentFolder, postRepositoryFileShare } from './repositoryShareFolders'

type ImportRepositoryToShareProps = {
    repo: AIImportedRepo
    token?: string | null
    userId?: string | null
    onProgress?: (progress: AISyncProgress) => void
}

export async function importRepositoryToShare({
    repo,
    token,
    userId,
    onProgress,
}: ImportRepositoryToShareProps) {
    if (!token || !userId) {
        throw new Error('You must be signed in to sync a repository into the editor.')
    }

    const root = await postShare({
        id: repo.id,
        includeTree: true,
        content: '',
        name: repo.name,
        path: repo.fullName,
        type: 'folder',
        token,
        userId,
    })
    if (!root) {
        throw new Error('Failed to create the repository files.')
    }

    const folderIds = new Map<string, string>([['', repo.id]])
    let syncedFiles = 0
    onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: null })
    for (const file of repo.files) {
        const segments = file.path.split('/').filter(Boolean)
        const parentId = await ensureRepositoryParentFolder({ folderIds, filePath: file.path, rootId: repo.id, token, userId })

        const name = segments.at(-1)
        if (!name) {
            continue
        }

        const fileResponse = await postRepositoryFileShare({ id: randomId(), content: file.content, name, parent: parentId, token, userId })
        if (!fileResponse) {
            throw new Error(`Failed to create file ${file.path}.`)
        }

        syncedFiles += 1
        onProgress?.({ syncedFiles, totalFiles: repo.files.length, currentPath: file.path })
    }

    return repo.id
}
