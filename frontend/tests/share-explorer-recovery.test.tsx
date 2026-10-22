import { createElement } from 'react'
import { expect, mock, test } from 'bun:test'

const treeRequests: unknown[] = []
let filePanelProps: Record<string, unknown> | null = null
const nextTree = [{ id: 'share-root', name: 'Project', type: 'folder', children: [] }]

mock.module('@/hooks/useHideIfLittleSpace', () => ({ default() {} }))
mock.module('@/hooks/movable', () => ({ default: () => ({ position: { x: 0, y: 0 }, handleMouseDown() {}, handleOpen() {} }) }))
mock.module('hanasand/cookies', () => ({ getCookie: (name: string) => name === 'id' ? 'user-1' : 'access-token' }))
mock.module('@/utils/share/getTree', () => ({ getTree: async (request: unknown) => { treeRequests.push(request); return nextTree } }))
mock.module('@/components/share/tree/explorerFilePanel', () => ({
    ExplorerFilePanel: (props: Record<string, unknown>) => { filePanelProps = props; return createElement('div') },
}))
mock.module('@/components/share/tree/explorerNavigation', () => ({ ExplorerNavigation: () => createElement('nav') }))
mock.module('@/components/share/workspaceSearchPanel', () => ({ default: () => createElement('section') }))

const { default: Explorer } = await import('../src/components/share/tree/explorer')
const { renderToStaticMarkup } = await import('react-dom/server')

test('Explorer passes its recovery handler to the file panel and reloads the selected share tree', async () => {
    treeRequests.length = 0
    filePanelProps = null
    const share = { id: 'share-root', alias: 'Project' } as Share
    renderToStaticMarkup(createElement(Explorer, {
        showExplorer: true, setShowExplorer() {}, openFolders: [], tree: nextTree as unknown as Tree, share,
        setShare() {}, editingContent: '', setEditorPatch() {}, setError() {}, setPageTree() {},
    }))

    expect(filePanelProps).not.toBeNull()
    const recover = filePanelProps!.onRecoverTree as (id: string) => Promise<Tree | null>
    await recover(share.id)

    expect(treeRequests).toEqual([{ id: share.id, token: 'access-token', userId: 'user-1' }])
})
