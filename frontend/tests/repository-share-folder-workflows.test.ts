import { expect, mock, test } from 'bun:test'

type ShareRequest = { id: string, name: string, parent?: string, type: string, includeTree: boolean, content: string, path?: string, token?: string, userId?: string }
type TreeNode = { id: string, name: string, type: 'file' | 'folder', children: TreeNode[] }

const requests: ShareRequest[] = []
const idLengths: number[] = []
let tree: TreeNode[] | null = []
let failedRequest = 0
let requestCount = 0
const updates: Array<[string, unknown]> = []
const progress: Array<{ syncedFiles: number, totalFiles: number, currentPath: string | null }> = []

mock.module('@/utils/random/randomId', () => ({
    default: (length = 6) => {
        idLengths.push(length)
        return `${'x'.repeat(length - 1)}${idLengths.length}`
    },
}))
mock.module('@/utils/share/post', () => ({
    default: async (request: ShareRequest) => {
        requests.push(request)
        requestCount += 1
        return requestCount === failedRequest ? null : { id: request.id }
    },
}))
mock.module('@/utils/share/getTree', () => ({ getTree: async () => tree }))
mock.module('@/utils/share/put', () => ({ updateShare: async (id: string, data: unknown) => { updates.push([id, data]); return { id } } }))
mock.module('@/components/share/workspaceTree', () => ({ findTreeFileId: () => null }))
mock.module('./syncRepositoryPrune', () => ({ pruneRemovedEntries: async () => undefined }))

const folders = await import('../src/utils/ai/repositoryShareFolders')
const scaffold = await import('../src/utils/ai/scaffoldWorkspaceShare')
const sync = await import('../src/utils/ai/syncRepositoryToShare')
const importer = await import('../src/utils/ai/importRepositoryToShare')

function reset() {
    requests.length = 0
    idLengths.length = 0
    updates.length = 0
    progress.length = 0
    requestCount = 0
    failedRequest = 0
}

test('registers only existing folder nodes and creates each normalized parent once', async () => {
    reset()
    const ids = new Map<string, string>([['', 'root']])
    folders.registerRepositoryFolders([
        { id: 'src-id', name: 'src', type: 'folder', children: [
            { id: 'file-id', name: 'keep.ts', type: 'file', children: [] },
        ] },
    ] as unknown as Tree, '', ids)

    const parentId = await folders.ensureRepositoryParentFolder({
        folderIds: ids, filePath: '//src///new/first.ts', rootId: 'root', token: 'token', userId: 'user',
    })
    const reusedId = await folders.ensureRepositoryParentFolder({
        folderIds: ids, filePath: 'src/new/second.ts', rootId: 'root', token: 'token', userId: 'user',
    })

    expect(ids.get('src')).toBe('src-id')
    expect(ids.has('src/keep.ts')).toBe(false)
    expect(ids.get('src/new')).toBe(parentId)
    expect(reusedId).toBe(parentId)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ name: 'new', parent: 'src-id', type: 'folder', includeTree: false, content: '' })

    reset()
    failedRequest = 1
    await expect(folders.ensureRepositoryParentFolder({
        folderIds: new Map(), filePath: 'missing/file.ts', rootId: 'root', token: 'token', userId: 'user',
    })).rejects.toThrow('Failed to create folder missing.')
})

test('scaffolding preserves 12-character IDs while reusing folders from the current tree', async () => {
    reset()
    tree = [{ id: 'src-id', name: 'src', type: 'folder', children: [] }]
    await scaffold.syncTemplateFiles({
        rootId: 'root', token: 'token', userId: 'user',
        files: [{ path: 'src/nested/app.ts', content: 'starter' }],
    })

    expect(requests.map(request => [request.name, request.parent, request.type])).toEqual([
        ['nested', 'src-id', 'folder'], ['app.ts', requests[0].id, 'file'],
    ])
    expect(requests[1]).toMatchObject({ includeTree: false, content: 'starter', name: 'app.ts', parent: requests[0]!.id, type: 'file', token: 'token', userId: 'user' })
    expect(idLengths).toEqual([12, 12])
})

test('repository sync reuses created folders across files and reports progress in order', async () => {
    reset()
    tree = [{ id: 'src-id', name: 'src', type: 'folder', children: [] }]
    const repo = { id: 'root', fullName: 'owner/repo', files: [
        { path: 'src/generated/a.ts', content: 'a' }, { path: 'src/generated/b.ts', content: 'b' },
    ] } as AIImportedRepo

    await sync.syncRepositoryToShare({ repo, token: 'token', userId: 'user', onProgress: value => progress.push(value) })

    expect(requests.filter(request => request.type === 'folder').map(request => request.name)).toEqual(['generated'])
    expect(requests.slice(1).map(({ includeTree, content, name, parent, type, token, userId }) => ({ includeTree, content, name, parent, type, token, userId }))).toEqual([
        { includeTree: false, content: 'a', name: 'a.ts', parent: requests[0]!.id, type: 'file', token: 'token', userId: 'user' },
        { includeTree: false, content: 'b', name: 'b.ts', parent: requests[0]!.id, type: 'file', token: 'token', userId: 'user' },
    ])
    expect(requests.map(request => request.id.length)).toEqual([6, 6, 6])
    expect(progress.map(value => value.currentPath)).toEqual([null, 'src/generated/a.ts', 'src/generated/b.ts'])
    expect(updates).toEqual([['root', { path: 'owner/repo' }]])
})

test('import creates its root first, deduplicates parents, and retains file errors', async () => {
    reset()
    tree = null
    const repo = { id: 'repo-id', name: 'repo', fullName: 'owner/repo', files: [
        { path: 'src/new/a.ts', content: 'a' }, { path: 'src/new/b.ts', content: 'b' },
    ] } as AIImportedRepo

    await importer.importRepositoryToShare({ repo, token: 'token', userId: 'user', onProgress: value => progress.push(value) })

    expect(requests.map(request => request.type)).toEqual(['folder', 'folder', 'folder', 'file', 'file'])
    expect(requests[0]).toMatchObject({ id: 'repo-id', includeTree: true, name: 'repo', path: 'owner/repo' })
    expect(requests.filter(request => request.type === 'folder').map(request => request.name)).toEqual(['repo', 'src', 'new'])
    expect(requests.slice(3).map(({ includeTree, content, name, parent, type, token, userId }) => ({ includeTree, content, name, parent, type, token, userId }))).toEqual([
        { includeTree: false, content: 'a', name: 'a.ts', parent: requests[2]!.id, type: 'file', token: 'token', userId: 'user' },
        { includeTree: false, content: 'b', name: 'b.ts', parent: requests[2]!.id, type: 'file', token: 'token', userId: 'user' },
    ])
    expect(idLengths).toEqual([6, 6, 6, 6])
    expect(progress.map(value => value.currentPath)).toEqual([null, 'src/new/a.ts', 'src/new/b.ts'])

    reset()
    failedRequest = 1
    await expect(importer.importRepositoryToShare({ repo, token: 'token', userId: 'user' }))
        .rejects.toThrow('Failed to create the repository files.')
    expect(requests).toHaveLength(1)

    reset()
    failedRequest = 2
    await expect(importer.importRepositoryToShare({
        repo: { ...repo, files: [{ path: 'a.ts', content: 'a' }] }, token: 'token', userId: 'user',
    })).rejects.toThrow('Failed to create file a.ts.')
})
