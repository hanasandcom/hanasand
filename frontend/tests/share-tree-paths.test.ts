import { expect, test } from 'bun:test'
import collectTreePaths from '../src/utils/share/collectTreePaths'
import { getShareRuntimeCapability } from '../src/utils/share/runtimeCapabilities'

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
