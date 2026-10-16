// @ts-expect-error Bun provides this module when running tests.
import { expect, mock, test } from 'bun:test'

const deletedIds: string[] = []
let failingId: string | null = null
mock.module('@/utils/share/delete', () => ({
    deleteShare: async (id: string) => {
        deletedIds.push(id)
        return id !== failingId
    },
}))

const { pruneRemovedEntries } = await import('../src/utils/ai/syncRepositoryPrune')

test('removes stale files before deepest-first stale folders and keeps needed paths', async () => {
    deletedIds.length = 0
    failingId = null
    const tree = [
        { id: 'stale-root-file', name: 'old.txt', type: 'file' },
        {
            id: 'source-folder', name: 'src', type: 'folder', children: [
                { id: 'retained-file', name: 'keep.ts', type: 'file' },
                { id: 'stale-nested-folder', name: 'old', type: 'folder', children: [
                    { id: 'stale-nested-file', name: 'gone.ts', type: 'file' },
                ] },
            ],
        },
        { id: 'empty-parent', name: 'empty', type: 'folder', children: [
            { id: 'empty-child', name: 'nested', type: 'folder', children: [] },
        ] },
    ] as unknown as Tree

    await pruneRemovedEntries({ tree, nextFiles: new Set(['src/keep.ts']), token: 'token', userId: 'user' })

    expect(deletedIds.slice(0, 2)).toEqual(['stale-root-file', 'stale-nested-file'])
    expect(deletedIds.slice(2)).toEqual(['stale-nested-folder', 'empty-child', 'empty-parent'])
})

test('stops pruning when a stale share cannot be deleted', async () => {
    deletedIds.length = 0
    failingId = 'stale-file'
    const tree = [{ id: 'stale-file', name: 'gone.ts', type: 'file' }] as unknown as Tree

    await expect(pruneRemovedEntries({ tree, nextFiles: new Set(), token: 'token', userId: 'user' }))
        .rejects.toThrow('Failed to remove a stale file from the repository workspace.')
    expect(deletedIds).toEqual(['stale-file'])
    failingId = null
})
