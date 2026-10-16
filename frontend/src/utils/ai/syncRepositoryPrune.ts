import { deleteShare } from '@/utils/share/delete'

export async function pruneRemovedEntries({
    tree,
    nextFiles,
    token,
    userId,
}: {
    tree: Tree
    nextFiles: Set<string>
    token: string
    userId: string
}) {
    const staleFiles: string[] = []
    const staleFolders: { id: string, depth: number }[] = []
    const retainedFolders = retainedParentPaths(nextFiles)
    collectStaleEntries(tree, '', nextFiles, retainedFolders, staleFiles, staleFolders)

    for (const fileId of staleFiles) {
        const ok = await deleteShare(fileId, token, userId)
        if (!ok) {
            throw new Error('Failed to remove a stale file from the repository workspace.')
        }
    }

    for (const folder of staleFolders.sort((left, right) => right.depth - left.depth)) {
        const ok = await deleteShare(folder.id, token, userId)
        if (!ok) {
            throw new Error('Failed to remove a stale folder from the repository workspace.')
        }
    }
}

function retainedParentPaths(files: Set<string>) {
    const paths = new Set<string>()
    for (const file of files) {
        for (let separator = file.indexOf('/'); separator >= 0; separator = file.indexOf('/', separator + 1)) {
            paths.add(file.slice(0, separator))
        }
    }
    return paths
}

function collectStaleEntries(
    tree: Tree,
    prefix: string,
    nextFiles: Set<string>,
    retainedFolders: Set<string>,
    staleFiles: string[],
    staleFolders: { id: string, depth: number }[],
) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type === 'file') {
            if (!nextFiles.has(path)) {
                staleFiles.push(item.id)
            }
            continue
        }

        collectStaleEntries(item.children, path, nextFiles, retainedFolders, staleFiles, staleFolders)
        if (!retainedFolders.has(path)) {
            staleFolders.push({ id: item.id, depth: path.split('/').length })
        }
    }
}
