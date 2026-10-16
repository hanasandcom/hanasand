import { getCookie } from '@/utils/cookies/cookies'
import { getShare } from '@/utils/share/get'
import type { IndexedWorkspaceFile, WorkspaceFile } from './types'

const searchableExtensions = new Set([
    'c', 'cc', 'cpp', 'cs', 'css', 'go', 'html', 'java', 'js', 'json', 'jsx', 'kt', 'md', 'mjs',
    'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'txt', 'xml', 'yaml', 'yml',
])

export function flattenWorkspaceTree(tree: Tree | null): WorkspaceFile[] {
    const files: WorkspaceFile[] = []

    function walk(items: Tree, parentPath: string) {
        for (const item of items) {
            const path = parentPath ? `${parentPath}/${item.name}` : item.name
            if (item.type === 'folder') {
                walk(item.children, path)
                continue
            }
            files.push({ id: item.id, name: item.name, path })
        }
    }

    if (tree) walk(tree, '')
    return stripSingleRoot(files)
}

function stripSingleRoot(files: WorkspaceFile[]) {
    if (!files.length) return files
    const [root] = files[0].path.split('/')
    if (!root || files.some(file => !file.path.startsWith(`${root}/`))) return files
    return files.map(file => ({ ...file, path: file.path.slice(root.length + 1) || file.name }))
}

export function isLikelySearchableFile(path: string) {
    const extension = path.split('.').pop()?.toLowerCase()
    return !extension || searchableExtensions.has(extension)
}

export async function loadWorkspaceFiles({
    files,
    activeShare,
    activeContent,
    cache,
}: {
    files: WorkspaceFile[]
    activeShare: Share | null
    activeContent: string
    cache: Map<string, IndexedWorkspaceFile>
}) {
    const userId = getCookie('id') ?? undefined
    const token = getCookie('access_token') ?? undefined
    const activeId = activeShare?.id
    const indexed = await Promise.all(files
        .filter(file => isLikelySearchableFile(file.path))
        .map(async (file): Promise<IndexedWorkspaceFile | null> => {
            if (file.id === activeId) {
                const current = { ...file, content: activeContent }
                cache.set(file.id, current)
                return current
            }
            const cached = cache.get(file.id)
            if (cached) return cached
            const share = await getShare({ id: file.id, token, userId })
            if (typeof share === 'string') return null
            const loaded = { ...file, content: share.content || '' }
            cache.set(file.id, loaded)
            return loaded
        }))
    return indexed.filter(Boolean) as IndexedWorkspaceFile[]
}
