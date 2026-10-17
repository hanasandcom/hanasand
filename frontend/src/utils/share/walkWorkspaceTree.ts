export function* walkWorkspaceTree(tree: Tree | null, prefix: string | string[] = ''): Generator<{ item: FileItem, path: string }> {
    for (const item of Array.isArray(tree) ? tree : []) {
        const pathParts = Array.isArray(prefix) ? [...prefix, item.name] : null
        const path = pathParts ? pathParts.join('/') : prefix ? `${prefix}/${item.name}` : item.name
        yield { item, path }
        if (item.type === 'folder') yield* walkWorkspaceTree(item.children, pathParts || path)
    }
}
