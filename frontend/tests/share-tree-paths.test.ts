import { expect, test } from 'bun:test'
import collectTreePaths from '../src/utils/share/collectTreePaths'
import { getShareRuntimeCapability } from '../src/utils/share/runtimeCapabilities'
import { getPreviewRuntime } from '../src/utils/share/previewFlow'

test('shares ordered nested workspace paths across capability and preview detection', () => {
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
    const runtime = getPreviewRuntime({ share, tree, activePath: 'project/src/server.ts', activeContent: '', capability })
    expect(runtime.framework).toBe('Node server')
    expect(runtime.canRun).toBe(true)
})
