import { getShare } from '@/utils/share/get'
import postShare from '@/utils/share/post'
import randomId from '@/utils/random/randomId'

export async function duplicateTreeItem({ item, rootTree, parent, token, userId, uniquifyName = false }: {
    item: FileItem
    rootTree: Tree
    parent?: string
    token?: string | null
    userId?: string | null
    uniquifyName?: boolean
}) {
    const id = randomId()
    const name = uniquifyName ? uniqueName(item.name, siblingsForParent(rootTree, item.parent)) : item.name
    const content = item.type === 'file' ? await getFileContent(item.id, token, userId) : ''

    await postShare({
        includeTree: false,
        id,
        content,
        name,
        parent,
        type: item.type,
        token,
        userId,
    })

    if (item.type === 'folder') {
        for (const child of item.children) {
            await duplicateTreeItem({ item: child, rootTree, parent: id, token, userId })
        }
    }
}

async function getFileContent(id: string, token?: string | null, userId?: string | null) {
    const share = await getShare({ id, token: token || undefined, userId: userId || undefined })
    return typeof share === 'string' ? '' : share.content
}

function siblingsForParent(tree: Tree, parent: string | null): FileItem[] {
    if (parent === null) return tree
    const folder = findItem(tree, parent)
    return folder?.type === 'folder' ? folder.children : tree
}

function findItem(tree: Tree, id: string): FileItem | null {
    for (const item of tree) {
        if (item.id === id) return item
        if (item.type === 'folder') {
            const found = findItem(item.children, id)
            if (found) return found
        }
    }
    return null
}

function uniqueName(name: string, siblings: FileItem[]) {
    const names = new Set(siblings.map(item => item.name))
    const extension = name.match(/(\.[^./]+)$/)?.[1] || ''
    const base = extension ? name.slice(0, -extension.length) : name
    let candidate = `${base} copy${extension}`
    let count = 2
    while (names.has(candidate)) {
        candidate = `${base} copy ${count}${extension}`
        count += 1
    }
    return candidate
}
