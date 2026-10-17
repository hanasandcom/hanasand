import { walkWorkspaceTree } from './walkWorkspaceTree'

export default function collectTreePaths(tree: Tree | null) {
    return [...walkWorkspaceTree(tree)].map(({ path }) => path)
}
