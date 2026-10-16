export default function collectTreePaths(tree: Tree | null) {
    const paths: string[] = []

    function walk(items: FileItem[], prefix = '') {
        for (const item of items) {
            const path = prefix ? `${prefix}/${item.name}` : item.name
            paths.push(path)
            if (item.type === 'folder') walk(item.children, path)
        }
    }

    if (Array.isArray(tree)) walk(tree)
    return paths
}
