import randomId from '@/utils/random/randomId'
import postShare from '@/utils/share/post'

type ShareAccess = { token: string, userId: string }

type EnsureParentFolderProps = ShareAccess & {
    folderIds: Map<string, string>
    filePath: string
    rootId: string
    idLength?: number
}

export async function ensureRepositoryParentFolder({
    folderIds,
    filePath,
    rootId,
    token,
    userId,
    idLength,
}: EnsureParentFolderProps) {
    const directories = filePath.split('/').filter(Boolean).slice(0, -1)
    let parentId = rootId
    let currentPath = ''

    for (const directory of directories) {
        currentPath = currentPath ? `${currentPath}/${directory}` : directory
        const existingFolderId = folderIds.get(currentPath)
        if (existingFolderId) {
            parentId = existingFolderId
            continue
        }

        const folderId = idLength === undefined ? randomId() : randomId(idLength)
        const response = await postShare({
            id: folderId,
            includeTree: false,
            content: '',
            name: directory,
            parent: parentId,
            type: 'folder',
            token,
            userId,
        })
        if (!response) throw new Error(`Failed to create folder ${currentPath}.`)

        folderIds.set(currentPath, folderId)
        parentId = folderId
    }

    return parentId
}

type RepositoryFileShare = ShareAccess & { id: string, name: string, parent: string, content: string }

export function postRepositoryFileShare({ id, name, parent, content, token, userId }: RepositoryFileShare) {
    return postShare({ id, includeTree: false, content, name, parent, type: 'file', token, userId })
}

export function registerRepositoryFolders(tree: Tree, prefix: string, folderIds: Map<string, string>) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type !== 'folder') continue
        folderIds.set(path, item.id)
        registerRepositoryFolders(item.children, path, folderIds)
    }
}
