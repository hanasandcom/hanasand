// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import {
    extractClickedToken,
    findSymbolDefinitions,
    flattenWorkspaceTree,
    replaceInContent,
    searchIndexedFiles,
    type IndexedWorkspaceFile,
    type WorkspaceSearchOptions,
} from '@/components/share/workspaceSearchUtils'
import { searchIndexedFilesWithSymbolResolver } from '@/components/share/workspaceSearch/matching'
import { countTreeItems, findPath, findTreeFileId, listTreePaths } from '@/components/share/workspaceTree'

const defaults: WorkspaceSearchOptions = {
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    include: '',
    exclude: 'node_modules,.next,dist,build',
}

function file(path: string, content: string): IndexedWorkspaceFile {
    return { id: path, name: path.split('/').at(-1) || path, path, content }
}

test('workspace file flattening removes one common project root and keeps nested paths', () => {
    const result = flattenWorkspaceTree([{
        id: 'root', name: 'project', alias: null, parent: null, type: 'folder', children: [
            { id: 'a', name: 'src', alias: null, parent: 'root', type: 'folder', children: [
                { id: 'b', name: 'main.ts', alias: null, parent: 'a', type: 'file' },
            ] },
            { id: 'c', name: 'README.md', alias: null, parent: 'root', type: 'file' },
        ],
    }])
    expect(result.map(({ id, path }) => [id, path])).toEqual([['b', 'src/main.ts'], ['c', 'README.md']])
})

test('shared tree traversal returns nested file IDs and full paths, including folder IDs', () => {
    const tree = [{
        id: 'root', name: 'project', alias: null, parent: null, type: 'folder' as const, children: [
            { id: 'folder', name: 'src', alias: null, parent: 'root', type: 'folder' as const, children: [
                { id: 'file', name: 'main.ts', alias: null, parent: 'folder', type: 'file' as const },
            ] },
        ],
    }]

    expect(listTreePaths(tree)).toEqual(['project/src/main.ts'])
    expect(listTreePaths(tree, 'workspace')).toEqual(['workspace/project/src/main.ts'])
    expect(findTreeFileId(tree, 'project/src/main.ts')).toBe('file')
    expect(findTreeFileId(tree, 'project/src')).toBeNull()
    expect(findPath(tree, 'file')).toBe('project/src/main.ts')
    expect(findPath(tree, 'folder')).toBe('project/src')
    expect(findPath(tree, 'file', ['workspace'])).toBe('workspace/project/src/main.ts')
    expect(countTreeItems(tree)).toEqual({ files: 1, folders: 2 })
    expect(findPath([{
        id: 'empty', name: '', alias: null, parent: null, type: 'folder', children: [
            { id: 'nested-file', name: 'file.ts', alias: null, parent: 'empty', type: 'file' },
        ],
    }], 'nested-file')).toBe('/file.ts')
})

test('workspace search strips one shared root only when every file has it', () => {
    const root = { id: 'root', name: 'project', alias: null, parent: null, type: 'folder' as const, children: [
        { id: 'one', name: 'one.ts', alias: null, parent: 'root', type: 'file' as const },
    ] }
    const other = { id: 'two', name: 'two.ts', alias: null, parent: null, type: 'file' as const }
    expect(flattenWorkspaceTree([root]).map(file => file.path)).toEqual(['one.ts'])
    expect(flattenWorkspaceTree([root, other]).map(file => file.path)).toEqual(['project/one.ts', 'two.ts'])
})

test('workspace search preserves match positions, enclosing symbol, word/case filters, and path filters', () => {
    const files = [
        file('src/app.ts', 'export function Greeting() {\n  const answer = "Token token"\n  return answer\n}'),
        file('node_modules/lib.js', 'Token'),
    ]
    const matches = searchIndexedFiles(files, 'token', defaults)
    expect(matches).toHaveLength(1)
    expect(matches[0].matches.map(({ line, column, endColumn, functionName }) => ({ line, column, endColumn, functionName }))).toEqual([
        { line: 2, column: 19, endColumn: 23, functionName: 'Greeting' },
        { line: 2, column: 25, endColumn: 29, functionName: 'Greeting' },
    ])
    expect(searchIndexedFiles(files, 'Token', { ...defaults, caseSensitive: true })[0].matches).toHaveLength(1)
    expect(searchIndexedFiles(files, 'token', { ...defaults, wholeWord: true, include: 'src/*.ts' })).toHaveLength(1)
    expect(searchIndexedFiles(files, 'Greeting', { ...defaults, exclude: 'src/*' })).toHaveLength(0)
})

test('zero-width regex matches advance and replacements keep native capture semantics', () => {
    const groups = searchIndexedFiles([file('src/a.ts', 'aaa')], '(?=a)', { ...defaults, regex: true })
    expect(groups[0].matches.map(({ column, endColumn }) => [column, endColumn])).toEqual([[1, 1], [2, 2], [3, 3]])
    expect(replaceInContent('name=42', '(\\w+)=(\\d+)', '$2:$1', { ...defaults, regex: true })).toBe('42:name')
})

test('symbol resolution runs once only on lines with matches', () => {
    const resolvedLines: number[] = []
    const results = searchIndexedFilesWithSymbolResolver(
        [file('src/example.ts', 'function active() {\n  token + token\n}\nfunction unused() {}')],
        'token',
        defaults,
        (_lines, lineIndex) => {
            resolvedLines.push(lineIndex)
            return 'active'
        },
    )

    expect(resolvedLines).toEqual([1])
    expect(results[0].matches.map(match => match.functionName)).toEqual(['active', 'active'])
})

test('symbol helpers retain identifier selection and definition contracts', () => {
    expect(extractClickedToken('foo-bar (selected)')).toBe('foo-bar')
    const definitions = findSymbolDefinitions([file('src/example.ts', 'export function findMe() {}\nconst other = 1')], 'findMe')
    expect(definitions.map(({ line, column, endColumn, preview }) => ({ line, column, endColumn, preview }))).toEqual([
        { line: 1, column: 17, endColumn: 22, preview: 'export function findMe() {}' },
    ])
})
