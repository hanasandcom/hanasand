import randomId from '@/utils/random/randomId'
import { findTreeFileId } from '@/components/ai/shareTree'
import { getTree } from '@/utils/share/getTree'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import type { NextjsDockerTemplate, WorkspaceTemplateFile } from './nextjsDockerTemplate'

type ShareAccess = {
    rootId: string
    token: string
    userId: string
}

export async function ensureWorkspaceRoot({
    rootId,
    existingShare,
    template,
    token,
    userId,
}: ShareAccess & {
    existingShare: boolean
    template: NextjsDockerTemplate
}) {
    const root = existingShare
        ? await ensureExistingRoot({ rootId, template, token, userId })
        : await createWorkspaceRoot({ rootId, template, token, userId })

    if (!root) throw new Error('Failed to create the Next.js workspace root.')
    if (existingShare) await updateShare(rootId, { path: template.rootPath })
}

export async function syncTemplateFiles({
    rootId,
    files,
    token,
    userId,
}: ShareAccess & { files: WorkspaceTemplateFile[] }) {
    const initialTree = await getTree({ id: rootId, token, userId })
    const folderIds = new Map<string, string>([['', rootId]])
    if (initialTree) registerFolders(initialTree, '', folderIds)

    for (const file of files) {
        const latestTree = await getTree({ id: rootId, token, userId })
        const parentId = await ensureParentFolder({
            folderIds,
            filePath: file.path,
            rootId,
            token,
            userId,
        })
        const fileId = latestTree ? findTreeFileId(latestTree, file.path) : null

        if (fileId) {
            const updated = await updateShare(fileId, { content: file.content })
            if (!updated) throw new Error(`Failed to update ${file.path}.`)
            continue
        }

        const name = file.path.split('/').pop()
        if (!name) continue

        const created = await postShare({
            id: randomId(12),
            includeTree: false,
            content: file.content,
            name,
            parent: parentId,
            type: 'file',
            token,
            userId,
        })
        if (!created) throw new Error(`Failed to create ${file.path}.`)
    }
}

async function ensureExistingRoot({
    rootId,
    template,
    token,
    userId,
}: ShareAccess & { template: NextjsDockerTemplate }) {
    const tree = await getTree({ id: rootId, token, userId })
    if (tree) return { id: rootId }
    return createWorkspaceRoot({ rootId, template, token, userId })
}

async function createWorkspaceRoot({
    rootId,
    template,
    token,
    userId,
}: ShareAccess & { template: NextjsDockerTemplate }) {
    return postShare({
        id: rootId,
        includeTree: true,
        content: '',
        name: template.rootName,
        path: template.rootPath,
        type: 'folder',
        token,
        userId,
    })
}

async function ensureParentFolder({
    folderIds,
    filePath,
    rootId,
    token,
    userId,
}: ShareAccess & {
    folderIds: Map<string, string>
    filePath: string
}) {
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

        const folderId = randomId(12)
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

function registerFolders(tree: Tree, prefix: string, folderIds: Map<string, string>) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type !== 'folder') continue
        folderIds.set(path, item.id)
        registerFolders(item.children, path, folderIds)
    }
}
