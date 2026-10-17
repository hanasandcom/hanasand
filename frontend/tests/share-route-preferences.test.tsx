// @ts-expect-error Bun provides this module when running focused tests.
import { afterEach, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readShareRoutePreferences } from '../src/utils/share/routePreferences'

let cookieValues: Record<string, string> = {}
let projectResult: unknown
let shareResult: unknown
let treeResult: unknown
const clientProps: Record<string, unknown>[] = []
const calls: Array<{ name: string, input?: unknown }> = []
const renderClient = (props: Record<string, unknown>) => {
    clientProps.push(props)
    return createElement('div', { 'data-share-client': String(props.id) })
}

mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => cookieValues[name] === undefined ? undefined : { value: cookieValues[name] } }),
}))
mock.module('next/navigation', () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`) } }))
mock.module('@/utils/projects/getProject', () => ({ default: async (input: unknown) => { calls.push({ name: 'project', input }); return projectResult } }))
mock.module('@/utils/share/get', () => ({ getShare: async (input: unknown) => { calls.push({ name: 'share', input }); return shareResult } }))
mock.module('@/utils/share/getTree', () => ({ getTree: async (input: unknown) => { calls.push({ name: 'tree', input }); return treeResult } }))
mock.module('@/app/s/[...id]/clientPage', () => ({ default: renderClient }))
mock.module('../src/app/s/[...id]/clientPage', () => ({ default: renderClient }))

const { default: ProjectPage } = await import('../src/app/p/[...id]/page')
const { default: SharePage } = await import('../src/app/s/[...id]/page')

function resetState() {
    cookieValues = {
        id: 'user-1', access_token: 'token-1', openFolders: '["src"]', openFiles: '[{"path":"src/main.ts"}]',
        sharePageWidth: '720', shareTerminalHeight: '420',
    }
    projectResult = null
    shareResult = null
    treeResult = []
    clientProps.length = 0
    calls.length = 0
}

afterEach(resetState)

test('share route preferences parse cookie values and apply empty defaults', () => {
    const values = new Map<string, string>([
        ['openFolders', '["src","docs"]'], ['openFiles', '[{"path":"src/main.ts"}]'],
        ['sharePageWidth', '640'], ['shareTerminalHeight', '360'],
    ])
    const read = (name: string) => values.has(name) ? { value: values.get(name)! } : undefined
    expect(readShareRoutePreferences({ get: read }, 'share')).toEqual({
        openFolders: ['src', 'docs'], openFiles: [{ path: 'src/main.ts' }], sharePageWidth: 640, shareTerminalHeight: 360,
    })
    expect(readShareRoutePreferences({ get: () => undefined }, 'project')).toEqual({
        openFolders: [], openFiles: [], sharePageWidth: 0, shareTerminalHeight: 0,
    })
})

test('invalid preference cookies fall back safely and keep route-specific warnings', () => {
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = message => warnings.push(String(message))
    try {
        const read = (name: string) => name === 'openFolders' ? { value: '{bad json' } : undefined
        expect(readShareRoutePreferences({ get: read }, 'project').openFolders).toEqual([])
        expect(readShareRoutePreferences({ get: read }, 'share').openFolders).toEqual([])
    } finally {
        console.warn = originalWarn
    }
    expect(warnings[0]).toContain('project route cookie JSON')
    expect(warnings[1]).toContain('share route cookie JSON')
})

test('project route passes persisted preferences and the selected file share to its client', async () => {
    resetState()
    const project = { share: { id: 'project-share' }, tree: [{ id: 'root' }] }
    const activeShare = { id: 'file-share' }
    projectResult = project
    shareResult = activeShare

    renderToStaticMarkup(await ProjectPage({
        params: Promise.resolve({ id: ['project-alias'] }), searchParams: Promise.resolve({ file: 'file-share' }),
    }))

    expect(calls).toEqual([
        { name: 'project', input: { alias: 'project-alias', token: 'token-1', userId: 'user-1' } },
        { name: 'share', input: { id: 'file-share', token: 'token-1', userId: 'user-1' } },
    ])
    expect(clientProps.at(-1)).toMatchObject({
        id: 'project-share', share: activeShare, openFolders: ['src'], serverOpenFiles: [{ path: 'src/main.ts' }],
        tree: project.tree, sharePageWidth: 720, shareTerminalHeight: 420,
        autoCreate: false, initialChatOpen: false, replaceUrlOnCreate: false,
    })
})

test('share route keeps fetched and optimistic workspace client contracts', async () => {
    resetState()
    const share = { id: 'share-1', alias: 'share-1' }
    const tree = [{ id: 'share-1', type: 'folder', children: [] }]
    treeResult = tree
    shareResult = share

    renderToStaticMarkup(await SharePage({
        params: Promise.resolve({ id: ['share-1'] }), searchParams: Promise.resolve({ chat: '1' }),
    }))
    expect(clientProps.at(-1)).toMatchObject({
        id: 'share-1', share, tree, openFolders: ['src'], serverOpenFiles: [{ path: 'src/main.ts' }],
        sharePageWidth: 720, shareTerminalHeight: 420, autoCreate: false,
        initialChatOpen: true, replaceUrlOnCreate: true,
    })
    expect(calls.map(call => call.name)).toEqual(['tree', 'share'])

    calls.length = 0
    renderToStaticMarkup(await SharePage({
        params: Promise.resolve({ id: ['new-workspace'] }), searchParams: Promise.resolve({ new: '1' }),
    }))
    expect(calls).toEqual([])
    expect(clientProps.at(-1)).toMatchObject({
        id: 'new-workspace', autoCreate: true, initialChatOpen: false, replaceUrlOnCreate: true,
        tree: [{ id: 'new-workspace', type: 'folder', name: 'new-workspace', alias: 'new-workspace', parent: null, children: [] }],
    })
})
