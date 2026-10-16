import { expect, test } from 'bun:test'
import { buildNextjsDockerTemplate } from '../src/utils/ai/nextjsDockerTemplate'

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
        'app/layout.tsx',
        'app/page.tsx',
        'app/globals.css',
        'public/.gitkeep',
        'README.md',
    ])

    const files = new Map(template.files.map(file => [file.path, file.content]))
    const packageJson = JSON.parse(files.get('package.json') || '{}')
    expect(packageJson.name).toBe('moonbase-console')
    expect(packageJson.scripts.dev).toBe('next dev --hostname 0.0.0.0 --port 3000')
    expect(packageJson.dependencies.next).toBe('16.2.3')
    expect(files.get('app/layout.tsx')).toContain('title: \'Moonbase Console\'')
    expect(files.get('app/page.tsx')).toContain('<h1>Moonbase Console</h1>')
    expect(files.get('docker-compose.yml')).toContain('${HOST_PORT:-3000}:3000')
    expect(files.get('Dockerfile')).toContain('FROM node:20-alpine AS deps')
    expect(files.get('README.md')).toContain('HOST_PORT=3200 docker compose up --build')
})

test('falls back to a safe starter name for blank and non-ASCII project names', () => {
    expect(buildNextjsDockerTemplate('  ').rootName).toBe('hanasand-next-docker')
    expect(buildNextjsDockerTemplate('Ålesund').rootName).toBe('lesund')
})
