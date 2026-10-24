import { expect, test } from 'bun:test'
import { buildNextjsDockerTemplate, mergeNextjsDockerProjectFiles } from '../src/utils/ai/nextjsDockerTemplate'

test('builds the stable Next.js and Docker starter contract for a named project', () => {
    const template = buildNextjsDockerTemplate('Moonbase Console')

    expect(template.rootName).toBe('moonbase-console')
    expect(template.rootPath).toBe('moonbase-console')
    expect(template.files.map(file => file.path)).toEqual([
        'package.json',
        'tsconfig.json',
        'next-env.d.ts',
        'next.config.ts',
        '.gitignore',
        '.dockerignore',
        'Dockerfile',
        'docker-compose.yml',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/app/globals.css',
        'public/.gitkeep',
        'README.md',
    ])

    const files = new Map(template.files.map(file => [file.path, file.content]))
    const packageJson = JSON.parse(files.get('package.json') || '{}')
    const tsconfig = JSON.parse(files.get('tsconfig.json') || '{}')
    expect(packageJson.name).toBe('moonbase-console')
    expect(packageJson.scripts.dev).toBe('next dev --hostname 0.0.0.0 --port 3000')
    expect(packageJson.dependencies.next).toBe('16.2.3')
    expect(tsconfig.compilerOptions.allowJs).toBe(true)
    expect(files.get('src/app/layout.tsx')).toContain('title: \'Moonbase Console\'')
    expect(files.get('src/app/page.tsx')).toContain('<h1>Moonbase Console</h1>')
    expect(files.get('src/app/page.tsx')).toContain('Hanasand AI Repository')
    expect(files.get('src/app/page.tsx')).not.toContain('Hanasand AI Workspace')
    expect(files.get('README.md')).toContain('browser-native code repository')
    expect(files.get('docker-compose.yml')).toContain('${HOST_PORT:-3000}:3000')
    expect(files.get('Dockerfile')).toContain('FROM node:20-alpine AS deps')
    expect(files.get('README.md')).toContain('HOST_PORT=3200 docker compose up --build')
})

test('falls back to a safe starter name for blank and non-ASCII project names', () => {
    expect(buildNextjsDockerTemplate('  ').rootName).toBe('hanasand-next-docker')
    expect(buildNextjsDockerTemplate('Ålesund').rootName).toBe('lesund')
})

test('generated App Router files replace the starter route even when the extension differs', () => {
    const template = buildNextjsDockerTemplate('Moonbase Console')
    const files = mergeNextjsDockerProjectFiles(template.files, [
        { path: 'src/app/page.jsx', content: 'export default function Page() { return <h1>Generated app</h1> }\n' },
    ])
    const pageFiles = files.filter(file => /^src\/app\/page\.(?:js|jsx|ts|tsx)$/.test(file.path))

    expect(pageFiles).toEqual([
        { path: 'src/app/page.jsx', content: 'export default function Page() { return <h1>Generated app</h1> }\n' },
    ])
    expect(files.find(file => file.path === 'src/app/layout.tsx')?.content).toContain('import \'./globals.css\'')
})
