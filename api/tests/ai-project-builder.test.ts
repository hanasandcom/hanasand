import { expect, test } from 'bun:test'
import { buildShareProjectResponse } from '../src/handlers/tools/aiProjectBuilder.ts'

function generatedFiles(message: string) {
    return [...message.matchAll(/<hanasand-tool>(.*?)<\/hanasand-tool>/gs)]
        .map(([, value]) => JSON.parse(value!) as { action: string; path: string; content: string })
}

test('builder generates runnable website files and caches an identical response', () => {
    expect(buildShareProjectResponse('Hello there')).toBeNull()

    const prompt = 'Build a small website called "Moon Archive" with Docker'
    const first = buildShareProjectResponse(prompt)!
    const files = generatedFiles(first.message)

    expect(first).toMatchObject({
        status: 'completed',
        provider: 'hanasand-ai',
        model: 'share-builder',
        cache: { hit: false, category: 'deployment_fix' },
    })
    expect(files.map(file => file.path)).toContain('package.json')
    expect(files.map(file => file.path)).toContain('Dockerfile')
    expect(files.map(file => file.path)).toContain('src/app/page.tsx')
    expect(files.every(file => file.action === 'upsert_share')).toBe(true)
    expect(files.find(file => file.path === 'package.json')?.content).toContain('"next"')
    expect(first.message).toContain('Prepared a runnable product website')

    const apiFiles = generatedFiles(buildShareProjectResponse('Build a Fastify API called "Orbit Ledger"')!.message)
    expect(apiFiles.find(file => file.path === 'src/db.ts')?.content).toContain('export async function checkDatabase()')

    const second = buildShareProjectResponse(prompt)!
    expect(second.message).toBe(first.message)
    expect(second.cache).toEqual({ ...first.cache, hit: true })
})
