import { expect, test } from 'bun:test'
import collectTreePaths from '../src/utils/share/collectTreePaths'
import { getShareRuntimeCapability } from '../src/utils/share/runtimeCapabilities'
import { parentIdForPath } from '../src/components/share/shareChatChanges'

const tree = [{
    id: 'root', name: 'root', type: 'folder', alias: null, parent: null,
    children: [
        { id: 'left', name: 'left', type: 'folder', alias: null, parent: 'root', children: [
            { id: 'left-shared', name: 'shared', type: 'folder', alias: null, parent: 'left', children: [] },
        ] },
        { id: 'right', name: 'right', type: 'folder', alias: null, parent: 'root', children: [
            { id: 'right-shared', name: 'shared', type: 'folder', alias: null, parent: 'right', children: [] },
        ] },
    ],
}] as Tree

test('resolves parent IDs from normalized nested paths and distinguishes duplicate folder names', () => {
    expect(parentIdForPath(tree, 'root/left/shared/new.ts')).toBe('left-shared')
    expect(parentIdForPath(tree, 'root/right/shared/new.ts')).toBe('right-shared')
    expect(parentIdForPath(tree, '///root//left//shared///new.ts')).toBe('left-shared')
})

test('root-level files and missing parent paths have no resolved parent', () => {
    expect(parentIdForPath(tree, 'index.html')).toBeUndefined()
    expect(parentIdForPath(tree, 'root/left/missing/new.ts')).toBeUndefined()
    expect(parentIdForPath(null, 'root/left/shared/new.ts')).toBeUndefined()
})

test('collects ordered nested paths and derives current share runtime capability', () => {
    const tree = [{
        id: 'project', name: 'project', type: 'folder', alias: null, parent: null,
        children: [
            { id: 'package', name: 'package.json', type: 'file', alias: null, parent: 'project' },
            { id: 'source', name: 'src', type: 'folder', alias: null, parent: 'project', children: [
                { id: 'server', name: 'server.ts', type: 'file', alias: null, parent: 'source' },
            ] },
        ],
    }] as Tree

    expect(collectTreePaths(tree)).toEqual(['project', 'project/package.json', 'project/src', 'project/src/server.ts'])
    expect(collectTreePaths(null)).toEqual([])
    expect(collectTreePaths(undefined as unknown as Tree)).toEqual([])

    const share = { alias: 'demo', content: '' } as Share
    const capability = getShareRuntimeCapability({ share, tree, activeContent: '' })
    expect(capability.hasHttpSurface).toBe(true)
    expect(capability.canDeploy).toBe(true)
    expect(capability.canPreview).toBe(true)
    expect(capability.reason).toBe('Detected server code.')
    expect(capability.evidence).toEqual(['server code'])
})
