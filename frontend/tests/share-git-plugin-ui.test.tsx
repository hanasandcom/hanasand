import { createElement, type ReactElement } from 'react'
import { expect, mock, test } from 'bun:test'

const folderUpdates: string[][] = []
mock.module('@/hooks/useFolderState', () => ({
    default: () => ({ setOpenFolders: (folders: string[]) => folderUpdates.push(folders) }),
    OpenFoldersProvider: ({ children }: { children: unknown }) => children,
}))

const { default: Metadata } = await import('../src/components/share/metadata')
const { default: MetadataSidebar } = await import('../src/components/share/metadata/MetadataSidebar')
const { default: TreeHeader } = await import('../src/components/share/tree/treeHeader')
const { ExplorerFilePanel } = await import('../src/components/share/tree/explorerFilePanel')
const { renderToStaticMarkup } = await import('react-dom/server')

test('metadata parent renders its sidebar and initial workspace panel together', () => {
    const html = renderToStaticMarkup(createElement(Metadata, {
        shareRouteId: 'share-1', share: null, setShare() {}, isConnected: false, showMetadata: true,
        setShowMetadata() {}, participants: 0, clickedWord: null, setClickedWord() {}, editingContent: '',
        setDisplayLineNumbers() {}, syntaxHighlighting: true, setSyntaxHighlighting() {}, box: false, setBox() {},
        terminalStatus: 'Disconnected', terminalCredentials: null, tree: null, setEditorPatch() {}, setTriggerTerminalChange() {},
    }))

    expect(html).toContain('aria-label="Git plugin"')
    expect(html).toContain('Workspace status')
    expect(html).toContain('Build workspace')
})

test('metadata Git tab selection calls the parent panel handler', () => {
    const selected: string[] = []
    const sidebar = MetadataSidebar({
        shareRouteId: 'share-1', share: null, activePanel: 'workspace', onTogglePanel: panel => selected.push(panel),
        onClose() {}, onOpenBox() {}, editingContent: '', didCopy: false, setDidCopy() {}, setError() {},
        setDisplayLineNumbers() {}, syntaxHighlighting: true, setSyntaxHighlighting() {},
    })
    const button = findElement(sidebar, element => element.type === 'button' && element.props['aria-label'] === 'Git plugin')
    expect(button).toBeDefined()
    ;(button!.props.onClick as () => void)()
    expect(selected).toEqual(['git'])
})

test('explorer refresh passes its share ID through the TreeHeader callback', () => {
    const recovered: string[] = []
    const share = { id: 'share-root', alias: 'Project' } as Share
    const tree = [{ id: share.id, name: 'Project', type: 'folder', children: [{ id: 'nested', name: 'src', type: 'folder', children: [] }] }] as unknown as Tree
    const panel = ExplorerFilePanel({
        openFolders: [], tree, treeLoading: false, share, setShare() {},
        onRecoverTree: async id => { recovered.push(id); return tree }, isCreatingNewFile: null, setIsCreatingNewFile() {},
        newFileName: '', setNewFileName() {}, selectedFolder: '', setSelectedFolder() {}, setTree() {}, filter: '', setFilter() {},
    })
    const header = findElement(panel, element => element.type === TreeHeader)

    expect(header).toBeDefined()
    ;(header!.props.onRefresh as () => void)()
    expect(recovered).toEqual([share.id])
})

test('TreeHeader actions expand nested folders, collapse, refresh, create, and filter', () => {
    folderUpdates.length = 0
    const refreshes: number[] = []
    const creationUpdates: unknown[] = []
    const filters: string[] = []
    const tree = [{ id: 'root', type: 'folder', children: [{ id: 'nested', type: 'folder', children: [{ id: 'file', type: 'file' }] }] }]
    const header = TreeHeader({
        share: { alias: 'Example' } as Share, tree: tree as unknown as Tree, refreshing: false, onRefresh: () => refreshes.push(1),
        setIsCreatingNewFile: update => creationUpdates.push(typeof update === 'function' ? update(null) : update),
        filter: '', setFilter: update => filters.push(typeof update === 'function' ? update('') : update),
    })

    click(header, 'Refresh file tree')
    click(header, 'Expand all folders')
    click(header, 'Collapse all folders')
    click(header, 'Create file')
    change(header, 'Filter files...', 'report')

    expect(refreshes).toEqual([1])
    expect(folderUpdates).toEqual([['root', 'nested'], []])
    expect(creationUpdates).toEqual(['file'])
    expect(filters).toEqual(['report'])
})

function findElement(node: unknown, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
    if (!node || typeof node !== 'object' || !('props' in node)) return undefined
    const element = node as ReactElement<Record<string, unknown>>
    if (predicate(element)) return element
    const children = element.props.children
    for (const child of Array.isArray(children) ? children : [children]) {
        const found = findElement(child, predicate)
        if (found) return found
    }
    if (typeof element.type === 'function' && element.type.name === 'MetadataPanelButton') {
        return findElement(element.type(element.props), predicate)
    }
}

function click(node: unknown, label: string) {
    const button = findElement(node, element => element.type === 'button' && element.props['aria-label'] === label)
    expect(button).toBeDefined()
    ;(button!.props.onClick as () => void)()
}

function change(node: unknown, placeholder: string, value: string) {
    const input = findElement(node, element => element.type === 'input' && element.props.placeholder === placeholder)
    expect(input).toBeDefined()
    ;(input!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
}
