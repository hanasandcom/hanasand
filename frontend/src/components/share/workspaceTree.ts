import { walkWorkspaceTree } from '@/utils/share/walkWorkspaceTree'
export { walkWorkspaceTree } from '@/utils/share/walkWorkspaceTree'

type TreeCounts = {
    files: number
    folders: number
}

export function listTreePaths(tree: Tree | null, prefix = ''): string[] {
    return [...walkWorkspaceTree(tree, prefix)]
        .filter(({ item }) => item.type === 'file')
        .map(({ path }) => path)
}

export function findTreeFileId(tree: Tree | null, targetPath: string, prefix = ''): string | null {
    for (const { item, path } of walkWorkspaceTree(tree, prefix)) {
        if (item.type === 'file' && path === targetPath) return item.id
    }
    return null
}

export function getWorkspaceRoot(tree: Tree | null, share: Share | null): FileFolder | null {
    if (!tree || !share || tree.length !== 1) {
        return null
    }

    const [root] = tree
    if (root.type !== 'folder') {
        return null
    }

    if (root.id === share.id || (root.parent === null && root.name.startsWith('project-'))) {
        return root
    }

    return null
}

export function getVisibleWorkspaceTree(tree: Tree | null, share: Share | null): Tree | null {
    return getWorkspaceRoot(tree, share)?.children || tree
}

export function countTreeItems(tree: Tree | null): TreeCounts {
    const counts = { files: 0, folders: 0 }
    for (const { item } of walkWorkspaceTree(tree)) {
        counts[item.type === 'file' ? 'files' : 'folders'] += 1
    }
    return counts
}

export function getWorkspaceName(tree: Tree | null, share: Share | null, fallbackId: string) {
    return getWorkspaceRoot(tree, share)?.name || share?.alias || fallbackId
}

export function findPath(tree: Tree | null, id: string, parents: string[] = []): string | null {
    for (const { item, path } of walkWorkspaceTree(tree, parents)) {
        if (item.id === id) return path
    }
    return null
}

export function isWorkspaceRootItem(tree: Tree | null, share: Share | null, id: string) {
    const root = getWorkspaceRoot(tree, share)
    return Boolean(root && root.id === id)
}
