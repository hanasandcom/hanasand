import randomId from '@/utils/random/randomId'
import { findTreeFileId } from '@/components/share/workspaceTree'
import { getTree } from '@/utils/share/getTree'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import type { NextjsDockerTemplate, WorkspaceTemplateFile } from './nextjsDockerTemplate'
import { ensureRepositoryParentFolder, postRepositoryFileShare, registerRepositoryFolders } from './repositoryShareFolders'

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
    if (initialTree) registerRepositoryFolders(initialTree, '', folderIds)

    for (const file of files) {
        const latestTree = await getTree({ id: rootId, token, userId })
        const parentId = await ensureRepositoryParentFolder({
            folderIds,
            filePath: file.path,
            rootId,
            token,
            userId,
            idLength: 12,
        })
        const fileId = latestTree ? findTreeFileId(latestTree, file.path) : null

        if (fileId) {
            const updated = await updateShare(fileId, { content: file.content })
            if (!updated) throw new Error(`Failed to update ${file.path}.`)
            continue
        }

        const name = file.path.split('/').pop()
        if (!name) continue

        const created = await postRepositoryFileShare({ id: randomId(12), content: file.content, name, parent: parentId, token, userId })
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
