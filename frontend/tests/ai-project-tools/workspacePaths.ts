import type { ShareEntry } from './types'

export function listWorkspacePaths({ rootId, shareState, treeChildren }: {
    rootId: string
    shareState: Map<string, ShareEntry>
    treeChildren: Map<string, string[]>
}) {
    const paths: string[] = []
    const visit = (parentId: string, prefix = '') => {
        for (const childId of treeChildren.get(parentId) || []) {
            const entry = shareState.get(childId)
            if (!entry) continue
            const path = prefix ? `${prefix}/${entry.name}` : entry.name
            paths.push(path)
            if (entry.type === 'folder') visit(childId, path)
        }
    }
    visit(rootId)
    return paths.sort()
}
