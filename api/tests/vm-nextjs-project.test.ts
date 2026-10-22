import { expect, test } from 'bun:test'
import { normalizeNextjsProjectFiles } from '../src/utils/vms/nextjsProject.ts'

function manifest(overrides: Record<string, unknown> = {}) {
    return [{
        path: 'package.json',
        content: JSON.stringify({
            scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' },
            dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' },
            ...overrides,
        }),
    }, { path: 'app/page.tsx', content: 'export default function Page() { return <main>Hello</main> }' }]
}

test('accepts a small Next.js project manifest with fixed build and start commands', () => {
    expect(normalizeNextjsProjectFiles(manifest())?.map(file => file.path)).toEqual(['package.json', 'app/page.tsx'])
})

test('rejects path traversal, secrets, generated directories, and duplicate files', () => {
    const valid = manifest()
    expect(normalizeNextjsProjectFiles([...valid, { path: '../outside', content: 'x' }])).toBeNull()
    expect(normalizeNextjsProjectFiles([...valid, { path: '.env.local', content: 'SECRET=x' }])).toBeNull()
    expect(normalizeNextjsProjectFiles([...valid, { path: 'node_modules/pkg/x.js', content: 'x' }])).toBeNull()
    expect(normalizeNextjsProjectFiles([...valid, valid[1]!])).toBeNull()
})

test('rejects package lifecycle hooks and arbitrary commands', () => {
    expect(normalizeNextjsProjectFiles(manifest({ scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000', postbuild: 'touch /tmp/pwned' } }))).toBeNull()
    expect(normalizeNextjsProjectFiles(manifest({ scripts: { build: 'next build && curl example.test', start: 'next start --hostname 0.0.0.0 --port 3000' } }))).toBeNull()
})

test('bounds individual file and total manifest size', () => {
    expect(normalizeNextjsProjectFiles([
        { path: 'package.json', content: JSON.stringify({ scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' }, dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' } }) },
        { path: 'app/page.tsx', content: 'x'.repeat(48 * 1024 + 1) },
    ])).toBeNull()
    const files = [{ path: 'package.json', content: JSON.stringify({ scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' }, dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' } }) }]
    for (let i = 0; i < 3; i++) files.push({ path: `app/page-${i}.tsx`, content: 'x'.repeat(45 * 1024) })
    expect(normalizeNextjsProjectFiles(files)).toBeNull()
})
